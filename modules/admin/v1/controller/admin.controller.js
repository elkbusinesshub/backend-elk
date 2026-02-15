const { Op } = require("sequelize");
const Ad = require("../../../../models/ad.model");
const AdLocation = require("../../../../models/adLocation.model");
const AdImage = require("../../../../models/adImage.model");
const AdPriceDetails = require("../../../../models/adPriceDetails.model");
const User = require("../../../../models/user.model");
const AdViews = require("../../../../models/adView.model");
const AdWishLists = require("../../../../models/adWishList.model");
const { responseStatusCodes, responseMessages } = require("../../../../helpers/appConstants");
const { getImageUrlPublic, deleteImageFromS3 } = require("../../../../helpers/utils");
require("dotenv").config();
const admin = require('../../../../helpers/firebase'); 
const messaging = admin.messaging();
const { getImageUrlPublic, uploadToS3 } = require("../../../../helpers/utils");

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
                    { country: { [Op.like]: `%${location}%` } }
                ]
            };
        }

        const ads = await Ad.findAll({
            where: whereClause,
            include: [
                { model: User, as: 'user', attributes: ['id', 'name', 'email', 'mobile_number','profile'] },
                { model: AdImage, as: 'ad_images', attributes: ['image'] },
                { model: AdPriceDetails, as: 'ad_price_details', attributes: ['rent_price', 'rent_duration'] },
                { model: AdLocation, as: 'ad_location', where: location ? locationClause : undefined, required: !!location }
            ],
            order: [['createdAt', 'DESC']]
        });
        const adsWithUrls = await Promise.all(ads.map(async (ad) => {
            const adObj = ad.toJSON();
            if (adObj.ad_images) {
                adObj.ad_images = await Promise.all(adObj.ad_images.map(async (img) => ({
                    ...img,
                    image: getImageUrlPublic(img.image),
                })));
            }
            if (adObj.user.profile) {
                adObj.user.profile = getImageUrlPublic(adObj.user.profile);
            }
            return adObj;
        }));
        // return res.status(responseStatusCodes.success).json({ success: true, ads: adsWithUrls });
        return res.success(responseMessages.adminAdsFetched,adsWithUrls);

    } catch (error) {
        // return res.status(responseStatusCodes.internalServerError).json({ success: false, message: responseMessages.internalServerError, message: error.message });
        return next(error);
    }

};

const getAllUsers = async (req, res, next) => {
    try {
        const users = await User.findAll({});
        const usersWithProfileUrls = await Promise.all(users.map(async (user) => {
            const userObj = user.toJSON();
            if (userObj.profile) {
                userObj.profile = getImageUrlPublic(userObj.profile);
            }
            return userObj;
        }));
        // return res.status(responseStatusCodes.success).json({ success: true, users: usersWithProfileUrls });
        return res.success(responseMessages.allUsersFetched, usersWithProfileUrls, responseStatusCodes.success);
    } catch (error) {
        return next(error);
    }
};

const blockUserById = async (req, res, next) => {
    try {
        const { id } = req.query;
        const user = await User.findOne({
            where: {
                user_id : id
            }
        });
        if (!user) {
            // return res.status(responseStatusCodes.notFound).json({ success: false, message: responseMessages.urlNotFound });
            return res.error(responseMessages.userNotFound,null,responseStatusCodes.notFound);
        }

        user.block_status = !user.block_status;
        await user.save();

        // return res.status(responseStatusCodes.success).json({ success: true, message: responseMessages.blockUser });
        return res.success(responseMessages.blockUser);
    } catch (error) {
        return next(error);
    }
};

const deleteAdminAd = async (req, res, next) => {
    try {
        const { id } = req.query;
        // if (!id) {
        //     return res.status(responseStatusCodes.badRequest).json({ success: false, message: responseMessages.invalidRequest });
        // }
        const ad = await Ad.findOne({ad_id:id}, {
            include: [{ model: AdImage, as: 'ad_images' }]
        });
        if (!ad) {
            // return res.status(responseStatusCodes.notFound).json({ success: false, message: responseMessages.adNotFound });
            return res.error(responseMessages.adNotFound, null, responseStatusCodes.notFound);
        }
        if (ad.ad_images && ad.ad_images.length > 0) {
            await Promise.all(ad.ad_images.map(async (img) => {
                await deleteImageFromS3(img.image);
            }));
        }
        await AdImage.destroy({ where: { ad_id: id } });
        await AdLocation.destroy({where: { ad_id: id } });
        await AdPriceDetails.destroy({where: { ad_id: id } });
        await AdViews.destroy({where: { ad_id: id } });
        await AdWishLists.destroy({where: { ad_id: id } });
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
                    .flatMap(adLoc => [adLoc.dataValues.locality, adLoc.dataValues.place, adLoc.dataValues.district, adLoc.dataValues.state, adLoc.dataValues.country])
                    .filter(Boolean)
            )
        );       
        return res.success(responseMessages.adLocationsFetched,{ data: adLocations, list: uniquePlaces})
    } catch (error) {
        return next(error);
    }
};

const generateUserId = () => {
  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 1000);
  const userId = `${timestamp}${randomNum}`;
  return parseInt(userId);
};

function generateAdId() {
  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 1000);
  const userId = `${timestamp}${randomNum}`;
  return parseInt(userId);
}

const createUserAdAdmin = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    let user = await User.findOne({ where: { mobile_number: `+91 ${phone}` } });
    if (user) {
        return res.success(responseMessages.adminusercreatedalready)
    }

    const newUser = await User.create({
      name: name || "User",
      user_id: generateUserId(),
      mobile_number: `+91 ${phone}`,
      is_logged: false
    });
    const db = admin.firestore();
    const privacyRef = db
      .collection("privacy")
      .doc(newUser.user_id.toString());

    await privacyRef.set({
      name: newUser.name,
      userId: newUser.user_id,
      privacy: false,
    });

    const ads = JSON.parse(req.body.ads);
    const location = JSON.parse(req.body.location);

    console.log(location)

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
        return {
            adIndex,
            promise: uploadToS3(file, fileName).then((res) => ({
                image: res.image,
            })),
        };
        // return {
        //   adIndex,
        //   promise: s3.send(command).then(() => ({
        //     image: fileName,
        //   })),
        // };
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
    console.log("...",ads)
    const usersToNotify = await User.findAll({
      attributes: ["notification_token"],
    });

    const tokens = usersToNotify
      .map(u => u.notification_token)
      .filter(Boolean);

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
        }
        else{
            await AdImage.create({
                ad_id,
                image: "1761544844899520_auto.png"
            })
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
    for (let index = 0; index < ads.length; index++) {
      const adData = ads[index];
      const ad_id = adIdMap[index];

      if (tokens.length === 0) {
        console.log("No users to notify");
        break;
      }

      const message = {
        notification: {
          title: "A Fresh Listing Awaits! 🔥",
          body: `New ad posted: "${adData.title}". Tap to view now!`,
        },
        data: {
          type: "adpost",
          ad_id: ad_id.toString(),
        },
        tokens,
      };

      try {
        await messaging.sendEachForMulticast(message);
      } catch (err) {
        console.error("FCM send error for ad", ad_id, err.message);
      }
    }
    return res.success(responseMessages.adminusercreated);
  } catch (error) {
    console.error(error);
    return next(error);
  }
};

module.exports = { getAdminAds, deleteAdminAd, getAllAdLocations, getAllUsers, blockUserById, createUserAdAdmin };
