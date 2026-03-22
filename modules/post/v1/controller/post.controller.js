const User = require("../../../../models/user.model");
const { Op, literal } = require("sequelize");
const AdWishLists = require("../../../../models/adWishList.model");
const AdImage = require("../../../../models/adImage.model");
const AdPriceDetails = require("../../../../models/adPriceDetails.model");
const AdLocation = require("../../../../models/adLocation.model");
const Ad = require("../../../../models/ad.model");
const AdView = require("../../../../models/adView.model");
const SearchCategory = require("../../../../models/searchCategory.model");
const sequelize = require("../../../../config/db");
const UserSearch = require("../../../../models/userSearch.model");
const BlockedUser = require("../../../../models/blockedUser.model");
const admin = require("../../../../helpers/firebase");
const { generateAdId } = require("../../../../helpers/utils");
const path = require("path");
const sharp = require("sharp");
const { insertAdViewCount } = require("../service/post.service");

const messaging = admin.messaging();
const {
  responseStatusCodes,
  responseMessages,
} = require("../../../../helpers/appConstants");
const {
  getImageUrlPublic,
  deleteImageFromS3,
  uploadToS3,
  formatAd,
  formatPagination,
} = require("../../../../helpers/utils");
const {
  fetchBlockedUserIds,
  fetchUserSearches,
  buildAdsQuery,
  buildServiceProvidersQuery,
} = require("../service/post.service");

require("dotenv").config();

exports.createAd = async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const { ad_id, title, description, category, ad_type, ad_prices } =
      req.body;
    const adStage = req.body.ad_stage ?? 1;
    const adStatus = req.body.ad_status ?? "offline";

    // Build price details array (reused in both create and update)
    const buildAdPrices = (adId) =>
      Object.entries(ad_prices).map(([key, value]) => ({
        ad_id: adId,
        rent_duration: key,
        rent_price: value,
      }));

    let adId;

    if (!ad_id) {
      // CREATE — run SearchCategory and Ad in parallel
      const newAdId = generateAdId();

      const [ad] = await Promise.all([
        Ad.create({
          ad_id: newAdId,
          user_id: userId,
          title,
          description,
          category,
          ad_type,
          ad_stage: adStage,
          ad_status: adStatus,
        }),
        SearchCategory.create({ keyword: title, category, ad_type }),
      ]);

      await AdPriceDetails.bulkCreate(buildAdPrices(newAdId));
      adId = newAdId;
    } else {
      // UPDATE — find ad and validate
      const ad = await Ad.findOne({ where: { ad_id } });

      if (!ad) {
        return res.error(
          responseMessages.adNotFound,
          null,
          responseStatusCodes.notFound,
        );
      }

      // Update ad fields and recreate prices in parallel
      await Promise.all([
        ad.update({
          title,
          description,
          category,
          ad_type,
          ad_stage: adStage,
          ad_status: adStatus,
        }),
        AdPriceDetails.destroy({ where: { ad_id } }).then(() =>
          AdPriceDetails.bulkCreate(buildAdPrices(ad_id)),
        ),
        SearchCategory.create({ keyword: title, category, ad_type }),
      ]);

      adId = ad_id;
    }

    return res.success(responseMessages.adUpdated, { ad_id: adId });
  } catch (error) {
    return next(error);
  }
};

exports.updateAdImage = async (req, res, next) => {
  try {
    const { ad_id, ad_stage, ad_status } = req.query;
    const images = req.files;

    // Find ad first before any processing
    const ad = await Ad.findOne({
      where: { ad_id },
      attributes: ["ad_id", "title", "ad_status", "ad_stage"],
    });

    if (!ad) {
      return res.error(
        responseMessages.adNotFound,
        null,
        responseStatusCodes.notFound,
      );
    }

    let adImages = [];

    if (images?.length) {
      // Upload all images to S3 in parallel
      const uploadResults = await Promise.all(
        images.map(async (image) => {
          const fileName = `${ad_id}_${image.originalname}`;
          const { finalFilename } = await uploadToS3(image, fileName);
          return { ad_id, image: finalFilename };
        }),
      );
      adImages = uploadResults;
    } else {
      adImages = [{ ad_id, image: "1761544844899520_auto.png" }];
    }


    await Promise.all([
      Ad.update(
        {
          ad_status: ad_status ?? "offline",
          ad_stage: ad_stage ?? 2,
        },
        {
          where: { ad_id },
        },
      ),
      AdImage.bulkCreate(adImages),
    ]);

    // Fetch updated images and attach URLs
    const updatedImages = await AdImage.findAll({
      where: { ad_id },
      attributes: ["ad_id", "image"],
    });

    const updatedImagesWithUrls = updatedImages.map((img) => ({
      ...img.toJSON(),
      image: getImageUrlPublic(img.image),
    }));

    return res.success(
      responseMessages.imageUploadSuccess,
      updatedImagesWithUrls,
    );
  } catch (error) {
    return next(error);
  }
};

//done
exports.deletAdImage = async (req, res, next) => {
  const { id } = req.body;
  //   if (!id) {
  //     return res
  //       .status(responseStatusCodes.badRequest)
  //       .json({ message: responseMessages.invalidRequest });
  //   }
  try {
    const data = await AdImage.findOne({ where: { id } });
    if (!data) {
      //   return res
      //     .status(responseStatusCodes.notFound)
      //     .json({ success: false, message: responseMessages.imageNotFound });
      return res.error(
        responseMessages.imageNotFound,
        null,
        responseStatusCodes.notFound,
      );
    }
    await deleteImageFromS3(data.image);
    await AdImage.destroy({ where: { id } });
    // return res
    //   .status(responseStatusCodes.success)
    //   .json({ success: true, message: responseMessages.imageDeleted });
    return res.success(responseMessages.imageDeleted);
  } catch (err) {
    // return res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ success: false, message: responseMessages.internalServerError });
    return next(err);
  }
};

