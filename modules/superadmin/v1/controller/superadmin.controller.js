const { Op } = require("sequelize");
const Ad = require("../../../../models/ad.model");
const AdLocation = require("../../../../models/adLocation.model");
const AdImage = require("../../../../models/adImage.model");
const AdPriceDetails = require("../../../../models/adPriceDetails.model");
const User = require("../../../../models/user.model");
const AdViews = require("../../../../models/adView.model");
const AdWishLists = require("../../../../models/adWishList.model");
const ReferralCodeLogin = require("../../../../models/referralCodeLogin.model");
const NotifiedPhone = require("../../../../models/notifiedPhone.model");
const {
  responseStatusCodes,
  responseMessages,
} = require("../../../../helpers/appConstants");
const {
  getImageUrlPublic,
  deleteImageFromS3,
  uploadToS3,
} = require("../../../../helpers/utils");
require("dotenv").config();
const admin = require("../../../../helpers/firebase");
const messaging = admin.messaging();
const dayjs = require("dayjs");

const getAdminAds = async (req, res, next) => {
  try {
    const { date, location, limit = 10, offset = 0 } = req.query;

    let whereClause = {};
    let locationClause = {};

    if (date) {
      const start = dayjs(date).startOf("day").toDate();
      const end = dayjs(date).endOf("day").toDate();
      whereClause.createdAt = { [Op.between]: [start, end] };
    }

    if (location) {
      const like = `%${location}%`;
      locationClause = {
        [Op.or]: [
          { locality: { [Op.like]: like } },
          { place: { [Op.like]: like } },
          { district: { [Op.like]: like } },
          { state: { [Op.like]: like } },
          { country: { [Op.like]: like } },
        ],
      };
    }

    const { count, rows: ads } = await Ad.findAndCountAll({
      where: whereClause,
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
        {
          model: AdLocation,
          as: "ad_location",
          where: location ? locationClause : undefined,
          required: !!location,
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true, // ✅ correct count with includes
    });

    const adsWithUrls = ads.map((ad) => {
      const adObj = ad.toJSON();

      if (adObj.ad_images?.length > 0) {
        adObj.ad_images = adObj.ad_images.map((img) => ({
          ...img,
          image: getImageUrlPublic(img.image),
        }));
      }

      if (adObj.user?.profile) {
        adObj.user.profile = getImageUrlPublic(adObj.user.profile);
      }

      return adObj;
    });

    return res.success(responseMessages.adminAdsFetched, {
      total: count,
      data: adsWithUrls,
    });
  } catch (error) {
    return next(error);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const { limit = 10, offset = 0 } = req.query;

    const { count, rows: users } = await User.findAndCountAll({
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const usersWithProfileUrls = users.map((user) => {
      const userObj = user.toJSON();
      if (userObj.profile) {
        userObj.profile = getImageUrlPublic(userObj.profile);
      }
      return userObj;
    });

    return res.success(
      responseMessages.allUsersFetched,
      {
        total: count,
        data: usersWithProfileUrls,
      },
      responseStatusCodes.success,
    );
  } catch (error) {
    return next(error);
  }
};

const blockUserById = async (req, res, next) => {
  try {
    const { id } = req.query;
    const user = await User.findOne({
      where: {
        user_id: id,
      },
    });
    if (!user) {
      return res.error(
        responseMessages.userNotFound,
        null,
        responseStatusCodes.notFound,
      );
    }

    user.block_status = !user.block_status;
    await user.save();

    return res.success(responseMessages.blockUser);
  } catch (error) {
    return next(error);
  }
};

const deleteAdminAd = async (req, res, next) => {
  try {
    const { id } = req.query;

    const ad = await Ad.findOne(
      { ad_id: id },
      {
        include: [{ model: AdImage, as: "ad_images" }],
      },
    );
    if (!ad) {
      return res.error(
        responseMessages.adNotFound,
        null,
        responseStatusCodes.notFound,
      );
    }
    if (ad.ad_images && ad.ad_images.length > 0) {
      await Promise.all(
        ad.ad_images.map(async (img) => {
          await deleteImageFromS3(img.image);
        }),
      );
    }
    await AdImage.destroy({ where: { ad_id: id } });
    await AdLocation.destroy({ where: { ad_id: id } });
    await AdPriceDetails.destroy({ where: { ad_id: id } });
    await AdViews.destroy({ where: { ad_id: id } });
    await AdWishLists.destroy({ where: { ad_id: id } });
    await Ad.destroy({ where: { ad_id: id } });
    return res.success(responseMessages.adDeleted);
  } catch (error) {
    return next(error);
  }
};

const getAllAdLocations = async (req, res, next) => {
  try {
    const adLocations = await AdLocation.findAll();
    const uniquePlaces = Array.from(
      new Set(
        adLocations
          .flatMap((adLoc) => [
            adLoc.dataValues.locality,
            adLoc.dataValues.place,
            adLoc.dataValues.district,
            adLoc.dataValues.state,
            adLoc.dataValues.country,
          ])
          .filter(Boolean),
      ),
    );
    return res.success(responseMessages.adLocationsFetched, {
      data: adLocations,
      list: uniquePlaces,
    });
  } catch (error) {
    return next(error);
  }
};

const makeUserAdmin = async (req, res, next) => {
  try {
    const { user_id, role } = req.body;
    const user = await User.findOne({
      where: { user_id },
    });
    if (!user) {
      return res.error(
        responseMessages.userNotFound,
        null,
        responseStatusCodes.notFound,
      );
    }
    await user.update({ role });
    return res.success("User promoted to admin successfully", {
      user_id: user.user_id,
      role: user.role,
    });
  } catch (error) {
    return next(error);
  }
};

const getSalesUsers = async (req, res, next) => {
  try {
    const { limit = 10, offset = 0 } = req.query;

    const { count, rows: users } = await User.findAndCountAll({
      where: { role: "admin" },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["createdAt", "DESC"]],
    });

    const usersWithProfileUrls = users.map((user) => {
      const userObj = user.toJSON();
      if (userObj.profile) {
        userObj.profile = getImageUrlPublic(userObj.profile);
      }
      return userObj;
    });

    return res.success(
      responseMessages.allUsersFetched,
      {
        total: count,
        data: usersWithProfileUrls,
      },
      responseStatusCodes.success,
    );
  } catch (error) {
    return next(error);
  }
};

const getSalesUserById = async (req, res, next) => {
  try {
    const { id } = req.query;
    const user = await User.findOne({
      where: {
        user_id: id,
        role: "admin",
      },
    });
    if (!user) {
      return res.error(
        responseMessages.userNotFound,
        null,
        responseStatusCodes.notFound,
      );
    }
    const userObj = user.toJSON();
    if (userObj.profile) {
      userObj.profile = getImageUrlPublic(userObj.profile);
    }
    const referrals = await ReferralCodeLogin.findAll({
      where: { refered_id: user.user_id },
      attributes: ["login_id"],
    });
    const referredUserIds = referrals.map((r) => r.login_id);
    if (referredUserIds.length === 0) {
      userObj.referred_ads = [];
      userObj.referred_users = [];
      return res.success(
        responseMessages.userFetched,
        userObj,
        responseStatusCodes.success,
      );
    }
    const ads = await Ad.findAll({
      where: {
        user_id: referredUserIds,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "profile", "createdAt"],
        },
        { model: AdImage, as: "ad_images" },
        { model: AdPriceDetails, as: "ad_price_details" },
        { model: AdLocation, as: "ad_location" },
      ],
      order: [["createdAt", "DESC"]],
    });
    const adsWithImageUrls = await Promise.all(
      ads.map(async (ad) => {
        const adObj = ad.toJSON();
        if (adObj.ad_images?.length > 0) {
          adObj.ad_images = await Promise.all(
            adObj.ad_images.map(async (img) => ({
              ...img,
              image: img.image ? getImageUrlPublic(img.image) : null,
            })),
          );
        }
        if (adObj.user?.profile) {
          adObj.user.profile = getImageUrlPublic(adObj.user.profile);
        }
        return adObj;
      }),
    );
    userObj.referred_ads = adsWithImageUrls;
    const referredUsers = await User.findAll({
      where: {
        user_id: referredUserIds,
      },
    });
    const referredUsersWithDetails = await Promise.all(
      referredUsers.map(async (refUser) => {
        const refObj = refUser.toJSON();
        if (refObj.profile) {
          refObj.profile = getImageUrlPublic(refObj.profile);
        }
        return refObj;
      }),
    );
    userObj.referred_users = referredUsersWithDetails;
    return res.success(
      responseMessages.userFetched,
      userObj,
      responseStatusCodes.success,
    );
  } catch (error) {
    return next(error);
  }
};

