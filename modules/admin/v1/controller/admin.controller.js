const { Op } = require("sequelize");
const Ad = require("../../../../models/ad.model");
const AdLocation = require("../../../../models/adLocation.model");
const AdImage = require("../../../../models/adImage.model");
const AdPriceDetails = require("../../../../models/adPriceDetails.model");
const User = require("../../../../models/user.model");
const AdViews = require("../../../../models/adView.model");
const AdWishLists = require("../../../../models/adWishList.model");
const { responseStatusCodes, messages } = require("../../../../helpers/appConstants");
const { getImageUrl, deleteImageFromS3 } = require("../../../../helpers/utils");
require("dotenv").config();

const getAdminAds = async (req, res, next) => {
  try {
    const { date, location } = req.query;
    let whereClause = {};
    let locationClause = {};

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      whereClause.createdAt = { [Op.between]: [startDate, endDate] };
    }

    if (location) {
      locationClause = {
        [Op.or]: [
          { locality: { [Op.like]: `%${location}%` } },
          { place: { [Op.like]: `%${location}%` } },
          { district: { [Op.like]: `%${location}%` } },
          { state: { [Op.like]: `%${location}%` } },
          { country: { [Op.like]: `%${location}%` } },
        ],
      };
    }

    const ads = await Ad.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "mobile_number"],
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
    });
    const adsWithUrls = await Promise.all(
      ads.map(async (ad) => {
        const adObj = ad.toJSON();
        if (adObj.ad_images) {
          adObj.ad_images = await Promise.all(
            adObj.ad_images.map(async (img) => ({
              ...img,
              image: await getImageUrl(img.image),
            }))
          );
        }
        return adObj;
      })
    );
    // return res
    //   .status(responseStatusCodes.success)
    //   .json({ success: true, ads: adsWithUrls });
    return res.success(messages.adminAdsFetched, adsWithUrls );
  } catch (error) {
    console.error(error);
    return next(error);
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    const usersWithProfileUrls = await Promise.all(
      users.map(async (user) => {
        const userObj = user.toJSON();
        if (userObj.profile) {
          userObj.profile = await getImageUrl(userObj.profile);
        }
        return userObj;
      })
    );
    // return res
    //   .status(responseStatusCodes.success)
    //   .json({ success: true, users: usersWithProfileUrls });
    return res.success(messages.allUsersFetched, usersWithProfileUrls);
  } catch (error) {
    console.error("Error fetching users:", error);
    return next(error);
  }
};

const blockUserById = async (req, res) => {
  try {
    const { id } = req.query;
    const user = await User.findOne({
      where: {
        user_id: id,
      },
    });
    if (!user) {
      // return res
      //   .status(responseStatusCodes.notFound)
      //   .json({ success: false, message: "User not found" });
      return res.error(messages.userNotFound);
    }

    user.block_status = !user.block_status;
    await user.save();

    // return res
    //   .status(responseStatusCodes.success)
    //   .json({ success: true, message: "User blocked successfully" });
    return res.success(messages.userBlocked);
  } catch (error) {
    console.error("Error blocking user:", error);
    return next(error);
  }
};

const deleteAdminAd = async (req, res) => {
  try {
    const { id } = req.query;
    // if (!id) {
    //   return res
    //     .status(responseStatusCodes.badRequest)
    //     .json({ success: false, message: "Ad ID is required" });
    // }
    const ad = await Ad.findOne(
      { ad_id: id },
      {
        include: [{ model: AdImage, as: "ad_images" }],
      }
    );
    if (!ad) {
      // return res
      //   .status(responseStatusCodes.notFound)
      //   .json({ success: false, message: "Ad not found" });
      return res.error(messages.adNotFound);
    }
    if (ad.ad_images && ad.ad_images.length > 0) {
      await Promise.all(
        ad.ad_images.map(async (img) => {
          await deleteImageFromS3(img.image);
        })
      );
    }
    await AdImage.destroy({ where: { ad_id: id } });
    await AdLocation.destroy({ where: { ad_id: id } });
    await AdPriceDetails.destroy({ where: { ad_id: id } });
    await AdViews.destroy({ where: { ad_id: id } });
    await AdWishLists.destroy({ where: { ad_id: id } });
    await Ad.destroy({ where: { ad_id: id } });
    return res.success(messages.adDeleted);
  } catch (error) {
    console.error(error);
    return next(error);
  }
};

const getAllAdLocations = async (req, res) => {
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
          .filter(Boolean)
      )
    );
    // return res
    //   .status(responseStatusCodes.success)
    //   .json({ success: true, adLocations, list: uniquePlaces });
    return res.success(messages.adLocationsFetched, uniquePlaces);
  } catch (error) {
    console.error(error);
    return next(error);
  }
};

module.exports = {
  getAdminAds,
  deleteAdminAd,
  getAllAdLocations,
  getAllUsers,
  blockUserById,
};