// exports.updateAdAddress = async (req, res, next) => {
//   const {
//     ad_id,
//     country,
//     latitude,
//     longitude,
//     state,
//     district,
//     locality,
//     ad_stage,
//     ad_status,
//     place,
//   } = req.body;
//   if (!ad_id || !country || latitude === undefined || longitude === undefined) {
//     // return res
//     //   .status(responseStatusCodes.badRequest)
//     //   .json({ success: false, message: responseMessages.invalidRequest });
//     return res.error(
//       responseMessages.invalidRequest,
//       null,
//       responseStatusCodes.badRequest,
//     );
//   }
//   try {
//     let adLocation = await AdLocation.findOne({ where: { ad_id } });
//     if (adLocation) {
//       adLocation.country = country;
//       adLocation.state = state;
//       adLocation.district = district;
//       adLocation.locality = locality;
//       adLocation.place = place;
//       adLocation.longitude = longitude;
//       adLocation.latitude = latitude;
//       await adLocation.save();
//     } else {
//       adLocation = new AdLocation({
//         ad_id,
//         country,
//         state,
//         district,
//         locality,
//         place,
//         longitude,
//         latitude,
//       });
//       await adLocation.save();
//     }
//     const ad = await Ad.findOne({ where: { ad_id } });
//     ad.ad_status = ad_status || "online";
//     ad.ad_stage = ad_stage || 3;
//     await ad.save();
//     if (!ad) {
//       //   return res
//       //     .status(responseStatusCodes.notFound)
//       //     .json({ success: false, message: responseMessages.adNotFound });
//       return res.error(
//         responseMessages.adNotFound,
//         null,
//         responseStatusCodes.notFound,
//       );
//     }
//     const usersToNotify = await User.findAll();
//     const tokens = usersToNotify
//       .map((user) => user.notification_token)
//       .filter((token) => token);
//     const usersWithTokens = usersToNotify
//       .filter((user) => user.notification_token) // keep only users with token
//       .map((user) => ({
//         name: user.name, // or user.username, depending on your column
//         token: user.notification_token,
//       }));

//     tokens.push("ok");
//     const message = {
//       notification: {
//         title: "A Fresh Listing Awaits!",
//         body: `Your next favorite deal might be "${ad.title}". Tap to check it out!`,
//       },
//       data: {
//         type: "adpost", // 👈 distinguish between chat/adpost
//         ad_id: ad.ad_id.toString(),
//       },
//       tokens: tokens,
//     };
//     // const messages = tokens.map(token => ({
//     // token,
//     // notification: {
//     //     title: "New Ad Posted!",
//     //     body: `Check out: ${title}`,
//     // },
//     // }));

//     const response = await messaging.sendEachForMulticast(message);
//     // return res.status(responseStatusCodes.success).json({
//     //   success: true,
//     //   message: responseMessages.locationSuccess,
//     //   successCount: response.successCount,
//     //   failureCount: response.failureCount,
//     // });
//     return res.success(responseMessages.locationSuccess, {
//       successCount: response.successCount,
//       failureCount: response.failureCount,
//     });
//   } catch (err) {
//     // return res
//     //   .status(responseStatusCodes.internalServerError)
//     //   .json({ success: false, message: responseMessages.internalServerError });
//   }
// };

//done
exports.updateAdAddress = async (req, res, next) => {
  try {
    const {
      ad_id,
      country,
      latitude,
      longitude,
      state,
      district,
      locality,
      place,
      ad_stage,
      ad_status,
    } = req.body;

    if (
      !ad_id ||
      !country ||
      latitude === undefined ||
      longitude === undefined
    ) {
      return res.error(
        responseMessages.invalidRequest,
        null,
        responseStatusCodes.badRequest,
      );
    }

    const locationFields = {
      ad_id,
      country,
      state,
      district,
      locality,
      place,
      longitude,
      latitude,
    };

    // Find ad and location in parallel
    const [ad, adLocation] = await Promise.all([
      Ad.findOne({ where: { ad_id } }),
      AdLocation.findOne({ where: { ad_id } }),
    ]);

    if (!ad) {
      return res.error(
        responseMessages.adNotFound,
        null,
        responseStatusCodes.notFound,
      );
    }

    // Upsert location and update ad in parallel
    await Promise.all([
      adLocation
        ? adLocation.update(locationFields)
        : AdLocation.create(locationFields),
      ad.update({
        ad_status: ad_status ?? "online",
        ad_stage: ad_stage ?? 3,
      }),
    ]);

    // Fetch only tokens — no need to fetch all user columns
    const users = await User.findAll({
      attributes: ["notification_token"],
      where: { notification_token: { [Op.ne]: null } },
    });

    const tokens = users.map((u) => u.notification_token);

    if (!tokens.length) {
      return res.success(responseMessages.locationSuccess, {
        successCount: 0,
        failureCount: 0,
      });
    }

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: "A Fresh Listing Awaits!",
        body: `Your next favorite deal might be "${ad.title}". Tap to check it out!`,
      },
      data: {
        type: "adpost",
        ad_id: ad.ad_id.toString(),
      },
    });

    return res.success(responseMessages.locationSuccess, {
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (error) {
    return next(error);
  }
};

//done
exports.deleteAd = async (req, res, next) => {
  try {
    const { adId } = req.body;

    const ad = await Ad.findOne({
      where: { ad_id: adId },
      attributes: ["ad_id", "ad_images"],
    });

    if (!ad) {
      return res.error(
        responseMessages.adNotFound,
        null,
        responseStatusCodes.notFound,
      );
    }

    // Delete all child records in parallel
    await Promise.all([
      AdImage.destroy({ where: { ad_id: adId } }),
      AdLocation.destroy({ where: { ad_id: adId } }),
      AdPriceDetails.destroy({ where: { ad_id: adId } }),
      AdView.destroy({ where: { ad_id: adId } }),
      AdWishLists.destroy({ where: { ad_id: adId } }),
    ]);

    // Delete parent last
    await Ad.destroy({ where: { ad_id: adId } });

    return res.success(responseMessages.adDeleted);
  } catch (error) {
    return next(error);
  }
};

//done
exports.getAdDetails = async (req, res, next) => {
  try {
    const { ad_id, user_id: userId } = req.body;

    // Fetch ad and wishlist in parallel
    const [ad, wishListAdIds] = await Promise.all([
      Ad.findOne({
        where: { ad_id },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "name", "email", "mobile_number", "profile"],
          },
          { model: AdImage, as: "ad_images", attributes: ["image"] },
          { model: AdLocation, as: "ad_location" },
          {
            model: AdPriceDetails,
            as: "ad_price_details",
            attributes: ["rent_price", "rent_duration"],
          },
        ],
        nest: true,
      }),
      userId
        ? AdWishLists.findAll({
            where: { user_id: userId },
            attributes: ["ad_id"],
          }).then((wishLists) => wishLists.map((w) => w.ad_id))
        : Promise.resolve([]),
    ]);

    if (!ad) {
      return res.error(
        responseMessages.adNotFound,
        null,
        responseStatusCodes.notFound,
      );
    }

    // Track view and format ad in parallel
    const [formattedAd] = await Promise.all([
      formatAd(ad),
      userId ? insertAdViewCount(userId, ad.ad_id) : Promise.resolve(),
    ]);

    formattedAd.wishListed = wishListAdIds.includes(ad.ad_id);

    return res.success(responseMessages.adDetailFetched, formattedAd);
  } catch (error) {
    return next(error);
  }
};

