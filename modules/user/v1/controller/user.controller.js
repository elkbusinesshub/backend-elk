const User = require("../../../../models/user.model");
const Otp = require("../../../../models/otp.model");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const moment = require("moment");
const axios = require("axios");
const path = require("path");
require("dotenv").config();
const AdView = require("../../../../models/adView.model");
const AdImage = require("../../../../models/adImage.model");
const AdLocation = require("../../../../models/adLocation.model");
const Ad = require("../../../../models/ad.model");
const AdPriceDetails = require("../../../../models/adPriceDetails.model");
const AdWishLists = require("../../../../models/adWishList.model");
const ChatMessage = require("../../../../models/chatMessage.model");
const ChatRoom = require("../../../../models/chatRoom.model");
const ContactView = require("../../../../models/contactView.model");
const UserSearch = require("../../../../models/userSearch.model");
const crypto = require("crypto");
const {
  getImageUrl,
  uploadToS3,
  formatAd,
  formatPagination,
} = require("../../../../helpers/utils");
const {
  responseStatusCodes,
  messages,
} = require("../../../../helpers/appConstants");

const generateUserId = () => {
  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 1000);
  const userId = `${timestamp}${randomNum}`;
  return parseInt(userId);
};

const sendCurl = async (url) => {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    return null;
  }
};

const generateRandomString = () => Math.random().toString(36).substring(2, 15);

const sendSangamamOtp = async (mobile, otp) => {
  const messageContent = `Your OTP for ELK is: ${otp}. Do not share this OTP with anyone.`;
  const message = encodeURIComponent(messageContent);
  const expire = Math.floor(Date.now() / 1000) + 120;
  const timeKey = crypto
    .createHash("md5")
    .update("send-sms" + "sms@rits-v1.0" + expire)
    .digest("hex");
  const timeAccessTokenKey = crypto
    .createHash("md5")
    .update(process.env.SMS_ACCESS_TOKEN + timeKey)
    .digest("hex");
  const signature = crypto
    .createHash("md5")
    .update(timeAccessTokenKey + process.env.SMS_ACCESS_TOKEN_KEY)
    .digest("hex");
  const route = "transactional";
  const authSignature = signature;
  const smsHeader = "SGMOLN";
  const countryCode = "+91";
  const url = `https://fastsms.sangamamonline.in/api/sms/v1.0/send-sms?accessToken=${process.env.SMS_ACCESS_TOKEN}&expire=${expire}&authSignature=${authSignature}&route=${route}&smsHeader=${smsHeader}&messageContent=${message}&recipients=${mobile}&contentType=text&removeDuplicateNumbers=1&countryCode=${countryCode}`;
  return await sendCurl(url);
};

const createUser = async (req, res) => {
  const { name, uuid, email } = req.body;
  try {
    let user;
    if (email) {
      user = await User.findOne({ where: { email: email } });
      if (user) {
        let profileUrl;
        if (user.profile) {
          profileUrl = await getImageUrl(user.profile);
        }
        const token = jwt.sign(
          { id: user.user_id },
          process.env.ACCESS_TOKEN_SECRET
        );
        // user.token = token;
        await user.save();
        return res.success(messages.userLogged, {
          user_id: user.user_id,
          name: user.name,
          token: token,
          profile: profileUrl,
          mobile_number: user.mobile_number,
          email: user.email,
          description: user.description,
          is_admin: user.is_admin,
        });
      } else {
        user = new User({
          name,
          user_id: generateUserId(),
          email,
          email_uid: uuid,
        });
        await user.save();
        const token = jwt.sign(
          { id: user.user_id },
          process.env.ACCESS_TOKEN_SECRET
        );
        // user.token = token;
        await user.save();
        return res.success(messages.userLogged, {
          user_id: user.user_id,
          name: user.name,
          token: token,
          profile: user.profile,
          mobile_number: user.mobile_number,
          email: user.email,
          description: user.description,
          is_admin: user.is_admin,
        });
      }
    }
  } catch (error) {
    console.error("Error in creating user", error);
    return next(error);
  }
};