const updateAd = async (req, res, next) => {
  try {
    const { id, title, description } = req.body;
    let { ad_price_details, deleted_image_ids } = req.body;

    const ad = await Ad.findOne({
      where: { id },
    });

    if (!ad) {
      return res.error(
        responseMessages.adNotFound,
        null,
        responseStatusCodes.notFound,
      );
    }

    await ad.update({
      title,
      description,
    });

    let parsedPrices = [];

    if (ad_price_details) {
      parsedPrices =
        typeof ad_price_details === "string"
          ? JSON.parse(ad_price_details)
          : ad_price_details;
    }

    if (Array.isArray(parsedPrices)) {
      if (parsedPrices.length <= 0) {
        await AdPriceDetails.destroy({
          where: { ad_id: ad.ad_id },
        });
      } else {
        for (const price of parsedPrices) {
          if (price.id) {
            await AdPriceDetails.update(
              {
                rent_price: price.price,
                rent_duration: price.unit,
              },
              {
                where: { id: price.id },
              },
            );
          } else {
            await AdPriceDetails.create({
              ad_id: ad.ad_id,
              rent_price: price.price,
              rent_duration: price.unit,
            });
          }
        }
      }
    }

    // ── DELETE IMAGES ────────────────────────────────────────────
    if (deleted_image_ids) {
      const parsedDeletedIds =
        typeof deleted_image_ids === "string"
          ? JSON.parse(deleted_image_ids)
          : deleted_image_ids;

      if (Array.isArray(parsedDeletedIds) && parsedDeletedIds.length > 0) {
        await AdImage.destroy({
          where: { id: parsedDeletedIds },
        });
      }
    }

    // ── UPLOAD NEW IMAGES ─────────────────────────────────────────
    if (req.files && req.files.length > 0) {
      const uploadedImages = [];

      for (const file of req.files) {
        const fileName = `${Date.now()}-${file.originalname}`;
        const { finalFilename } = await uploadToS3(file, fileName);

        uploadedImages.push({
          ad_id: ad.ad_id,
          image: finalFilename,
        });
      }

      await AdImage.bulkCreate(uploadedImages);
    }

    return res.success(
      "Ad updated successfully",
      null,
      responseStatusCodes.success,
    );
  } catch (error) {
    return next(error);
  }
};