exports.myAds = async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const { limit = 10, offset = 0 } = req.query;

    const { count, rows: ads } = await Ad.findAndCountAll({
      where: { user_id: userId, ad_stage: 3 },
      attributes: {
        include: [
          [
            literal(
              `(SELECT COUNT(*) FROM ad_wish_lists WHERE ad_wish_lists.ad_id = Ad.ad_id)`,
            ),
            "ad_wish_lists_count",
          ],
          [
            literal(
              `(SELECT COUNT(*) FROM ad_views WHERE ad_views.ad_id = Ad.ad_id)`,
            ),
            "ad_views_count",
          ],
        ],
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "mobile_number", "profile"],
        },
        { model: AdImage, as: "ad_images", attributes: ["image"] },
        { model: AdLocation, as: "ad_location" },
        {
          model: AdPriceDetails,
          as: "ad_price_details",
          attributes: ["rent_price", "rent_duration"],
        },
      ],
      nest: true,
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true,
    });

    const formattedAds = await Promise.all(
      ads.map((ad) => formatAd(ad, { includeCounts: true })),
    );

    return res.success(responseMessages.myadsFetched, {
      ads: formattedAds,
      total: count,
    });
  } catch (error) {
    return next(error);
  }
};

//done
exports.getRecentUnsavedPost = async (req, res, next) => {
  try {
    const { id: userId } = req.user;

    const ad = await Ad.findOne({
      where: {
        user_id: userId,
        ad_stage: { [Op.lt]: 3 },
      },
      include: [
        { model: AdImage, as: "ad_images", attributes: ["image"] },
        {
          model: AdPriceDetails,
          as: "ad_price_details",
          attributes: ["rent_price", "rent_duration"],
        },
        { model: AdLocation, as: "ad_location" },
      ],
      order: [["updatedAt", "DESC"]],
      nest: true,
    });

    if (!ad) {
      return res.success(
        responseMessages.adNotFound,
        null,
        responseStatusCodes.success,
      );
    }

    const formattedAd = formatAd(ad, { includeUser: false });

    return res.success(responseMessages.unsavedAds, formattedAd);
  } catch (error) {
    return next(error);
  }
};

//done
exports.searchCategories = async (req, res, next) => {
  try {
    const { keyword, ad_type } = req.body;
    const result = await SearchCategory.findAll({
      where: {
        keyword: { [Op.like]: `${keyword}%` }, // startsWith at DB level
        ad_type,
      },
      attributes: ["keyword", "category", "ad_type"],
      order: [["keyword", "ASC"]],
    });

    return res.success(responseMessages.searchCategories, result);
  } catch (error) {
    return next(error);
  }
};

// exports.recommentedPosts = async (req, res, next) => {
//   try {
//     const page = parseInt(req.body.page);
//     const perPage = 16;
//     const offset = (page - 1) * perPage;
//     let userSearches = [];
//     if (req.body.id) {
//       userSearches = await UserSearch.findAll({
//         where: {
//           user_id: req.body.id,
//         },
//         order: [["createdAt", "ASC"]],
//         limit: 2,
//         raw: true,
//         nest: true,
//       });
//     }
//     let blockedUserIds = [];
//     if (req.body.id) {
//       const blockedRecords = await BlockedUser.findAll({
//         where: {
//           [Op.or]: [{ blocker_id: req.body.id }, { blocked_id: req.body.id }],
//         },
//         raw: true,
//       });

//       blockedUserIds = blockedRecords.map((record) =>
//         record.blocker_id !== req.body.id
//           ? record.blocked_id
//           : record.blocker_id
//       );
//     }