const sendOtp = async (req, res) => {
  try {
    const { mobile } = req.body;
    const limits = 50;
    const otpRequestsCount = await Otp.count({
      where: {
        mobile: mobile,
        createdAt: { [Op.gte]: moment().subtract(1, "day").toDate() },
      },
    });
    if (otpRequestsCount > limits) {
      return res
        .status(429)
        .json({ message: "Otp limit reached, please try again later" });
    }
    const otp = Math.floor(100000 + Math.random() * 900000);
    const verificationId = generateRandomString();
    await sendSangamamOtp(mobile.slice(-10), otp);
    await Otp.create({
      mobile: mobile,
      verification_id: verificationId,
      otp: otp,
    });

    return res.success(messages.otpSend, { verificationId: verificationId });
  } catch (error) {
    console.error("Error sending otp", error);
    return next(error);
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { verificationId, otp, name } = req.body;
    const otpRecord = await Otp.findOne({
      where: { verification_id: verificationId, otp: otp },
    });
    if (!otpRecord) {
      // return res
      //   .status(responseStatusCodes.notFound)
      //   .json({ message: "Invalid OTP" });
      return res.error(
        messages.otpNotFound,
        null,
        responseStatusCodes.notFound
      );
    }

    const currentTime = moment();
    const otpTime = moment(otpRecord.createdAt);

    if (currentTime.diff(otpTime, "minutes") > 10) {
      // await Otp.destroy({ where: { id: otpRecord.id } });
      // return res.status(410).json({ message: "OTP Expired" });
      return res.error(messages.otpExpired, {}, 410);
    }
    let user = await User.findOne({
      where: { mobile_number: otpRecord.mobile },
    });
    if (user) {
      const token = jwt.sign(
        { id: user.user_id },
        process.env.ACCESS_TOKEN_SECRET
      );
      user.set("token", token);
      let profileUrl;
      if (user.profile) {
        profileUrl = await getImageUrl(user.profile);
      }
      user.profile = profileUrl;

      return res.success(messages.userLogged, {
        user_id: user.user_id,
        name: user.name,
        mobile_number: user.mobile_number,
        token: token,
        profile: user.profile,
      });
    } else {
      const newUser = await User.create({
        name: name || "User",
        user_id: generateUserId(),
        mobile_number: otpRecord.mobile,
      });
      const token = jwt.sign(
        { id: newUser.user_id },
        process.env.ACCESS_TOKEN_SECRET
      );
      newUser.set("token", token);
      newUser.token = token;
      await newUser.save();
      return res.success(messages.userRegistered, {
        user_id: newUser.user_id,
        name: newUser.name,
        mobile_number: newUser.mobile_number,
        token: token,
        profile: newUser.profile,
      });
    }
  } catch (error) {
    console.error("Error in create user", error);
    return next(error);
  }
};

const verifyUpdateMobileOtp = async (req, res) => {
  try {
    const { verificationId, otp } = req.body;
    const otpRecord = await Otp.findOne({
      where: { verification_id: verificationId, otp: otp },
    });
    if (!otpRecord) {
      return res.error(messages.otpNotFound, {}, responseStatusCodes.notFound);
    }
    const currentTime = moment();
    const otpTime = moment(otpRecord.createdAt);
    if (currentTime.diff(otpTime, "minutes") > 10) {
      return res.error(messages.otpExpired, {}, 410);
    }
    // return res.json({ message: "Mobile number updated" });
    return res.succes(messages.mobileUpdated);
  } catch (error) {
    return next(error);
  }
};

const getUserById = async (req, res) => {
  const id = req.query.id;
  try {
    const user = await User.findOne({ where: { user_id: id } });
    if (!user) {
      return res.error(
        messages.userNotFound,
        null,
        responseStatusCodes.notFound
      );
    }
    let profileUrl;
    if (user.profile) {
      profileUrl = await getImageUrl(user.profile);
    }
    user.profile = profileUrl;
    // res.status(responseStatusCodes.success).send(user);
    res.success(messages.userDetails, user);
  } catch (err) {
    console.error("Error in fetching user details", err);
    return next(err);
  }
};

const updateProfilePic = async (req, res) => {
  const id = req.query.id;
  const fileExtension = path.extname(req.file.originalname);
  const fileName = `${id}${fileExtension}`;
  try {
    const uploaded = await uploadToS3(req.file, fileName);
    if (!uploaded) {
      // return res.status(500).json({ message: "Profile picture upload failed" });
      return res.error(messages.profileUpdateFailed);
    }
    const user = await User.findOne({ where: { user_id: id } });
    user.profile = fileName;
    await user.save();
    let profileUrl;
    profileUrl = await getImageUrl(user.profile);
    return res.success(messages.profileUpdateSuccessfully, { url: profileUrl });
  } catch (e) {
    console.error("Error in updatong profile: ", e);
    return next(e);
  }
};

