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
const ReferralCode = require("../../../../models/referralCode.model");
const ReferralCodeLogin = require("../../../../models/referralCodeLogin.model");
const ReportUser = require("../../../../models/reportUser.model");
const crypto = require("crypto");
const BlockedUser = require("../../../../models/blockedUser.model");

const {
  getImageUrlPublic,
  uploadToS3,
  formatAd,
  formatPagination,
  getImageUrl,
} = require("../../../../helpers/utils");
const {
  responseStatusCodes,
  responseMessages,
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

exports.createUser = async (req, res, next) => {
  const { name, uuid, mobile, email, referralCode } = req.body;
  if (!mobile && !email) {
    return res.error(responseMessages.invalidRequest);
    // return res.status(responseStatusCodes.badRequest).json({ message: responseMessages.invalidRequest });
  }
  if (!name || !uuid) {
    return res.error(responseMessages.invalidRequest);
    // return res.status(responseStatusCodes.badRequest).json({ message: responseMessages.invalidRequest });
  }
  try {
    let user;
    if (email) {
      user = await User.findOne({
        where: { email: email },
        include: [
          {
            model: ReferralCode,
            as: "referral_code",
            attributes: ["referral_code"],
          },
        ],
      });
      if (user) {
        if (!user.referral_code) {
          const newCode = generateReferralCode();
          await ReferralCode.create({
            user_id: user.user_id,
            referral_code: newCode,
          });
          user.referral_code = { referral_code: newCode };
        }
        let profileUrl;
        if (user.profile) {
          profileUrl = getImageUrlPublic(user.profile);
        }
        const token = jwt.sign(
          { id: user.user_id },
          process.env.ACCESS_TOKEN_SECRET,
        );
        await user.save();

        // return res.status(responseStatusCodes.success).json({
        //     success: true,
        //     message: responseMessages.userLogged,
        //     data: {
        //         user_id:user.user_id,
        //         name:user.name,
        //         token: token,
        //         profile: profileUrl,
        //         mobile_number: user.mobile_number,
        //         email:user.email,
        //         referral_code: user.referral_code?.referral_code || '',
        //         description:user.description,
        //         is_admin: user.is_admin
        //     }
        // });
        return res.success(responseMessages.userLogged, {
          user_id: user.user_id,
          name: user.name,
          token: token,
          profile: profileUrl,
          mobile_number: user.mobile_number,
          email: user.email,
          referral_code: user.referral_code?.referral_code || "",
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
          process.env.ACCESS_TOKEN_SECRET,
        );
        let newReferralCode = generateReferralCode();
        await ReferralCode.create({
          user_id: user.user_id,
          referral_code: newReferralCode,
        });
        if (referralCode && referralCode !== "") {
          const referralOwner = await ReferralCode.findOne({
            where: { referral_code: referralCode },
          });
          const referrerId = referralOwner.user_id;
          if (referrerId === user.user_id) {
            return res
              .status(responseStatusCodes.badRequest)
              .json({ message: responseMessages.referralError });
          }
          if (referralOwner) {
            const referredUserId = referralOwner.user_id;
            const loginUserId = user.user_id;
            const existingRef = await ReferralCodeLogin.findOne({
              where: { login_id: loginUserId },
            });

            if (!existingRef) {
              await ReferralCodeLogin.create({
                refered_id: referredUserId,
                login_id: loginUserId,
              });
            }
          }
        }
        // return res.status(responseStatusCodes.success).json({
        //   success: true,
        //   message: responseMessages.userLogged,
        //   data: {
        //     user_id: user.user_id,
        //     name: user.name,
        //     token: token,
        //     profile: user.profile,
        //     mobile_number: user.mobile_number,
        //     email: user.email,
        //     referral_code: newReferralCode,
        //     description: user.description,
        //     is_admin: user.is_admin,
        //   },
        // });
        return res.success(responseMessages.userLogged, {
          user_id: user.user_id,
          name: user.name,
          token: token,
          profile: user.profile,
          mobile_number: user.mobile_number,
          email: user.email,
          referral_code: newReferralCode,
          description: user.description,
          is_admin: user.is_admin,
        });
      }
    }
  } catch (error) {
    // return res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ message: responseMessages.internalServerError, error });
    return next(error);
  }
};

exports.addReferralLogin = async (req, res, next) => {
  try {
    const { referralCode, login_user_id } = req.body;
    if (!referralCode || !login_user_id) {
      //   return res
      //     .status(responseStatusCodes.badRequest)
      //     .json({ message: responseMessages.invalidRequest });
      return res.error(responseMessages.invalidRequest);
    }
    const referralOwner = await ReferralCode.findOne({
      where: { referral_code: referralCode },
    });
    if (!referralOwner) {
      //   return res
      //     .status(responseStatusCodes.badRequest)
      //     .json({ message: responseMessages.invalidReferralCode });
      return res.error(responseMessages.invalidReferralCode);
    }
    const referrerId = referralOwner.user_id;
    if (referrerId === login_user_id) {
      //   return res
      //     .status(responseStatusCodes.badRequest)
      //     .json({ message: responseMessages.referralError });
      return res.error(responseMessages.referralError);
    }
    const existingUsage = await ReferralCodeLogin.findOne({
      where: { login_id: login_user_id },
    });
    if (existingUsage) {
      //   return res.status(responseStatusCodes.success).json({
      //     message: responseMessages.referralSuccessAlready,
      //     success: true,
      //     data: existingUsage,
      //   });
      return res.success(
        responseMessages.referralSuccessAlready,
        existingUsage,
      );
    }
    const newReferralLog = await ReferralCodeLogin.create({
      refered_id: referrerId,
      login_id: login_user_id,
    });
    // return res.status(responseStatusCodes.created).json({
    //   success: true,
    //   message: responseMessages.referralSuccess,
    //   data: newReferralLog,
    // });
    return res.success(responseMessages.referralSuccess, newReferralLog);
  } catch (error) {
    // return res.status(responseStatusCodes.internalServerError).json({
    //   message: responseMessages.internalServerError,
    //   error,
    // });
    return next(error);
  }
};

exports.sendOtp = async (req, res, next) => {
  try {
    const { mobile } = req.body;
    // if (!mobile) {
    //   return res
    //     .status(responseStatusCodes.badRequest)
    //     .json({ message: responseMessages.invalidRequest });
    // }
    const limits = 50;
    const otpRequestsCount = await Otp.count({
      where: {
        mobile: mobile,
        createdAt: { [Op.gte]: moment().subtract(1, "day").toDate() },
      },
    });
    if (otpRequestsCount > limits) {
      //   return res.status(429).json({ message: responseMessages.otpLimit });
      return res.error(responseMessages.otpLimit);
    }
    const verificationId = generateRandomString();
    let otp;
    if (
      mobile == "9999999999" ||
      mobile == "919999999999" ||
      mobile == "+91 9999999999"
    ) {
      otp = 123456;
    } else {
      otp = Math.floor(100000 + Math.random() * 900000);
      await sendSangamamOtp(mobile.slice(-10), otp);
    }
    await Otp.create({
      mobile: mobile,
      verification_id: verificationId,
      otp: otp,
    });
    // res.json({
    //   message: responseMessages.otpSend,
    //   verificationId: verificationId,
    // });
    return res.success(responseMessages.otpSend, { verificationId });
  } catch (error) {
    // res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ message: responseMessages.internalServerError });
    return next(error);
  }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    const { verificationId, otp, name, referralCode } = req.body;
    if (!verificationId || !otp) {
      //   return res
      //     .status(responseStatusCodes.badRequest)
      //     .json({ message: responseMessages.invalidRequest });
      return res.error(responseMessages.invalidRequest);
    }
    const otpRecord = await Otp.findOne({
      where: { verification_id: verificationId, otp: otp },
    });
    if (!otpRecord) {
      //   return res
      //     .status(responseStatusCodes.badRequest)
      //     .json({ message: responseMessages.InvalidOtp });
      return res.error(responseMessages.InvalidOtp);
    }

    const currentTime = moment();
    const otpTime = moment(otpRecord.createdAt);

    if (currentTime.diff(otpTime, "minutes") > 10) {
      // await Otp.destroy({ where: { id: otpRecord.id } });
      //   return res.status(410).json({ message: responseMessages.otpExpired });
      return res.error(responseMessages.otpExpired);
    }
    let user = await User.findOne({
      where: { mobile_number: otpRecord.mobile },
    });
    if (user) {
      if (!user.referral_code) {
        let existing = await ReferralCode.findOne({
          where: { user_id: user.user_id },
        });

        if (!existing) {
          const newCode = generateReferralCode();
          existing = await ReferralCode.create({
            user_id: user.user_id,
            referral_code: newCode,
          });
        }
        user.referral_code = existing;
      }
      const token = jwt.sign(
        { id: user.user_id },
        process.env.ACCESS_TOKEN_SECRET,
      );
      user.set("token", token);
      let profileUrl;
      if (user.profile) {
        profileUrl = getImageUrlPublic(user.profile);
      }
      user.profile = profileUrl;
      //   return res.status(responseStatusCodes.success).json({
      //     success: true,
      //     message: responseMessages.userLogged,
      //     data: {
      //       user_id: user.user_id,
      //       name: user.name,
      //       mobile_number: user.mobile_number,
      //       token: token,
      //       profile: user.profile,
      //       referral_code: user.referral_code?.referral_code || "",
      //     },
      //   });
      return res.success(responseMessages.userLogged, {
        user_id: user.user_id,
        name: user.name,
        mobile_number: user.mobile_number,
        token: token,
        profile: user.profile,
        referral_code: user.referral_code?.referral_code || "",
      });
    } else {
      const newUser = await User.create({
        name: name || "User",
        user_id: generateUserId(),
        mobile_number: otpRecord.mobile,
      });
      let newReferralCode = generateReferralCode();
      await ReferralCode.create({
        user_id: newUser.user_id,
        referral_code: newReferralCode,
      });
      const token = jwt.sign(
        { id: newUser.user_id },
        process.env.ACCESS_TOKEN_SECRET,
      );
      await newUser.save();
      if (referralCode && referralCode !== "") {
        const referralOwner = await ReferralCode.findOne({
          where: { referral_code: referralCode },
        });
        const referrerId = referralOwner.user_id;
        if (referrerId === newUser.user_id) {
          return res
            .status(responseStatusCodes.badRequest)
            .json({ message: responseMessages.referralError });
        }
        if (referralOwner) {
          const referredUserId = referralOwner.user_id;
          const loginUserId = newUser.user_id;
          const existingRef = await ReferralCodeLogin.findOne({
            where: { login_id: loginUserId },
          });

          if (!existingRef) {
            await ReferralCodeLogin.create({
              refered_id: referredUserId,
              login_id: loginUserId,
            });
          }
        }
      }
      //   return res.status(responseStatusCodes.success).json({
      //     success: true,
      //     message: responseMessages.userLogged,
      //     data: {
      //       user_id: newUser.user_id,
      //       name: newUser.name,
      //       mobile_number: newUser.mobile_number,
      //       token: token,
      //       profile: newUser.profile,
      //       referral_code: newReferralCode,
      //     },
      //   });
      return res.success(responseMessages.userLogged, {
        user_id: newUser.user_id,
        name: newUser.name,
        mobile_number: newUser.mobile_number,
        token: token,
        profile: newUser.profile,
        referral_code: newReferralCode,
      });
    }
  } catch (error) {
    // res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ message: responseMessages.internalServerError });
    return next(error);
  }
};

exports.verifyUpdateMobileOtp = async (req, res, next) => {
  try {
    const { verificationId, otp } = req.body;
    if (!verificationId || !otp) {
      //   return res
      //     .status(responseStatusCodes.badRequest)
      //     .json({ message: responseMessages.invalidRequest });
      return res.error(responseMessages.invalidRequest);
    }
    const otpRecord = await Otp.findOne({
      where: { verification_id: verificationId, otp: otp },
    });
    if (!otpRecord) {
      //   return res
      //     .status(responseStatusCodes.badRequest)
      //     .json({ message: responseMessages.InvalidOtp });
      return res.error(responseMessages.InvalidOtp);
    }
    const currentTime = moment();
    const otpTime = moment(otpRecord.createdAt);
    if (currentTime.diff(otpTime, "minutes") > 10) {
      // return res.status(410).json({ message: responseMessages.otpExpired });
      return res.error(responseMessages.otpExpired);
    }
    // return res.json({ message: responseMessages.mobileUpdated });
    return res.success(responseMessages.mobileUpdated);
  } catch (error) {
    // res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ message: responseMessages.internalServerError });
    return next(error);
  }
};

exports.getUserById = async (req, res, next) => {
  const id = req.query.id;
  try {
    const user = await User.findOne({ where: { user_id: id } });
    if (!user) {
      //   return res
      //     .status(responseStatusCodes.badRequest)
      //     .send({ message: responseMessages.userNotFound });
      return res.error(responseMessages.userNotFound);
    }
    let profileUrl;
    if (user.profile) {
      profileUrl = getImageUrlPublic(user.profile);
    }
    user.profile = profileUrl;
    // res.status(responseStatusCodes.success).send(user);
    res.success(responseMessages.userDetails, user);
  } catch (err) {
    // res
    //   .status(responseStatusCodes.internalServerError)
    //   .send({ message: responseMessages.internalServerError });
    return next(err);
  }
};

exports.updateProfilePic = async (req, res, next) => {
  const id = req.query.id;
  const fileExtension = path.extname(req.file.originalname);
  const fileName = `${id}${fileExtension}`;
  try {
    await uploadToS3(req.file, fileName);
    const user = await User.findOne({ where: { user_id: id } });
    user.profile = fileName;
    await user.save();
    let profileUrl;
    profileUrl = getImageUrlPublic(user.profile);
    // res
    //   .status(responseStatusCodes.success)
    //   .json({ success: true, data: profileUrl });
    return res.success(responseMessages.profileUpdateSuccessfully, profileUrl);
  } catch (e) {
    // res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ success: false, message: responseMessages.internalServerError });
    return next(error);
  }
};

exports.updateEmailOrMobile = async (req, res, next) => {
  try {
    const { email, mobile, uid, user_id } = req.body;
    if (!email && !mobile) {
      //   return res
      //     .status(responseStatusCodes.badRequest)
      //     .json({ success: false, message: responseMessages.invalidRequest });
      return res.error(responseMessages.invalidRequest);
    }
    let user = await User.findOne({ where: { user_id: user_id } });
    if (!user) {
      //   return res
      //     .status(responseStatusCodes.badRequest)
      //     .json({ success: false, message: responseMessages.userNotFound });
      return res.error(responseMessages.userNotFound);
    }
    if (mobile) {
      user.mobile_number = mobile;
      await user.save();
      //   return res.json({
      //     success: true,
      //     message: responseMessages.mobileUpdated,
      //   });
      return res.success(responseMessages.mobileUpdated);
    }
    if (email && uid) {
      user.email = email;
      user.email_uid = uid;
      //   await user.save();
      //   return res.json({
      //     success: true,
      //     message: responseMessages.emailUpdated,
      //   });
      return res.success(responseMessages.emailUpdated);
    }
    // return res
    //   .status(responseStatusCodes.badRequest)
    //   .json({ success: false, message: responseMessages.invalidRequest });
    return res.error(responseMessages.invalidRequest);
  } catch (error) {
    // return res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ success: false, message: responseMessages.internalServerError });
    return next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  const { name, description, user_id } = req.body;
  try {
    if (!name && !description) {
      //   return res
      //     .status(responseStatusCodes.badRequest)
      //     .json({ success: false, message: responseMessages.invalidRequest });
      return res.error(responseMessages.invalidRequest);
    }
    let user = await User.findOne({ where: { user_id: user_id } });
    if (!user) {
      //   return res
      //     .status(responseStatusCodes.badRequest)
      //     .json({ success: false, message: responseMessages.userNotFound });
      return res.error(responseMessages.userNotFound);
    }
    user.name = name;
    user.description = description;
    await user.save();
    // return res.status(responseStatusCodes.success).json({
    //   success: true,
    //   message: responseMessages.profileUpdateSuccessfully,
    // });
    return res.success(responseMessages.profileUpdateSuccessfully);
  } catch (error) {
    // return res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ success: false, message: responseMessages.internalServerError });
    return next(error);
  }
};

exports.deleteAccount = async (req, res, next) => {
  const { user_id } = req.query;

  if (!user_id) {
    // return res
    //   .status(responseStatusCodes.badRequest)
    //   .json({ success: false, message: responseMessages.invalidRequest });
    return res.error(responseMessages.invalidRequest);
  }

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
      //   return res
      //     .status(responseStatusCodes.badRequest)
      //     .json({ success: false, message: responseMessages.userNotFound });
      return res.error(responseMessages.userNotFound);
    }
    // return res
    //   .status(responseStatusCodes.success)
    //   .json({ success: true, message: responseMessages.userDeleted });
    return res.success(responseMessages.userDeleted);
  } catch (error) {
    // return res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ success: false, message: responseMessages.internalServerError });
    return next(error);
  }
};