//     let adsQuery = {
//       where: {
//         ad_status: "online",
//         ad_type: "rent",
//         ad_stage: 3,
//       },
//       include: [
//         { model: User, as: "user" },
//         { model: AdImage, as: "ad_images" },
//         { model: AdPriceDetails, as: "ad_price_details" },
//       ],
//       distinct: true,
//       limit: perPage,
//       offset: offset,
//     };
//     if (req.body.id) {
//       adsQuery.where.user_id = {
//         [Op.and]: [{ [Op.ne]: req.body.id }, { [Op.notIn]: blockedUserIds }],
//       };
//     }
//     if (userSearches.length !== 0) {
//       const firstSearch = userSearches[0];
//       const hasLocationDetails =
//         firstSearch.location &&
//         firstSearch.location_type &&
//         firstSearch.latitude !== null &&
//         firstSearch.longitude !== null;
//       if (hasLocationDetails) {
//         if (
//           userSearches[0].location_type === "locality" ||
//           userSearches[0].location_type === "place"
//         ) {
//           adsQuery.include.push({
//             model: AdLocation,
//             as: "ad_location",
//             where: {
//               [Op.or]: [
//                 { locality: userSearches[0].location },
//                 { place: userSearches[0].location },
//               ],
//             },
//           });
//         } else {
//           adsQuery.include.push({
//             model: AdLocation,
//             as: "ad_location",
//             where: {
//               [Op.or]: [
//                 { state: userSearches[0].location },
//                 { country: userSearches[0].location },
//               ],
//             },
//           });
//         }
//         adsQuery.attributes = {
//           include: [
//             [
//               literal(`(
//                                 SELECT (6371 *
//                                     acos(cos(radians(${userSearches[0].latitude})) * cos(radians(ad_location.latitude)) *
//                                     cos(radians(ad_location.longitude) - radians(${userSearches[0].longitude})) +
//                                     sin(radians(${userSearches[0].latitude})) * sin(radians(ad_location.latitude)))
//                                 ) AS distance
//                             )`),
//               "distance",
//             ],
//           ],
//         };
//         adsQuery.order = [[sequelize.literal("distance"), "ASC"]];
//       } else {
//         adsQuery.include.push({
//           model: AdLocation,
//           as: "ad_location",
//         });
//       }
//     } else {
//       adsQuery.include.push({
//         model: AdLocation,
//         as: "ad_location",
//         required: true,
//       });
//       if (req.body.latitude && req.body.longitude) {
//         adsQuery.attributes = {
//           include: [
//             [
//               literal(`(
//                                 SELECT (6371 *
//                                     acos(cos(radians(${req.body.latitude})) * cos(radians(ad_location.latitude)) *
//                                     cos(radians(ad_location.longitude) - radians(${req.body.longitude})) +
//                                     sin(radians(${req.body.latitude})) * sin(radians(ad_location.latitude)))
//                                 ) AS distance
//                             )`),
//               "distance",
//             ],
//           ],
//         };
//         adsQuery.order = [[sequelize.literal("distance"), "ASC"]];
//       }
//     }
//     const { count, rows: ads } = await Ad.findAndCountAll(adsQuery);
//     const fullUrl = `${req.protocol}://${req.get("host")}${
//       req.originalUrl.split("?")[0]
//     }`;
//     const pagination = formatPagination({
//       page: Number(page),
//       perPage,
//       total: count,
//       path: fullUrl,
//     });
//     const formattedAds = await Promise.all(ads.map((ad) => formatAd(ad)));

//     // res.status(responseStatusCodes.success).json({
//     //   ...pagination,
//     //   data: formattedAds,
//     // });
//     return res.success(responseMessages.recommentedPosts, {
//       pagination,
//       data: formattedAds,
//     });
//   } catch (error) {
//     // res
//     //   .status(responseStatusCodes.internalServerError)
//     //   .json({ message: responseMessages.internalServerError });
//     return next(error);
//   }
// };

//done
exports.recommentedPosts = async (req, res, next) => {
  try {
    // const page = Math.max(1, parseInt(req.body.page) || 1);
    // const perPage = 16;
    // const offset = (page - 1) * perPage;
    const userId = req.body.id;

    const limit = parseInt(req.body.limit) || 10;
    const offset = Math.max(parseInt(req.body.offset) || 0, 0);

    // Validate and sanitize coordinates to prevent SQL injection
    const userLat = req.body.latitude ? parseFloat(req.body.latitude) : null;
    const userLng = req.body.longitude ? parseFloat(req.body.longitude) : null;

    if (
      (userLat && (isNaN(userLat) || userLat < -90 || userLat > 90)) ||
      (userLng && (isNaN(userLng) || userLng < -180 || userLng > 180))
    ) {
      // return res.status(400).json({ message: 'Invalid coordinates' });
      return res.error(responseMessages.invalidCoordinates);
    }

    // 2. PARALLEL DATA FETCHING - Fetch blocked users and searches simultaneously
    const [userSearches, blockedUserIds] = await Promise.all([
      userId ? fetchUserSearches(userId) : Promise.resolve([]),
      userId ? fetchBlockedUserIds(userId) : Promise.resolve([]),
    ]);

    // 3. BUILD OPTIMIZED QUERY
    const adsQuery = buildAdsQuery({
      userId,
      blockedUserIds,
      userSearches,
      userLat,
      userLng,
      limit,
      offset,
    });

    // 4. EXECUTE QUERY
    const { count, rows: ads } = await Ad.findAndCountAll(adsQuery);

    // 5. FORMAT RESPONSE
    // const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl.split("?")[0]}`;
    // const pagination = formatPagination({
    //   page,
    //   perPage,
    //   total: count,
    //   path: fullUrl,
    // });

    // 6. FORMAT ADS (no async operations inside formatAd now)
    const formattedAds = ads.map((ad) => formatAd(ad));

    return res.success(responseMessages.recommentedPosts, {
      totalCount: count,
      data: formattedAds,
    });
  } catch (error) {
    return next(error);
  }
};

// exports.getAllPosts = async (req, res, next) => {
//   let posts = await Ad.findAll({
//     where: {
//       ad_status: "online",
//       ad_type: "rent",
//       ad_stage: 3,
//     },
//     include: [
//       { model: User, as: "user" },
//       { model: AdImage, as: "ad_images" },
//       { model: AdPriceDetails, as: "ad_price_details" },
//     ],
//   });
//   //   res.status(responseStatusCodes.success).json(posts);
//   return res.success(responseMessages.allAds, posts);
// };

