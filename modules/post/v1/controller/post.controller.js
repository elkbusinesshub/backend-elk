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
const { log } = require("console");

require("dotenv").config();

exports.createAd = async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const { ad_id, title, description, category, ad_type, ad_prices } =
      req.body;
    const adStage = req.body.ad_stage ?? 1;
    const adStatus = req.body.ad_status ?? "offline";

    const buildAdPrices = (adId) =>
      Object.entries(ad_prices).map(([key, value]) => ({
        ad_id: adId,
        rent_duration: key,
        rent_price: value,
      }));

    let adId;

    if (!ad_id) {
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
      const ad = await Ad.findOne({ where: { ad_id } });

      if (!ad) {
        return res.error(
          responseMessages.adNotFound,
          null,
          responseStatusCodes.notFound,
        );
      }

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

    await Promise.all([
      adLocation
        ? adLocation.update(locationFields)
        : AdLocation.create(locationFields),
      ad.update({
        ad_status: ad_status ?? "online",
        ad_stage: ad_stage ?? 3,
      }),
    ]);

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

    await Promise.all([
      AdImage.destroy({ where: { ad_id: adId } }),
      AdLocation.destroy({ where: { ad_id: adId } }),
      AdPriceDetails.destroy({ where: { ad_id: adId } }),
      AdView.destroy({ where: { ad_id: adId } }),
      AdWishLists.destroy({ where: { ad_id: adId } }),
    ]);

    await Ad.destroy({ where: { ad_id: adId } });

    return res.success(responseMessages.adDeleted);
  } catch (error) {
    return next(error);
  }
};

exports.getAdDetails = async (req, res, next) => {
  try {
    const { ad_id, user_id: userId } = req.body;

    const [ad, wishListAdIds] = await Promise.all([
      Ad.findOne({
        where: { ad_id },
        include: [
          {
            model: User,
            as: "user",
          },
          { model: AdImage, as: "ad_images" },
          { model: AdLocation, as: "ad_location" },
          {
            model: AdPriceDetails,
            as: "ad_price_details",
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

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = Math.max(1, parseInt(req.query.perPage) || 10);
    const offset = (page - 1) * perPage;

    const { count, rows: ads } = await Ad.findAndCountAll({
      where: { user_id: userId, ad_stage: 3 },
      include: [
        { model: User, as: "user" },
        { model: AdImage, as: "ad_images" },
        { model: AdLocation, as: "ad_location" },
        { model: AdPriceDetails, as: "ad_price_details" },
      ],
      order: [["createdAt", "DESC"]],
      limit: perPage,
      offset,
      distinct: true,
    });

    const formattedAds = ads.map((ad) => formatAd(ad));

    const fullUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;
    formattedAds.map((ad)=>console.log(ad.ad_images));

    return res.success(responseMessages.myadsFetched, {
      pagination: formatPagination({
        page,
        perPage,
        total: count,
        path: fullUrl,
      }),
      data: formattedAds,
    });
  } catch (error) {
    return next(error);
  }
};

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

exports.searchCategories = async (req, res, next) => {
  try {
    const { keyword, ad_type } = req.body;
    const result = await SearchCategory.findAll({
      where: {
        keyword: { [Op.like]: `${keyword}%` },
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


exports.recommentedPosts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.body.page) || 1);
    const perPage = Math.max(1, parseInt(req.body.perPage) || 10);
    const offset = (page - 1) * perPage;

    const userId = req.body.id;

    const [userSearches, blockedUserIds] = await Promise.all([
      userId ? fetchUserSearches(userId) : [],
      userId ? fetchBlockedUserIds(userId) : [],
    ]);

    const adsQuery = buildAdsQuery({
      userId,
      blockedUserIds,
      userSearches,
      limit: perPage,
      offset,
    });

    const { count, rows: ads } = await Ad.findAndCountAll(adsQuery);

    const formattedAds = ads.map((ad) => formatAd(ad));

    const fullUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;

    return res.success(responseMessages.recommentedPosts, {
      pagination: formatPagination({
        page,
        perPage,
        total: count,
        path: fullUrl,
      }),
      data: formattedAds,
    });
  } catch (error) {
    return next(error);
  }
};

exports.getAllPosts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = Math.max(1, parseInt(req.query.perPage) || 10);
    const offset = (page - 1) * perPage;

    const { count, rows: posts } = await Ad.findAndCountAll({
      where: {
        ad_status: "online",
        ad_type: "rent",
        ad_stage: 3,
      },
      include: [
        { model: User, as: "user" },
        { model: AdImage, as: "ad_images" },
        { model: AdPriceDetails, as: "ad_price_details" },
      ],
      order: [["createdAt", "DESC"]],
      limit: perPage,
      offset,
      distinct: true,
    });

    const formattedPosts = posts.map((post) => formatAd(post));

    const fullUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;

    return res.success(responseMessages.allAds, {
      pagination: formatPagination({
        page,
        perPage,
        total: count,
        path: fullUrl,
      }),
      data: formattedPosts,
    });
  } catch (error) {
    return next(error);
  }
};

exports.searchAds = async (req, res, next) => {
  try {
    const {
      keyword,
      min_price,
      max_price,
      page = 1,
      perPage = 15,
    } = req.body;

    const offset = (page - 1) * perPage;

    const priceWhere = {};
    if (min_price !== undefined) priceWhere[Op.gte] = Number(min_price);
    if (max_price !== undefined) priceWhere[Op.lte] = Number(max_price);

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
        { model: User, as: "user" },
        { model: AdImage, as: "ad_images" },
        {
          model: AdPriceDetails,
          as: "ad_price_details",
          ...(Object.keys(priceWhere).length && {
            where: { rent_price: priceWhere },
            required: true,
          }),
        },
        { model: AdLocation, as: "ad_location" },
      ],
      limit: perPage,
      offset,
      distinct: true,
    });

    const formattedAds = ads.map((ad) => formatAd(ad));

    const fullUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;

    return res.success(responseMessages.searchCategories, {
      pagination: formatPagination({
        page,
        perPage,
        total: count,
        path: fullUrl,
      }),
      data: formattedAds,
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

    const page = Math.max(1, parseInt(req.body.page) || 1);
    const perPage = Math.max(1, parseInt(req.body.perPage) || 15);
    const offset = (page - 1) * perPage;

    const userLat = latitude ? parseFloat(latitude) : null;
    const userLng = longitude ? parseFloat(longitude) : null;

    if (
      (userLat && (isNaN(userLat) || userLat < -90 || userLat > 90)) ||
      (userLng && (isNaN(userLng) || userLng < -180 || userLng > 180))
    ) {
      return res.error(responseMessages.invalidCoordinates);
    }

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
          }).catch(() => {})
        : Promise.resolve(),
    ]);

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

    const baseIncludes = [
      { model: User, as: "user" },
      { model: AdImage, as: "ad_images" },
      { model: AdPriceDetails, as: "ad_price_details" },
    ];

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
          limit: perPage,
          offset,
        });

        const formattedAds = ads.map((ad) =>
          formatAd(ad, { userId: user_id, wishListAdIds }),
        );

        const fullUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;

        return res.success(responseMessages.rentCategoryPosts, {
          pagination: formatPagination({
            page,
            perPage,
            total: count,
            path: fullUrl,
          }),
          data: formattedAds,
        });
      }
    }

    let adsQuery;
    const hasLocation = location_type && location && userLat && userLng;

    if (!hasLocation) {
      adsQuery = {
        where: baseWhere,
        include: [...baseIncludes, { model: AdLocation, as: "ad_location" }],
        distinct: true,
        limit: perPage,
        offset,
      };
    } else {
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
        limit: perPage,
        offset,
      };
    }

    const { count, rows: ads } = await Ad.findAndCountAll(adsQuery);

    const formattedAds = ads.map((ad) =>
      formatAd(ad, { userId: user_id, wishListAdIds }),
    );

    const fullUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;

    return res.success(responseMessages.rentCategoryPosts, {
      pagination: formatPagination({
        page,
        perPage,
        total: count,
        path: fullUrl,
      }),
      data: formattedAds,
    });
  } catch (error) {
    return next(error);
  }
};