const updateEmailOrMobile = async (req, res) => {
  try {
    const { email, mobile, uid, user_id } = req.body;
    let user = await User.findOne({ where: { user_id: user_id } });
    if (!user) {
      return res.error(messages.userNotFound, {}, responseStatusCodes.notFound);
    }
    if (mobile) {
      user.mobile_number = mobile;
      await user.save();
      return res.success(messages.mobileUpdated);
    }
    if (email && uid) {
      user.email = email;
      user.email_uid = uid;
      await user.save();
      return res.success(messages.emailUpdated);
    }
    return res.error(messages.somethingwentWrong);
  } catch (error) {
    return next(error);
  }
};

const updateProfile = async (req, res) => {
  const { name, description, user_id } = req.body;
  try {
    let user = await User.findOne({ where: { user_id: user_id } });
    if (!user) {
      // return res
      //   .status(responseStatusCodes.notFound)
      //   .json({ success: false, message: "User not found" });
      return res.error(messages.userNotFound, {}, responseStatusCodes.notFound);
    }
    user.name = name;
    user.description = description;
    await user.save();
    return res.success(messages.profileUpdateSuccessfully);
  } catch (error) {
    return next(error);
  }
};

const deleteAccount = async (req, res) => {
  const { user_id } = req.query;
  try {
    const ads = await Ad.findAll({ where: { user_id: user_id } });
    for (const ad of ads) {
      await AdImage.destroy({ where: { ad_id: ad.ad_id } });
      await AdLocation.destroy({ where: { ad_id: ad.ad_id } });
      await AdPriceDetails.destroy({ where: { ad_id: ad.ad_id } });
      await AdWishLists.destroy({ where: { ad_id: ad.ad_id } });
      await AdView.destroy({ where: { ad_id: ad.ad_id } });
    }
    await Ad.destroy({ where: { user_id } });

    await ChatMessage.destroy({
      where: {
        [Op.or]: [{ sender_id: user_id }, { reciever_id: user_id }],
      },
    });
    await ChatRoom.destroy({
      where: {
        [Op.or]: [{ user1: user_id }, { user2: user_id }],
      },
    });
    await ContactView.destroy({
      where: {
        [Op.or]: [{ user_id: user_id }, { viewer_id: user_id }],
      },
    });
    await UserSearch.destroy({ where: { user_id: user_id } });
    const deletedUser = await User.destroy({ where: { user_id: user_id } });
    if (!deletedUser) {
      return res.error(messages.userNotFound);
    }
    return res.success(messages.userDeleted);
  } catch (error) {
    return next(error);
  }
};

const updateNotificationToken = async (req, res) => {
  try {
    const { notification_token } = req.body;
    const userId = req.user.id;
    const user = await User.findOne({ where: { user_id: userId } });
    if (!user) {
      return res.error(messages.userNotFound);
    }
    user.notification_token = notification_token;
    await user.save();
    res.success(messages.tokenUpdated);
  } catch (error) {
    res;
    return next(error);
  }
};

const userWithAds = async (req, res, next) => {
  try {
    const { user_id } = req.body;
    const user = await User.findOne({
      where: { user_id },
      include: [
        {
          model: Ad,
          as: "ads",
          include: [
            { model: AdImage, as: "ad_images" },
            { model: AdLocation, as: "ad_location" },
            { model: AdPriceDetails, as: "ad_price_details" },
          ],
        },
      ],
      nest: true,
    });
    if (!user) {
      return res.error(messages.userNotFound);
    }
    const formattedAds = await Promise.all(ads.map((ad) => formatAd(ad)));
    const fullUrl = `${req.protocol}://${req.get("host")}${
      req.originalUrl.split("?")[0]
    }`;
    const pagination = formatPagination({
      page: Number(page),
      perPage,
      total: count,
      path: fullUrl,
    });

    const response = {
      id: user.id,
      user_id: user.user_id,
      name: user.name,
      email_uid: user.email_uid,
      profile: user.profile ? await getImageUrl(user.profile) : null,
      description: user.description,
      notification_token: user.notification_token,
      ads: formattedAds,
      ...pagination,
    };
    return res.success(messages.userDetails, response);
  } catch (error) {
    return next(error);
  }
};

const userWishlists = async (req, res, next) => {
  try {
    const userId = req.user;
    const wishlist = await AdWishLists.findAll({
      where: { user_id: userId.id },
      attributes: ["ad_id"],
    });
    const ads = [];
    const adIds = wishlist.map((w) => w.ad_id);
    for (i in adIds) {
      const ad = await Ad.findOne({
        where: { ad_id: adIds[i] },
        include: [
          { model: User, as: "user" },
          { model: AdImage, as: "ad_images" },
          { model: AdLocation, as: "ad_location" },
          { model: AdPriceDetails, as: "ad_price_details" },
        ],
        nest: true,
      });
      ads.push(formatAd(ad));
    }
    return res.success(messages.userWishlistFetched, ads);
  } catch (error) {
    return next(error);
  }
};