exports.getAllPosts = async (req, res, next) => {
  try {
    const { limit = 10, offset = 0 } = req.query;

    const { count, rows: posts } = await Ad.findAndCountAll({
      where: {
        ad_status: "online",
        ad_type: "rent",
        ad_stage: 3,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "mobile_number", "profile"],
        },
        { model: AdImage, as: "ad_images", attributes: ["image"] },
        {
          model: AdPriceDetails,
          as: "ad_price_details",
          attributes: ["rent_price", "rent_duration"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true,
      nest: true,
    });

    const formattedPosts = posts.map((post) => formatAd(post));

    return res.success(responseMessages.allAds, {
      data: formattedPosts,
      total: count,
    });
  } catch (error) {
    return next(error);
  }
};

// exports.searchAds = async (req, res, next) => {
//   try {
//     const { keyword, page = 1, min_price, max_price } = req.body;
//     // if (!keyword) {
//     //   return res
//     //     .status(responseStatusCodes.badRequest)
//     //     .json({ message: responseMessages.invalidRequest });
//     // }

//     const perPage = 15;
//     const offset = (page - 1) * perPage;

//     let adsQuery = {
//       where: {
//         ad_status: "online",
//         ad_stage: 3,
//       },
//       include: [
//         { model: User, as: "user" },
//         { model: AdImage, as: "ad_images" },
//         {
//           model: AdPriceDetails,
//           as: "ad_price_details",
//           // where: {
//           //     ...(min_price !== undefined ? { rent_price: { [Op.gte]: Number(min_price) } } : {}),
//           //     ...(max_price !== undefined ? { rent_price: { ...(min_price !== undefined ? { [Op.gte]: Number(min_price), [Op.lte]: Number(max_price) } : { [Op.lte]: Number(max_price) }) } } : {})
//           // },
//         },
//         { model: AdLocation, as: "ad_location" },
//       ],
//       distinct: true,
//       limit: perPage,
//       offset: offset,
//     };

//     if (!isNaN(keyword)) {
//       adsQuery.where.ad_id = Number(keyword);
//     } else {
//       adsQuery.where[Op.or] = [
//         { title: { [Op.like]: `%${keyword}%` } },
//         { category: { [Op.like]: `%${keyword}%` } },
//         { description: { [Op.like]: `%${keyword}%` } },
//       ];
//     }
//     const { count, rows: ads } = await Ad.findAndCountAll(adsQuery);
//     const formattedAds = await Promise.all(ads.map((ad) => formatAd(ad)));
//     const fullUrl = `${req.protocol}://${req.get("host")}${
//       req.originalUrl.split("?")[0]
//     }`;
//     const pagination = formatPagination({
//       page: Number(page),
//       perPage,
//       total: count,
//       path: fullUrl,
//     });
//     // res.status(responseStatusCodes.success).json({
//     //   ...pagination,
//     //   data: formattedAds,
//     // });
//     return res.success(responseMessages.searchCategories, {
//       pagination,
//       data: formattedAds,
//     });
//     // res.status(responseStatusCodes.success).json(response);
//   } catch (error) {
//     // res
//     //   .status(responseStatusCodes.internalServerError)
//     //   .json({ message: responseMessages.internalServerError });
//     return next(error);
//   }
// };

exports.searchAds = async (req, res, next) => {
  try {
    const { keyword, limit = 15, offset = 0, min_price, max_price } = req.body;

    // Build price filter if provided
    const priceWhere = {};
    if (min_price !== undefined) priceWhere[Op.gte] = Number(min_price);
    if (max_price !== undefined) priceWhere[Op.lte] = Number(max_price);
    const hasPriceFilter = Object.keys(priceWhere).length > 0;

    // Build search filter — numeric keyword searches by ad_id, otherwise full text search
    const searchWhere = !isNaN(keyword)
      ? { ad_id: Number(keyword) }
      : {
          [Op.or]: [
            { title: { [Op.like]: `%${keyword}%` } },
            { category: { [Op.like]: `%${keyword}%` } },
            { description: { [Op.like]: `%${keyword}%` } },
          ],
        };

    const { count, rows: ads } = await Ad.findAndCountAll({
      where: {
        ad_status: "online",
        ad_stage: 3,
        ...searchWhere,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "mobile_number", "profile"],
        },
        { model: AdImage, as: "ad_images", attributes: ["image"] },
        {
          model: AdPriceDetails,
          as: "ad_price_details",
          attributes: ["rent_price", "rent_duration"],
          ...(hasPriceFilter && {
            where: { rent_price: priceWhere },
            required: true,
          }),
        },
        { model: AdLocation, as: "ad_location" },
      ],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true,
      nest: true,
    });

    const formattedAds = ads.map((ad) => formatAd(ad));

    return res.success(responseMessages.searchCategories, {
      data: formattedAds,
      total: count,
    });
  } catch (error) {
    return next(error);
  }
};

// exports.rentCategoryPosts = async (req, res, next) => {
//   try {
//     const {
//       ad_type,
//       location_type,
//       location,
//       latitude,
//       longitude,
//       category,
//       keyword,
//       page = 1,
//       user_id,
//       min_price,
//       max_price,
//     } = req.body;
//     const perPage = 15;
//     const offset = (page - 1) * perPage;
//     if (user_id) {
//       await UserSearch.create({
//         user_id: user_id,
//         keyword: req.body.keyword || "",
//         category: req.body.category || "",
//         ad_type: req.body.ad_type,
//         location_type: req.body.location_type || "",
//         location: req.body.location || "",
//         latitude: req.body.latitude || null,
//         longitude: req.body.longitude || null,
//       });
//     }
//     let blockedUserIds = [];
//     if (user_id) {
//       const blockedRecords = await BlockedUser.findAll({
//         where: {
//           [Op.or]: [{ blocker_id: user_id }, { blocked_id: user_id }],
//         },
//         raw: true,
//       });

