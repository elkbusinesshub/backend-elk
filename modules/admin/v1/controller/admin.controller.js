const { Op } = require("sequelize");
const Ad = require("../../../../models/ad.model");
const AdLocation = require("../../../../models/adLocation.model");
const AdImage = require("../../../../models/adImage.model");
const AdPriceDetails = require("../../../../models/adPriceDetails.model");
const User = require("../../../../models/user.model");
const AdViews = require("../../../../models/adView.model");
const AdWishLists = require("../../../../models/adWishList.model");
const {
  responseStatusCodes,
  responseMessages,
} = require("../../../../helpers/appConstants");
const { deleteImageFromS3 } = require("../../../../helpers/utils");
require("dotenv").config();
const admin = require("../../../../helpers/firebase");
const messaging = admin.messaging();
const { getImageUrlPublic, uploadToS3, generateAdId, generateUserId } = require("../../../../helpers/utils");
const dayjs = require("dayjs");


//done
const getAdminAds = async (req, res, next) => {
  try {
    const { date, location, limit = 10, offset = 0 } = req.query;

    // Date filter
    const whereClause = date
      ? {
          createdAt: {
            [Op.between]: [
              dayjs(date).startOf("day").toDate(),
              dayjs(date).endOf("day").toDate(),
            ],
          },
        }
      : {};

    // Location filter
    const locationWhere = location
      ? {
          [Op.or]: ["locality", "place", "district", "state", "country"].map(
            (field) => ({ [field]: { [Op.like]: `%${location}%` } }),
          ),
        }
      : undefined;

    const { count, rows: ads } = await Ad.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "mobile_number", "profile"],
        },
        {
          model: AdImage,
          as: "ad_images",
          attributes: ["image"],
        },
        {
          model: AdPriceDetails,
          as: "ad_price_details",
          attributes: ["rent_price", "rent_duration"],
        },
        {
          model: AdLocation,
          as: "ad_location",
          where: locationWhere,
          required: !!location,
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true,
    });

    const adsWithUrls = ads.map((ad) => {
      const adObj = ad.toJSON();

      if (adObj.ad_images?.length) {
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
      data: adsWithUrls,
      total: count,
    });
  } catch (error) {
    return next(error);
  }
};

//done
const getAllUsers = async (req, res, next) => {
  try {
    const { limit = 10, offset = 0 } = req.query;

    const { count, rows: users } = await User.findAndCountAll({
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
        data: usersWithProfileUrls,
        total: count,
      }
    );
  } catch (error) {
    return next(error);
  }
};

//done
const blockUserById = async (req, res, next) => {
  try {
    const { id } = req.query;
    const user = await User.findOne({
      where: {
        user_id: id,
      },
    });
    if (!user) {
      // return res.status(responseStatusCodes.notFound).json({ success: false, message: responseMessages.urlNotFound });
      return res.error(
        responseMessages.userNotFound,
        null,
        responseStatusCodes.notFound,
      );
    }

    user.block_status = !user.block_status;
    await user.save();

    // return res.status(responseStatusCodes.success).json({ success: true, message: responseMessages.blockUser });
    return res.success(responseMessages.blockUser);
  } catch (error) {
    return next(error);
  }
};

//done
const deleteAdminAd = async (req, res, next) => {
    try {
        const { id } = req.query;

        const ad = await Ad.findOne({
            where: { ad_id: id },
            include: [{ model: AdImage, as: 'ad_images', attributes: ['image'] }]
        });

        if (!ad) {
            return res.error(responseMessages.adNotFound, null, responseStatusCodes.notFound);
        }

        if (ad.ad_images?.length) {
            await Promise.all(ad.ad_images.map(img => deleteImageFromS3(img.image)));
        }

        await Promise.all([
            AdImage.destroy({ where: { ad_id: id } }),
            AdLocation.destroy({ where: { ad_id: id } }),
            AdPriceDetails.destroy({ where: { ad_id: id } }),
            AdViews.destroy({ where: { ad_id: id } }),
            AdWishLists.destroy({ where: { ad_id: id } }),
        ]);

        await Ad.destroy({ where: { ad_id: id } });

        return res.success(responseMessages.adDeleted);

    } catch (error) {
        return next(error);
    }
};

//done
const getAllAdLocations = async (req, res, next) => {
    try {
        const adLocations = await AdLocation.findAll({
            attributes: ['locality', 'place', 'district', 'state', 'country']
        });

        const locationFields = ['locality', 'place', 'district', 'state', 'country'];
        const uniquePlaces = [
            ...new Set(
                adLocations.flatMap(adLoc =>
                    locationFields.map(field => adLoc[field])
                ).filter(Boolean)
            )
        ];
        return res.success(responseMessages.adLocationsFetched, {
            data: adLocations,
            list: uniquePlaces,
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
    const db = admin.firestore();
    const privacyRef = db.collection("privacy").doc(newUser.user_id.toString());

    await privacyRef.set({
      name: newUser.name,
      userId: newUser.user_id,
      privacy: false,
    });

    const ads = JSON.parse(req.body.ads);
    const location = JSON.parse(req.body.location);

    console.log(location);

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
    console.log("...", ads);
    const usersToNotify = await User.findAll({
      attributes: ["notification_token"],
    });

    const tokens = usersToNotify
      .map((u) => u.notification_token)
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

module.exports = {
  getAdminAds,
  deleteAdminAd,
  getAllAdLocations,
  getAllUsers,
  blockUserById,
  createUserAdAdmin,
};