exports.userWishlists = async (req, res, next) => {
  try {
    const userId = req.user;
    const wishlist = await AdWishLists.findAll({
      where: { user_id: userId.id },
      attributes: ["ad_id"],
    });
    const ads = [];
    const adIds = wishlist.map((w) => w.ad_id);

    for (i in adIds) {
      const ad = await Ad.findOne({
        where: { ad_id: adIds[i] },
        include: [
          { model: User, as: "user" },
          { model: AdImage, as: "ad_images" },
          { model: AdLocation, as: "ad_location" },
          { model: AdPriceDetails, as: "ad_price_details" },
        ],
        nest: true,
      });
      const response = {
        id: ad.ad_id,
        ad_id: ad.ad_id,
        user_id: ad.user_id,
        title: ad.title,
        category: ad.category,
        description: ad.description,
        ad_type: ad.ad_type,
        ad_status: ad.ad_status,
        ad_stage: ad.ad_stage,
        createdAt: ad.createdAt.toISOString(),
        updatedAt: ad.updatedAt.toISOString(),
        ad_price_details: ad.ad_price_details.map((priceDetail) => ({
          id: priceDetail.id,
          ad_id: priceDetail.ad_id,
          rent_duration: priceDetail.rent_duration,
          rent_price: priceDetail.rent_price,
          createdAt: priceDetail.createdAt.toISOString(),
          updatedAt: priceDetail.updatedAt.toISOString(),
        })),
        ad_images: await Promise.all(
          ad.ad_images.map(async (image) => {
            return {
              id: image.id,
              ad_id: image.ad_id,
              image: image.image ? await getImageUrl(image.image) : null,
              createdAt: image.createdAt.toISOString(),
              updatedAt: image.updatedAt.toISOString(),
            };
          })
        ),
        ad_location: {
          id: ad.ad_location.id,
          ad_id: ad.ad_location.ad_id,
          locality: ad.ad_location.locality,
          place: ad.ad_location.place,
          district: ad.ad_location.district,
          state: ad.ad_location.state,
          country: ad.ad_location.country,
          longitude: `${ad.ad_location.longitude}`,
          latitude: `${ad.ad_location.latitude}`,
          createdAt: ad.ad_location.createdAt.toISOString(),
          updatedAt: ad.ad_location.updatedAt.toISOString(),
        },
        user: {
          id: ad.user.id,
          user_id: ad.user.user_id,
          // is_guest: ad.user.is_guest,
          name: ad.user.name,
          email: ad.user.email,
          email_uid: ad.user.email_uid,
          mobile_number: ad.user.mobile_number,
          profile: ad.user.profile ? await getImageUrl(ad.user.profile) : null,
          description: ad.user.description,
          notification_token: ad.user.notification_token,
          token: ad.user.token,
        },
      };
      ads.push(response);
    }
    return res.success(messages.userWishlistFetched, ads);
  } catch (error) {
    return next(error);
    
  }
};

const removeWishlist = async (req, res, next) => {
  try {
    const { ad_id } = req.body;
    const userId = req.user.id;
    const wishlistItem = await AdWishLists.findOne({
      where: {
        user_id: userId,
        ad_id: ad_id,
      },
    });
    if (wishlistItem) {
      await wishlistItem.destroy();
      return res.success(messages.wishlistRemoved);
    } else {
      return res.success(messages.wishlistAlreadyRemoved);
    }
  } catch (error) {
    return next(error);
  }
};

const viewContact = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const viewerId = req.user.id;
    const user = await User.findOne({ where: { user_id: userId } });
    if (!user) {
      return res.error(messages.userNotFound);
    }
    let profileUrl;
    if (user.profile) {
      profileUrl = await getImageUrl(user.profile);
    }
    user.profile = profileUrl;
    user.authUserId = viewerId;
    await ContactView.create({
      user_id: userId,
      viewer_id: viewerId,
    });
    const response = {
      id: user.id,
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      email_uid: user.email_uid,
      mobile_number: user.mobile_number,
      description: user.description,
      notification_token: user.notification_token,
      profile: profileUrl ?? null,
      authUserId: viewerId,
    };
    return res.success(messages.userDetails, response);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  sendOtp,
  viewContact,
  removeWishlist,
  userWishlists,
  userWithAds,
  updateNotificationToken,
  deleteAccount,
  verifyOtp,
  verifyUpdateMobileOtp,
  updateEmailOrMobile,
  updateProfile,
  createUser,
  getUserById,
  updateProfilePic,
  viewContact,
};
