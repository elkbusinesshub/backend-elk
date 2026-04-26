const Ad = require("../../../../models/ad.model");
const AdLocation = require("../../../../models/adLocation.model");
const AdImage = require("../../../../models/adImage.model");
const AdPriceDetails = require("../../../../models/adPriceDetails.model");
const User = require("../../../../models/user.model");
const ReferralCodeLogin = require("../../../../models/referralCodeLogin.model");
const ReferralCode = require("../../../../models/referralCode.model");
const {
  responseStatusCodes,
  responseMessages,
} = require("../../../../helpers/appConstants");
const {
  getImageUrlPublic,
  generateUserId,
  generateAdId,
} = require("../../../../helpers/utils");
require("dotenv").config();
const admin = require("../../../../helpers/firebase");

const getSalesAds = async (req, res, next) => {
  try {
    const { limit = 10, offset = 0 } = req.query;

    const referrals = await ReferralCodeLogin.findAll({
      where: { refered_id: req?.user?.id },
      attributes: ["login_id"],
    });

    const referredUserIds = referrals.map((r) => r.login_id);

    if (referredUserIds.length === 0) {
      return res.success(responseMessages.adminAdsFetched, {
        total: 0,
        data: [],
      });
    }

    const { count, rows: ads } = await Ad.findAndCountAll({
      where: { user_id: referredUserIds },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["name", "id", "profile", "createdAt"],
        },
        { model: AdImage, as: "ad_images" },
        { model: AdPriceDetails, as: "ad_price_details" },
        { model: AdLocation, as: "ad_location" },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true,
    });

    const adsWithImageUrls = ads.map((ad) => {
      const adObj = ad.toJSON();

      if (adObj.ad_images?.length > 0) {
        adObj.ad_images = adObj.ad_images.map((img) => ({
          ...img,
          image: img.image ? getImageUrlPublic(img.image) : null,
        }));
      }
      return adObj;
    });

    return res.success(responseMessages.adminAdsFetched, {
      total: count,
      data: adsWithImageUrls,
    });
  } catch (error) {
    return next(error);
  }
};

const getSalesUsers = async (req, res, next) => {
  try {
    const { limit = 10, offset = 0 } = req.query;

    const { count, rows: referrals } = await ReferralCodeLogin.findAndCountAll({
      where: { refered_id: req.user.id },
      include: [
        {
          model: User,
          as: "login_user",
          attributes: ["name", "id", "profile", "createdAt"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true,
    });

    const usersWithProfileUrls = referrals.map((user) => {
      const userObj = user.toJSON();
      if (userObj.login_user?.profile) {
        userObj.login_user.profile = getImageUrlPublic(
          userObj.login_user.profile,
        );
      }
      return userObj;
    });

    return res.success(responseMessages.salesUsersFetched, {
      total: count,
      data: usersWithProfileUrls,
    });
  } catch (error) {
    return next(error);
  }
};

const createUserAdAdmin = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    let user = await User.findOne({ where: { mobile_number: `+91 ${phone}` } });
    if (user) {
      return res.success(responseMessages.adminusercreatedalready);
    }

    const newUser = await User.create({
      name: name || "User",
      user_id: generateUserId(),
      mobile_number: `+91 ${phone}`,
      is_logged: false,
    });
    const referralOwner = await ReferralCode.findOne({
      where: { user_id: req.user.id },
    });
    const referrerId = referralOwner.user_id;
    if (referrerId === newUser.user_id) {
      return res.error(responseStatusCodes.cannotReferYourself);
    }
    if (referralOwner) {
      const loginUserId = newUser.user_id;
      const existingRef = await ReferralCodeLogin.findOne({
        where: { login_id: loginUserId },
      });

      if (!existingRef) {
        await ReferralCodeLogin.create({
          refered_id: referrerId,
          login_id: loginUserId,
        });
      }
    }
    const db = admin.firestore();
    const privacyRef = db.collection("privacy").doc(newUser.user_id.toString());

    await privacyRef.set({
      name: newUser.name,
      userId: newUser.user_id,
      privacy: false,
    });

    const ads = JSON.parse(req.body.ads);
    const location = JSON.parse(req.body.location);
    const createdAds = await Promise.all(
      ads.map(async (adData) => {
        const ad = await Ad.create({
          ad_id: generateAdId(),
          user_id: newUser.user_id,
          title: adData.title,
          description: adData.description,
          category: adData.category,
          ad_type: adData.type,
          ad_stage: 3,
          ad_status: "online",
        });

        return ad;
      }),
    );
    const adIdMap = createdAds.map((ad) => ad.ad_id);

    const uploadTasks = req.files
      .map((file) => {
        const match = file.fieldname.match(/ads\[(\d+)\]\[images\]/);
        if (!match) return null;
        const adIndex = Number(match[1]);
        const fileName = `${file.originalname}`;

        const command = new PutObjectCommand({
          Bucket: process.env.BUCKET_NAME,
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype,
        });

        return {
          adIndex,
          promise: s3.send(command).then(() => ({
            image: fileName,
          })),
        };
      })
      .filter(Boolean);

    const uploadResults = await Promise.all(
      uploadTasks.map((task) => task.promise),
    );

    uploadTasks.forEach((task, index) => {
      if (!ads[task.adIndex].images) {
        ads[task.adIndex].images = [];
      }
      ads[task.adIndex].images.push(uploadResults[index].image);
    });
    const usersToNotify = await User.findAll({
      attributes: ["notification_token"],
    });

    const tokens = [
      ...new Set(
        usersToNotify.map((u) => u.notification_token).filter(Boolean),
      ),
    ];

    await Promise.all(
      ads.map(async (adData, index) => {
        const ad_id = adIdMap[index];
        await AdLocation.create({
          ad_id,
          place: location.place,
          state: location.state,
          country: location.country,
          latitude: location.latitude,
          longitude: location.longitude,
        });

        if (adData.images && adData.images.length > 0) {
          const imageRecords = adData.images.map((img) => ({
            ad_id,
            image: img,
          }));
          await AdImage.bulkCreate(imageRecords);
        } else {
          await AdImage.create({
            ad_id,
            image: "1761544844899520_auto.png",
          });
        }

        if (adData.prices && adData.prices.length > 0) {
          const priceRecords = adData.prices.map((detail) => ({
            ad_id,
            rent_duration: detail.unit,
            rent_price: detail.price,
          }));
          await AdPriceDetails.bulkCreate(priceRecords);
        }
      }),
    );
    
    if (tokens.length > 0) {
      Promise.allSettled(
        ads.map(async (adData, index) => {
          const ad_id = adIdMap[index];
          try {
            await messaging.sendEachForMulticast({
              notification: {
                title: "A Fresh Listing Awaits! 🔥",
                body: `New ad posted: "${adData.title}". Tap to view now!`,
              },
              data: {
                type: "adpost",
                ad_id: ad_id.toString(),
              },
              tokens,
            });
          } catch (err) {
            console.error("FCM send error for ad", ad_id, err.message);
          }
        }),
      ).catch((err) => console.error("FCM batch failed", err));
    }

    return res.success(responseMessages.adminusercreated);
  } catch (error) {
    console.error(error);
    return next(error);
  }
};

module.exports = { getSalesAds, getSalesUsers, createUserAdAdmin };