//       blockedUserIds = blockedRecords.map((record) =>
//         record.blocker_id !== user_id ? record.blocked_id : record.blocker_id,
//       );
//     }
//     let response;
//     let adsQuery;
//     const allAds = await Ad.findAll({ attributes: ["ad_id"] });
//     const allAdIds = allAds.map((ad) => ad.ad_id);
//     if (keyword && allAdIds.includes(Number(keyword))) {
//       adsQuery = {
//         where: {
//           ad_id: Number(keyword),
//           ad_stage: 3,
//           [Op.and]: [{ [Op.notIn]: blockedUserIds }],
//         },
//         include: [
//           { model: User, as: "user" },
//           { model: AdImage, as: "ad_images" },
//           {
//             model: AdPriceDetails,
//             as: "ad_price_details",
//             // where: {
//             //     ...(min_price !== undefined ? { rent_price: { [Op.gte]: Number(min_price) } } : {}),
//             //     ...(max_price !== undefined ? { rent_price: { ...(min_price !== undefined ? { [Op.gte]: Number(min_price), [Op.lte]: Number(max_price) } : { [Op.lte]: Number(max_price) }) } } : {})
//             // },
//           },
//           { model: AdLocation, as: "ad_location" },
//         ],
//         distinct: true,
//         limit: perPage,
//         offset: offset,
//       };
//     } else if (!location_type || !location || !latitude || !longitude) {
//       adsQuery = {
//         where: {
//           ad_type: ad_type,
//           ad_status: "online",
//           ad_stage: 3,
//         },
//         include: [
//           { model: User, as: "user" },
//           { model: AdImage, as: "ad_images" },
//           {
//             model: AdPriceDetails,
//             as: "ad_price_details",
//             // where: {
//             //     ...(min_price !== undefined ? { rent_price: { [Op.gte]: Number(min_price) } } : {}),
//             //     ...(max_price !== undefined ? { rent_price: { ...(min_price !== undefined ? { [Op.gte]: Number(min_price), [Op.lte]: Number(max_price) } : { [Op.lte]: Number(max_price) }) } } : {})
//             // },
//           },
//           { model: AdLocation, as: "ad_location" },
//         ],
//         distinct: true,
//         limit: perPage,
//         offset: offset,
//       };
//       if (category) adsQuery.where.category = category;
//       if (keyword) {
//         adsQuery.where[Op.or] = [
//           { category: { [Op.like]: `%${keyword}%` } },
//           { title: { [Op.like]: `%${keyword}%` } },
//           { description: { [Op.like]: `%${keyword}%` } },
//         ];
//       }
//     } else {
//       adsQuery = {
//         where: {
//           ad_type: ad_type,
//           ad_status: "online",
//           ad_stage: 3,
//         },
//         attributes: {
//           include: [
//             [
//               literal(`(
//                                 SELECT (6371 *
//                                     acos(cos(radians(${latitude})) * cos(radians(ad_location.latitude)) *
//                                     cos(radians(ad_location.longitude) - radians(${longitude})) +
//                                     sin(radians(${latitude})) * sin(radians(ad_location.latitude)))
//                                 ) AS distance
//                             )`),
//               "distance",
//             ],
//           ],
//         },
//         include: [
//           { model: User, as: "user" },
//           { model: AdImage, as: "ad_images" },
//           {
//             model: AdPriceDetails,
//             as: "ad_price_details",
//             // where: {
//             //     ...(min_price !== null ? { rent_price: { [Op.gte]: Number(min_price) } } : {}),
//             //     ...(max_price !== null ? { rent_price: { ...(min_price !== null ? { [Op.gte]: Number(min_price), [Op.lte]: Number(max_price) } : { [Op.lte]: Number(max_price) }) } } : {})
//             // },
//           },
//         ],
//         order: [[sequelize.literal("distance"), "ASC"]],
//         distinct: true,
//         limit: perPage,
//         offset: offset,
//       };
//       if (category) adsQuery.where.category = category;
//       if (keyword) {
//         adsQuery.where = {
//           ...adsQuery.where,
//           [Op.or]: [
//             { category: { [Op.like]: `%${keyword}%` } },
//             { title: { [Op.like]: `%${keyword}%` } },
//             { description: { [Op.like]: `%${keyword}%` } },
//           ],
//         };
//       }
//       if (location_type === "locality" || location_type === "place") {
//         adsQuery.include.push({
//           model: AdLocation,
//           as: "ad_location",
//           where: {
//             [Op.or]: [{ locality: location }, { place: location }],
//           },
//         });
//       } else {
//         adsQuery.include.push({
//           model: AdLocation,
//           as: "ad_location",
//           where: {
//             [Op.or]: [{ state: location }, { country: location }],
//           },
//         });
//       }
//     }
//     const { count, rows: ads } = await Ad.findAndCountAll(adsQuery);

//     const userId = user_id;
//     let wishListAdIds;
//     if (userId) {
//       const wishLists = await AdWishLists.findAll({
//         where: { user_id: userId },
//         attributes: ["ad_id"],
//       });
//       wishListAdIds = wishLists.map((wishList) => wishList.ad_id);
//       ads.map((ad) => {
//         ad.wishListed = wishListAdIds.includes(ad.ad_id);
//         if (ad.user) {
//           ad.user = ad.user.toJSON();
//           delete ad.user.token;
//         }
//       });
//     }
//     const formattedAds = await Promise.all(
//       ads.map((ad) => formatAd(ad, { userId: user_id, wishListAdIds })),
//     );
//     const fullUrl = `${req.protocol}://${req.get("host")}${
//       req.originalUrl.split("?")[0]
//     }`;
//     response = {
//       pagination: formatPagination({
//         page: Number(page),
//         perPage,
//         total: count,
//         path: fullUrl,
//       }),
//       data: formattedAds,
//     };
//     // res.status(responseStatusCodes.success).json(response);
//     return res.success(responseMessages.rentCategoryPosts, response);
//   } catch (error) {
//     // res
//     //   .status(responseStatusCodes.internalServerError)
//     //   .json({ message: responseMessages.internalServerError });
//     return next(error);
//   }
// };

