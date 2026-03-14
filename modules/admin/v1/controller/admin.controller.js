const Ad = require("../../../../models/ad.model");
const AdLocation = require("../../../../models/adLocation.model");
const AdImage = require("../../../../models/adImage.model");
const AdPriceDetails = require("../../../../models/adPriceDetails.model");
const User = require("../../../../models/user.model");
const { responseStatusCodes } = require("../../../../helpers/appConstants");
const { getImageUrlPublic } = require("../../../../helpers/utils");
require("dotenv").config();
const admin = require('../../../../helpers/firebase'); 
const { getImageUrlPublic } = require("../../../../helpers/utils");

const getSalesAds = async (req, res, next) => {
  try {

    const referrals = await ReferralCodeLogin.findAll({
      where: { refered_id: req.user.id },
      attributes: ["login_id"]
    });

    const referredUserIds = referrals.map(r => r.login_id);

    if (referredUserIds.length === 0) {
      return res.success("Ads fetched", []);
    }

    const ads = await Ad.findAll({
      where: { user_id: referredUserIds },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["name", "id", "profile", "createdAt"]
        },
        { model: AdImage, as: "ad_images" },
        { model: AdPriceDetails, as: "ad_price_details" },
        { model: AdLocation, as: "ad_location" }
      ]
    });

    const adsWithImageUrls = await Promise.all(
      ads.map(async (ad) => {

        const adObj = ad.toJSON();

        if (adObj.ad_images?.length > 0) {
          adObj.ad_images = await Promise.all(
            adObj.ad_images.map(async (img) => ({
              ...img,
              image: img.image ? getImageUrlPublic(img.image) : null
            }))
          );
        }

        return adObj;

      })
    );

    return res.success("Ads fetched", adsWithImageUrls);

  } catch (error) {
    return next(error);
  }
};

const getSalesUsers = async (req, res, next) => {
  try {

    const referrals = await ReferralCodeLogin.findAll({
      where: { refered_id: req.user.id },
      include: [
        {
          model: User,
          as: "login_user",
          attributes: ["name", "id", "profile", "createdAt"]
        }
      ]
    });

    const usersWithProfileUrls = await Promise.all(
      referrals.map(async (user) => {

        const userObj = user.toJSON();

        if (userObj.login_user?.profile) {
          userObj.login_user.profile = getImageUrlPublic(userObj.login_user.profile);
        }

        return userObj;

      })
    );

    return res.success("Users fetched", usersWithProfileUrls);

  } catch (error) {
    return next(error);
  }
};

const createUserAdAdmin = async (req, res, next) => {
  try {

    const { name, phone } = req.body;

    let user = await User.findOne({
      where: { mobile_number: `+91 ${phone}` }
    });

    if (user) {
      return res.success("User account already created");
    }

    const newUser = await User.create({
      name: name || "User",
      user_id: generateUserId(),
      mobile_number: `+91 ${phone}`,
      is_logged: false
    });

    const referralOwner = await ReferralCode.findOne({
      where: { user_id: req.user.id }
    });

    if (referralOwner) {

      const existingRef = await ReferralCodeLogin.findOne({
        where: { login_id: newUser.user_id }
      });

      if (!existingRef) {
        await ReferralCodeLogin.create({
          refered_id: referralOwner.user_id,
          login_id: newUser.user_id
        });
      }

    }

    const db = admin.firestore();

    await db.collection("privacy")
      .doc(newUser.user_id.toString())
      .set({
        name: newUser.name,
        userId: newUser.user_id,
        privacy: false
      });

    const ads = JSON.parse(req.body.ads);
    const location = JSON.parse(req.body.location);

    const createdAds = await Promise.all(
      ads.map(async (adData) => {

        return await Ad.create({
          ad_id: generateAdId(),
          user_id: newUser.user_id,
          title: adData.title,
          description: adData.description,
          category: adData.category,
          ad_type: adData.type,
          ad_stage: 3,
          ad_status: "online"
        });

      })
    );

    const adIdMap = createdAds.map(ad => ad.ad_id);

    await Promise.all(
      ads.map(async (adData, index) => {

        const ad_id = adIdMap[index];

        await AdLocation.create({
          ad_id,
          place: location.place,
          state: location.state,
          country: location.country,
          latitude: location.latitude,
          longitude: location.longitude
        });

        if (adData.prices?.length > 0) {

          const priceRecords = adData.prices.map(detail => ({
            ad_id,
            rent_duration: detail.unit,
            rent_price: detail.price
          }));

          await AdPriceDetails.bulkCreate(priceRecords);

        }

      })
    );

    return res.success(
      "User and Ad created successfully",
      null,
      responseStatusCodes.success
    );

  } catch (error) {
    return next(error);
  }
};

module.exports = { getSalesAds, getSalesUsers, createUserAdAdmin };
