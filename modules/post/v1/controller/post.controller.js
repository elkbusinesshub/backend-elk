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

exports.deletAdImage = async (req, res, next) => {
  const { id } = req.body;
  try {
    const data = await AdImage.findOne({ where: { id } });
    if (!data) {
      return res.error(
        responseMessages.imageNotFound,
        null,
        responseStatusCodes.notFound,
      );
    }
    await deleteImageFromS3(data.image);
    await AdImage.destroy({ where: { id } });
    return res.success(responseMessages.imageDeleted);
  } catch (err) {
    return next(err);
  }
};

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

//done
exports.recommentedPosts = async (req, res, next) => {
  try {
    const userId = req.body.id;

    const limit = parseInt(req.body.limit) || 10;
    const offset = Math.max(parseInt(req.body.offset) || 0, 0);

    const userLat = req.body.latitude ? parseFloat(req.body.latitude) : null;
    const userLng = req.body.longitude ? parseFloat(req.body.longitude) : null;

    if (
      (userLat && (isNaN(userLat) || userLat < -90 || userLat > 90)) ||
      (userLng && (isNaN(userLng) || userLng < -180 || userLng > 180))
    ) {
      return res.error(responseMessages.invalidCoordinates);
    }

    const [userSearches, blockedUserIds] = await Promise.all([
      userId ? fetchUserSearches(userId) : Promise.resolve([]),
      userId ? fetchBlockedUserIds(userId) : Promise.resolve([]),
    ]);

    const adsQuery = buildAdsQuery({
      userId,
      blockedUserIds,
      userSearches,
      userLat,
      userLng,
      limit,
      offset,
    });

    const { count, rows: ads } = await Ad.findAndCountAll(adsQuery);
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
          6371 *
          acos(
            cos(radians(${userLat})) * cos(radians(\`ad_location\`.\`latitude\`)) *
            cos(radians(\`ad_location\`.\`longitude\`) - radians(${userLng})) +
            sin(radians(${userLat})) * sin(radians(\`ad_location\`.\`latitude\`))
          )
        )`),
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