exports.rentCategoryPosts = async (req, res, next) => {
  try {
    const {
      ad_type,
      location_type,
      location,
      latitude,
      longitude,
      category,
      keyword,
      user_id,
      min_price,
      max_price,
    } = req.body;

    // ── Pagination ──────────────────────────────────────────
    const limit = Math.max(1, parseInt(req.body.limit) || 15);
    const offset = Math.max(0, parseInt(req.body.offset) || 0);

    // ── Validate coordinates ────────────────────────────────
    const userLat = latitude ? parseFloat(latitude) : null;
    const userLng = longitude ? parseFloat(longitude) : null;

    if (
      (userLat && (isNaN(userLat) || userLat < -90 || userLat > 90)) ||
      (userLng && (isNaN(userLng) || userLng < -180 || userLng > 180))
    ) {
      return res.error(responseMessages.invalidCoordinates);
    }

    // ── Parallel: user searches + blocked users ─────────────
    const [blockedUserIds, wishListAdIds] = await Promise.all([
      user_id
        ? BlockedUser.findAll({
            where: {
              [Op.or]: [{ blocker_id: user_id }, { blocked_id: user_id }],
            },
            raw: true,
          }).then((records) =>
            records.map((r) =>
              r.blocker_id !== user_id ? r.blocked_id : r.blocker_id,
            ),
          )
        : Promise.resolve([]),

      user_id
        ? AdWishLists.findAll({
            where: { user_id },
            attributes: ["ad_id"],
          }).then((wl) => wl.map((w) => w.ad_id))
        : Promise.resolve([]),

      // Fire-and-forget user search log
      user_id
        ? UserSearch.create({
            user_id,
            keyword: keyword || "",
            category: category || "",
            ad_type,
            location_type: location_type || "",
            location: location || "",
            latitude: userLat || null,
            longitude: userLng || null,
          }).catch(() => {}) // don't block response if this fails
        : Promise.resolve(),
    ]);

    // ── Base where clause ───────────────────────────────────
    const baseWhere = {
      ad_type,
      ad_status: "online",
      ad_stage: 3,
      ...(blockedUserIds.length
        ? { user_id: { [Op.notIn]: blockedUserIds } }
        : {}),
    };

    if (category) baseWhere.category = category;

    if (keyword) {
      baseWhere[Op.or] = [
        { category: { [Op.like]: `%${keyword}%` } },
        { title: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } },
      ];
    }

    // ── Base includes ───────────────────────────────────────
    const baseIncludes = [
      { model: User, as: "user" },
      { model: AdImage, as: "ad_images" },
      { model: AdPriceDetails, as: "ad_price_details" },
    ];

    // ── Handle keyword = ad_id shortcut ────────────────────
    if (keyword && !isNaN(Number(keyword))) {
      const adExists = await Ad.findOne({
        where: { ad_id: Number(keyword) },
        attributes: ["ad_id"],
      });
      if (adExists) {
        const { count, rows: ads } = await Ad.findAndCountAll({
          where: { ad_id: Number(keyword), ad_stage: 3 },
          include: [...baseIncludes, { model: AdLocation, as: "ad_location" }],
          distinct: true,
          limit,
          offset,
        });

        const formattedAds = ads.map((ad) =>
          formatAd(ad, { userId: user_id, wishListAdIds }),
        );
        return res.success(responseMessages.rentCategoryPosts, {
          totalCount: count,
          data: formattedAds,
        });
      }
    }

    // ── Build query based on location availability ──────────
    let adsQuery;

    const hasLocation = location_type && location && userLat && userLng;

    if (!hasLocation) {
      // No location — simple query
      adsQuery = {
        where: baseWhere,
        include: [...baseIncludes, { model: AdLocation, as: "ad_location" }],
        distinct: true,
        limit,
        offset,
      };
    } else {
      // With location — distance-based query
      const locationWhere =
        location_type === "locality" || location_type === "place"
          ? { [Op.or]: [{ locality: location }, { place: location }] }
          : { [Op.or]: [{ state: location }, { country: location }] };

      adsQuery = {
        where: baseWhere,
        attributes: {
          include: [
            [
              literal(`(
                SELECT (6371 *
                  acos(cos(radians(${userLat})) * cos(radians(ad_location.latitude)) *
                  cos(radians(ad_location.longitude) - radians(${userLng})) +
                  sin(radians(${userLat})) * sin(radians(ad_location.latitude)))
                )
              `),
              "distance",
            ],
          ],
        },
        include: [
          ...baseIncludes,
          { model: AdLocation, as: "ad_location", where: locationWhere },
        ],
        order: [[sequelize.literal("distance"), "ASC"]],
        distinct: true,
        limit,
        offset,
      };
    }

    // ── Execute ─────────────────────────────────────────────
    const { count, rows: ads } = await Ad.findAndCountAll(adsQuery);

    const formattedAds = ads.map((ad) =>
      formatAd(ad, { userId: user_id, wishListAdIds }),
    );

    return res.success(responseMessages.rentCategoryPosts, {
      totalCount: count,
      data: formattedAds,
    });
  } catch (error) {
    return next(error);
  }
};

// exports.bestServiceProviders = async (req, res, next) => {
//   try {
//     const perPage = 10;
//     const {
//       location_type,
//       location,
//       latitude,
//       longitude,
//       page = 1,
//       user_id,
//     } = req.body;
//     const offset = (page - 1) * perPage;
//     const hasLocation = location_type && location && latitude && longitude;
//     let adsQuery;
//     let blockedUserIds = [];
//     if (user_id) {
//       const blockedRecords = await BlockedUser.findAll({
//         where: {
//           [Op.or]: [{ blocker_id: user_id }, { blocked_id: user_id }],
//         },
//         raw: true,
//       });

//       blockedUserIds = blockedRecords.map((record) =>
//         record.blocker_id !== user_id ? record.blocked_id : record.blocker_id
//       );
//     }