const getAdById = async (req, res, next) => {
  try {
    const { id } = req.query;

    const ad = await Ad.findOne({
      where: { ad_id: id },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "mobile_number", "profile"],
        },
        { model: AdImage, as: "ad_images", attributes: ["id", "image"] },
        {
          model: AdPriceDetails,
          as: "ad_price_details",
          attributes: ["id", "rent_price", "rent_duration"],
        },
        {
          model: AdLocation,
          as: "ad_location",
        },
      ],
    });

    if (!ad) {
      return res.error(
        responseMessages.adNotFound,
        null,
        responseStatusCodes.notFound,
      );
    }

    const adObj = ad.toJSON();

    if (adObj.ad_images) {
      adObj.ad_images = await Promise.all(
        adObj.ad_images.map(async (img) => ({
          ...img,
          image: getImageUrlPublic(img.image),
        })),
      );
    }

    if (adObj.user?.profile) {
      adObj.user.profile = getImageUrlPublic(adObj.user.profile);
    }

    return res.success(
      responseMessages.adFetched,
      adObj,
      responseStatusCodes.success,
    );
  } catch (error) {
    return next(error);
  }
};

const checkPhone = async (req, res, next) => {
  try {
    const { phone_number } = req.query;

    const record = await NotifiedPhone.findOne({ where: { phone_number } });

    if (!record) {
      return res.success(responseMessages.phoneNotFound, {
        exists: false,
        created_at: null,
      });
    }

    return res.success(responseMessages.alreadyNotificationSent, {
      exists: true,
      created_at: record.createdAt,
    });
  } catch (error) {
    return next(error);
  }
};

const addPhone = async (req, res, next) => {
  try {
    const { phone_number } = req.body;

    const existing = await NotifiedPhone.findOne({ where: { phone_number } });
    if (existing) {
      return res.error(responseMessages.alreadyNotificationSent);
    }

    const record = await NotifiedPhone.create({ phone_number });

    return res.success(responseMessages.phoneNoAdded, record);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getAdminAds,
  deleteAdminAd,
  getAllAdLocations,
  getAllUsers,
  blockUserById,
  makeUserAdmin,
  getSalesUsers,
  getSalesUserById,
  getAdById,
  updateAd,
  checkPhone,
  addPhone,
};