exports.bestServiceProviders = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.body.page) || 1);
    const perPage = Math.max(1, parseInt(req.body.perPage) || 10);
    const offset = (page - 1) * perPage;

    const { user_id: userId } = req.body;

    const [blockedUserIds] = await Promise.all([
      userId ? fetchBlockedUserIds(userId) : [],
    ]);

    const adsQuery = buildServiceProvidersQuery({
      userId,
      blockedUserIds,
      limit: perPage,
      offset,
    });

    const { count, rows: ads } = await Ad.findAndCountAll(adsQuery);

    const formattedAds = ads.map((ad) => formatAd(ad));

    const fullUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;

    return res.success(responseMessages.bestServiceProviders, {
      pagination: formatPagination({
        page,
        perPage,
        total: count,
        path: fullUrl,
      }),
      data: formattedAds,
    });
  } catch (error) {
    return next(error);
  }
};

exports.adCategoriesFor = async (req, res, next) => {
  try {
    const adCategoriesArray = [];
    return res.success(responseMessages.adCategories, adCategoriesArray);
  } catch (error) {
    return next(error);
  }
};

exports.addToWishlist = async (req, res, next) => {
  try {
    const { ad_id } = req.body;
    const userId = req.user.id;
    const wishList = await AdWishLists.findOne({
      where: {
        ad_id: ad_id,
        user_id: userId,
      },
    });
    if (wishList) {
      await wishList.destroy();
      return res.success(responseMessages.wishlistRemoved);
    } else {
      await AdWishLists.create({
        user_id: userId,
        ad_id: ad_id,
      });
      return res.success(responseMessages.wishlistAdded);
    }
  } catch (error) {
    return next(error);
  }
};

exports.changeOnlineStatus = async (req, res, next) => {
  try {
    const { ad_id } = req.body;
    const ad = await Ad.findOne({ where: { ad_id } });
    if (!ad) {
      return res.error(
        responseMessages.adNotFound,
        null,
        responseStatusCodes.notFound,
      );
    }
    ad.ad_status = ad.ad_status === "online" ? "offline" : "online";
    await ad.save();
    return res.success(responseMessages.adStatusChange);
  } catch (error) {
    return next(error);
  }
};