//     if (hasLocation) {
//       adsQuery = {
//         where: {
//           ad_type: "service",
//           ad_status: "online",
//           user_id: {
//             [Op.and]: [{ [Op.ne]: user_id }, { [Op.notIn]: blockedUserIds }],
//           },
//           ad_stage: 3,
//         },
//         attributes: {
//           include: [
//             [
//               literal(
//                 `(SELECT COUNT(*) FROM ad_wish_lists WHERE ad_wish_lists.ad_id = Ad.ad_id)`
//               ),
//               "ad_wish_lists_count",
//             ],
//             [
//               literal(
//                 `(SELECT COUNT(*) FROM ad_views WHERE ad_views.ad_id = Ad.ad_id)`
//               ),
//               "ad_views_count",
//             ],
//             [
//               literal(`(
//                                 SELECT (6371 *
//                                     acos(cos(radians(${latitude})) * cos(radians(ad_location.latitude)) *
//                                     cos(radians(ad_location.longitude) - radians(${longitude})) +
//                                     sin(radians(${latitude})) * sin(radians(ad_location.latitude)))
//                                 ) AS distance
//                             )`),
//               "distance",
//             ],
//           ],
//         },
//         include: [
//           { model: User, as: "user" },
//           { model: AdImage, as: "ad_images" },
//           { model: AdPriceDetails, as: "ad_price_details" },
//         ],
//         order: [
//           [sequelize.literal("ad_wish_lists_count"), "ASC"],
//           [sequelize.literal("ad_views_count"), "ASC"],
//           [sequelize.literal("distance"), "ASC"],
//         ],
//         distinct: true,
//         limit: perPage,
//         offset: offset,
//       };
//       if (user_id) {
//         adsQuery.where.user_id = { [Op.ne]: user_id };
//       }
//       if (location_type === "locality" || location_type === "place") {
//         adsQuery.include.push({
//           model: AdLocation,
//           as: "ad_location",
//           where: {
//             [Op.or]: [{ locality: location }, { place: location }],
//           },
//         });
//       } else {
//         adsQuery.include.push({
//           model: AdLocation,
//           as: "ad_location",
//           where: {
//             [Op.or]: [{ state: location }, { country: location }],
//           },
//         });
//       }
//     } else {
//       adsQuery = {
//         where: {
//           ad_type: "service",
//           ad_status: "online",
//           ad_stage: 3,
//         },
//         attributes: {
//           include: [
//             [
//               literal(
//                 `(SELECT COUNT(*) FROM ad_wish_lists WHERE ad_wish_lists.ad_id = Ad.ad_id)`
//               ),
//               "ad_wish_lists_count",
//             ],
//             [
//               literal(
//                 `(SELECT COUNT(*) FROM ad_views WHERE ad_views.ad_id = Ad.ad_id)`
//               ),
//               "ad_views_count",
//             ],
//           ],
//         },
//         include: [
//           { model: User, as: "user" },
//           { model: AdImage, as: "ad_images" },
//           { model: AdPriceDetails, as: "ad_price_details" },
//           {
//             model: AdLocation,
//             as: "ad_location",
//           },
//         ],
//         order: [
//           [sequelize.literal("ad_wish_lists_count"), "DESC"],
//           [sequelize.literal("ad_views_count"), "DESC"],
//         ],
//         distinct: true,
//         limit: perPage,
//         offset: offset,
//       };
//       if (user_id) {
//         adsQuery.where.user_id = { [Op.ne]: user_id };
//       }
//     }
//     const { count, rows: ads } = await Ad.findAndCountAll(adsQuery);
//     const totalPages = Math.ceil(count / perPage);
//     const fullUrl = `${req.protocol}://${req.get("host")}${
//       req.originalUrl.split("?")[0]
//     }`;
//     const buildUrl = (pageNum) => `${fullUrl}?page=${pageNum}`;
//     const formattedAds = await Promise.all(
//       ads.map((ad) => formatAd(ad, { userId: user_id }))
//     );
//     response = {
//       pagination: formatPagination({
//         page: Number(page),
//         perPage,
//         total: count,
//         path: fullUrl,
//       }),
//       data: formattedAds,
//     };
//     return res.success(responseMessages.bestServiceProviders, response);
//   } catch (error) {
//     // res
//     //   .status(responseStatusCodes.internalServerError)
//     //   .json({ message: responseMessages.internalServerError });
//     return next(error);
//   }
// };

exports.bestServiceProviders = async (req, res, next) => {
  try {
    // 1. INPUT VALIDATION & SANITIZATION
    const limit = parseInt(req.body.limit) || 10;
    const offset = Math.max(parseInt(req.body.offset) || 0, 0);

    const { location_type, location, user_id: userId } = req.body;

    const userLat = req.body.latitude ? parseFloat(req.body.latitude) : null;
    const userLng = req.body.longitude ? parseFloat(req.body.longitude) : null;

    if (
      (userLat && (isNaN(userLat) || userLat < -90 || userLat > 90)) ||
      (userLng && (isNaN(userLng) || userLng < -180 || userLng > 180))
    ) {
      return res.error(responseMessages.invalidCoordinates);
    }

    const hasLocation = !!(location_type && location && userLat && userLng);

    // 2. PARALLEL DATA FETCHING
    const [blockedUserIds] = await Promise.all([
      userId ? fetchBlockedUserIds(userId) : Promise.resolve([]),
      // extend with more parallel fetches here if needed
    ]);

    // 3. BUILD & EXECUTE QUERY
    const adsQuery = buildServiceProvidersQuery({
      userId,
      blockedUserIds,
      userLat,
      userLng,
      location,
      location_type,
      hasLocation,
      limit,
      offset,
    });

    const { count, rows: ads } = await Ad.findAndCountAll(adsQuery);

    // 4. FORMAT RESPONSE
    const formattedAds = ads.map((ad) => formatAd(ad, { userId }));

    return res.success(responseMessages.bestServiceProviders, {
      totalCount: count,
      data: formattedAds,
    });
  } catch (error) {
    return next(error);
  }
};

exports.adCategoriesFor = async (req, res, next) => {
  try {
    const adCategoriesArray = [];
    // res.status(responseStatusCodes.success).json(adCategoriesArray);
    return res.success(responseMessages.adCategories, adCategoriesArray);
  } catch (error) {
    // res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ message: responseMessages.internalServerError });
    return next(error);
  }
};

exports.addToWishlist = async (req, res, next) => {
  try {
    const { ad_id } = req.body;
    // if (!ad_id) {
    //   return res
    //     .status(responseStatusCodes.notFound)
    //     .json({ message: responseMessages.invalidRequest });
    // }
    const userId = req.user.id;
    const wishList = await AdWishLists.findOne({
      where: {
        ad_id: ad_id,
        user_id: userId,
      },
    });
    if (wishList) {
      await wishList.destroy();
      //   return res
      //     .status(responseStatusCodes.success)
      //     .json({ success: true, message: responseMessages.wishlistRemoved });
      return res.success(responseMessages.wishlistRemoved);
    } else {
      await AdWishLists.create({
        user_id: userId,
        ad_id: ad_id,
      });
      //   return res
      //     .status(responseStatusCodes.success)
      //     .json({ success: true, message: responseMessages.wishlistAdded });
      return res.success(responseMessages.wishlistAdded);
    }
  } catch (error) {
    // res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ message: responseMessages.internalServerError });
    return next(error);
  }
};

exports.changeOnlineStatus = async (req, res, next) => {
  try {
    const { ad_id } = req.body;
    // if (!ad_id) {
    //   return res
    //     .status(responseStatusCodes.badRequest)
    //     .json({ message: responseMessages.invalidRequest });
    // }
    const ad = await Ad.findOne({ where: { ad_id } });
    if (!ad) {
      //   return res
      //     .status(responseStatusCodes.notFound)
      //     .json({ message: responseMessages.adNotFound });
      return res.error(
        responseMessages.adNotFound,
        null,
        responseStatusCodes.notFound,
      );
    }
    ad.ad_status = ad.ad_status === "online" ? "offline" : "online";
    await ad.save();
    // res
    //   .status(responseStatusCodes.success)
    //   .json({ message: `Ad status changed to ${ad.ad_status}` });
    return res.success(responseMessages.adStatusChange);
  } catch (error) {
    // res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ message: responseMessages.internalServerError });
    return next(error);
  }
};