exports.updateNotificationToken = async (req, res, next) => {
  try {
    const { notification_token } = req.body;

    // if (!notification_token) {
    //   return res
    //     .status(responseStatusCodes.badRequest)
    //     .json({ message: responseMessages.invalidRequest });
    // }
    const userId = req.user.id;
    const user = await User.findOne({ where: { user_id: userId } });
    if (!user) {
      //   return res
      //     .status(responseStatusCodes.badRequest)
      //     .json({ message: responseMessages.userNotFound });
      return res.error(responseMessages.userNotFound);
    }
    user.notification_token = notification_token;
    await user.save();
    // res.json({ message: responseMessages.tokenUpdated });
    return res.success(responseMessages.tokenUpdated);
  } catch (error) {
    // res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ message: responseMessages.internalServerError });
    return next(error);
  }
};

exports.userWithAds = async (req, res, next) => {
  try {
    const { user_id } = req.body;
    // if (!user_id) {
    //   return res
    //     .status(responseStatusCodes.badRequest)
    //     .json({ message: responseMessages.invalidRequest });
    // }
    const user = await User.findOne({
      where: { user_id },
      include: [
        {
          model: Ad,
          as: "ads",
          where: {
            ad_stage: 3,
          },
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
      //   return res
      //     .status(responseStatusCodes.badRequest)
      //     .json({ message: responseMessages.userNotFound });
      return res.error(responseMessages.userNotFound);
    }
    const formattedAds = await Promise.all(
      user.dataValues.ads.map((ad) => formatAd(ad)),
    );
    const fullUrl = `${req.protocol}://${req.get("host")}${
      req.originalUrl.split("?")[0]
    }`;
    const ads = user.ads || [];
    const adCount = ads.length;

    const pagination = formatPagination({
      page: 1,
      perPage: 10,
      total: adCount,
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
    // return res.status(responseStatusCodes.success).json(response);
    return res.success(responseMessages.adDetails, response);
  } catch (error) {
    // return res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ message: responseMessages.internalServerError });
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
    const adIds = wishlist.map((w) => w.ad_id);

    const ads = await Promise.all(
      adIds.map(async (adId) => {
        const ad = await Ad.findOne({
          where: {
            ad_id: adId,
            ad_stage: 3,
          },
          include: [
            { model: User, as: "user" },
            { model: AdImage, as: "ad_images" },
            { model: AdLocation, as: "ad_location" },
            { model: AdPriceDetails, as: "ad_price_details" },
          ],
          nest: true,
        });

        if (!ad) return null;

        return await formatAd(ad);
      }),
    );

    // remove null ads (if any)
    const filteredAds = ads.filter(Boolean);

    return res.success(responseMessages.userWishlistFetched, filteredAds);
    // res.status(responseStatusCodes.success).json(ads);
    
  } catch (error) {
    // res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ message: responseMessages.internalServerError });
    return next(error);
  }
};

exports.removeWishlist = async (req, res, next) => {
  try {
    const { ad_id } = req.body;
    // if (!ad_id) {
    //   return res
    //     .status(responseStatusCodes.badRequest)
    //     .json({ message: responseMessages.invalidRequest });
    // }
    const userId = req.user.id;

    const wishlistItem = await AdWishLists.findOne({
      where: {
        user_id: userId,
        ad_id: ad_id,
      },
    });
    if (wishlistItem) {
      await wishlistItem.destroy();
      //   return res.json({ message: responseMessages.wishlistRemoved });
      return res.success(responseMessages.wishlistRemoved);
    } else {
      //   return res.json({ message: responseMessages.wishlistAlreadyRemoved });
      return res.success(responseMessages.wishlistAlreadyRemoved);
    }
  } catch (error) {
    // return res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ message: responseMessages.internalServerError });
    return next(error);
  }
};

exports.viewContact = async (req, res, next) => {
  try {
    const { userId } = req.body;
    // if (!userId) {
    //   return res
    //     .status(responseStatusCodes.badRequest)
    //     .json({ message: responseMessages.invalidRequest });
    // }
    const viewerId = req.user.id;
    const user = await User.findOne({ where: { user_id: userId } });
    if (!user) {
      //   return res
      //     .status(responseStatusCodes.badRequest)
      //     .json({ message: responseMessages.userNotFound });
      return res.error(responseMessages.userNotFound);
    }
    let profileUrl;
    if (user.profile) {
      profileUrl = getImageUrlPublic(user.profile);
    }
    user.profile = profileUrl;
    user.authUserId = viewerId;
    await ContactView.create({
      user_id: userId,
      viewer_id: viewerId,
    });
    const isBlockedByOther = await BlockedUser.findOne({
      where: { blocker_id: user.user_id, blocked_id: viewerId },
    });

    const isYouBlockedOther = await BlockedUser.findOne({
      where: { blocker_id: viewerId, blocked_id: user.user_id },
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
      isBlockedByOther: !!isBlockedByOther,
      isYouBlockedOther: !!isYouBlockedOther,
    };
    // return res
    //   .status(responseStatusCodes.success)
    //   .json({ message: responseMessages.userDetails, data: response });
    return res.success(responseMessages.userDetails, response);
  } catch (error) {
    // return res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ message: responseMessages.internalServerError });
    return next(error);
  }
};

function generateReferralCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

exports.createOrUpdateReferralCode = async (req, res, next) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      //   return res.status(responseStatusCodes.badRequest).json({
      //     success: false,
      //     message: "user_id is required",
      //   });
      return res.error(responseMessages.invalidRequest);
    }
    const referral_code = generateReferralCode();
    let existing = await ReferralCode.findOne({ where: { user_id } });

    if (existing) {
      existing.referral_code = referral_code;
      await existing.save();

      //   return res.status(responseStatusCodes.success).json({
      //     success: true,
      //     message: "Referral code updated successfully",
      //     data: existing,
      //   });
      return res.success("Referral code updated successfully", existing);
    }
    const newReferral = await ReferralCode.create({
      user_id,
      referral_code,
    });

    // return res.status(responseStatusCodes.created).json({
    //   success: true,
    //   message: "Referral code created successfully",
    //   data: newReferral,
    // });
    return res.success("Referral code created successfully", newReferral);
  } catch (error) {
    // return res.status(responseStatusCodes.internalServerError).json({
    //   success: false,
    //   message: "Internal server error",
    //   error: error.message,
    // });
    return next(error);
  }
};
