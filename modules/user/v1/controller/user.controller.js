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

const buildUserPayload = (user, token, referralCode, profileUrl = null) => ({
  user_id: user.user_id,
  name: user.name,
  token,
  profile: profileUrl ?? user.profile ?? null,
  mobile_number: user.mobile_number,
  email: user.email,
  referral_code: referralCode || "",
  description: user.description,
  role: user?.role,
  is_admin: user.is_admin,
});

exports.createUser = async (req, res, next) => {
  const { name, uuid, mobile, email, referralCode } = req.body;

  if (!name || !uuid || (!mobile && !email)) {
    return res.error(responseMessages.invalidRequest);
  }

  if (!email) {
    return res.error(responseMessages.invalidRequest);
  }

  try {
    const existingUser = await User.findOne({
      where: { email },
      include: [
        {
          model: ReferralCode,
          as: "referral_code",
          attributes: ["referral_code"],
        },
      ],
    });
    if (existingUser) {
      if (!existingUser.referral_code) {
        const newCode = generateReferralCode();
        await ReferralCode.create({
          user_id: existingUser.user_id,
          referral_code: newCode,
        });
        existingUser.referral_code = { referral_code: newCode };
      }

      const profileUrl = existingUser.profile
        ? getImageUrlPublic(existingUser.profile)
        : null;

      const token = jwt.sign(
        { id: existingUser.user_id },
        process.env.ACCESS_TOKEN_SECRET
      );

      await existingUser.save();

      return res.success(
        responseMessages.userLogged,
        buildUserPayload(
          existingUser,
          token,
          existingUser.referral_code?.referral_code,
          profileUrl
        )
      );
    }

    const newUser = await User.create({
      name,
      user_id: generateUserId(),
      email,
      email_uid: uuid,
    });

    const [token, newReferralCode] = await Promise.all([
      jwt.sign({ id: newUser.user_id }, process.env.ACCESS_TOKEN_SECRET),
      (async () => {
        const code = generateReferralCode();
        await ReferralCode.create({ user_id: newUser.user_id, referral_code: code });
        return code;
      })(),
    ]);

    if (referralCode) {
      const referralOwner = await ReferralCode.findOne({
        where: { referral_code: referralCode },
      });

      if (!referralOwner) {
        return res.error(responseMessages.referralError, responseStatusCodes.badRequest);
      }

      if (referralOwner.user_id === newUser.user_id) {
        return res.error(responseMessages.referralError, responseStatusCodes.badRequest);
      }

      const alreadyReferred = await ReferralCodeLogin.findOne({
        where: { login_id: newUser.user_id },
      });

      if (!alreadyReferred) {
        await ReferralCodeLogin.create({
          refered_id: referralOwner.user_id,
          login_id: newUser.user_id,
        });
      }
    }

    return res.success(
      responseMessages.userLogged,
      buildUserPayload(newUser, token, newReferralCode)
    );
  } catch (error) {
    return next(error);
  }
};


exports.addReferralLogin = async (req, res, next) => {
  try {
    const { referralCode, login_user_id } = req.body;
    if (!referralCode || !login_user_id) {
      return res.error(responseMessages.invalidRequest);
    }
    const referralOwner = await ReferralCode.findOne({
      where: { referral_code: referralCode },
    });
    if (!referralOwner) {
      return res.error(responseMessages.invalidReferralCode);
    }
    const referrerId = referralOwner.user_id;
    if (referrerId === login_user_id) {
      return res.error(responseMessages.referralError);
    }
    const existingUsage = await ReferralCodeLogin.findOne({
      where: { login_id: login_user_id },
    });
    if (existingUsage) {
      return res.success(
        responseMessages.referralSuccessAlready,
        existingUsage,
      );
    }
    const newReferralLog = await ReferralCodeLogin.create({
      refered_id: referrerId,
      login_id: login_user_id,
    });
    return res.success(responseMessages.referralSuccess, newReferralLog);
  } catch (error) {
    return next(error);
  }
};

exports.sendOtp = async (req, res, next) => {
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
    return res.success(responseMessages.otpSend, { verificationId });
  } catch (error) {
    return next(error);
  }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    const { verificationId, otp, name, referralCode } = req.body;
    if (!verificationId || !otp) {
      return res.error(responseMessages.invalidRequest);
    }
    const otpRecord = await Otp.findOne({
      where: { verification_id: verificationId, otp: otp },
    });
    if (!otpRecord) {
      return res.error(responseMessages.InvalidOtp);
    }

    const currentTime = moment();
    const otpTime = moment(otpRecord.createdAt);

    if (currentTime.diff(otpTime, "minutes") > 10) {
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
      return res.success(responseMessages.userLogged, {
        user_id: user.user_id,
        name: user.name,
        mobile_number: user.mobile_number,
        email: user.email??"",
        token: token,
        profile: user.profile,
        referral_code: user.referral_code?.referral_code || "",
        role: user?.role
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
      return res.success(responseMessages.userLogged, {
        user_id: newUser.user_id,
        name: newUser.name,
        mobile_number: newUser.mobile_number,
        email: newUser.email??"",
        token: token,
        profile: newUser.profile,
        referral_code: newReferralCode,
        role: newUser?.role
      });
    }
  } catch (error) {
    return next(error);
  }
};

exports.verifyUpdateMobileOtp = async (req, res, next) => {
  try {
    const { verificationId, otp } = req.body;
    if (!verificationId || !otp) {
      return res.error(responseMessages.invalidRequest);
    }
    const otpRecord = await Otp.findOne({
      where: { verification_id: verificationId, otp: otp },
    });
    if (!otpRecord) {
      return res.error(responseMessages.InvalidOtp);
    }
    const currentTime = moment();
    const otpTime = moment(otpRecord.createdAt);
    if (currentTime.diff(otpTime, "minutes") > 10) {
      return res.error(responseMessages.otpExpired);
    }
    return res.success(responseMessages.mobileUpdated);
  } catch (error) {
    return next(error);
  }
};

exports.getUserById = async (req, res, next) => {
  const id = req.query.id;
  try {
    const user = await User.findOne({ where: { user_id: id } });
    if (!user) {
      return res.error(responseMessages.userNotFound);
    }
    let profileUrl;
    if (user.profile) {
      profileUrl = getImageUrlPublic(user.profile);
    }
    user.profile = profileUrl;
    res.success(responseMessages.userDetails, user);
  } catch (err) {
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
    return res.success(responseMessages.profileUpdateSuccessfully, profileUrl);
  } catch (e) {
    return next(error);
  }
};

exports.updateEmailOrMobile = async (req, res, next) => {
  try {
    const { email, mobile, uid, user_id } = req.body;
    if (!email && !mobile) {
      return res.error(responseMessages.invalidRequest);
    }
    let user = await User.findOne({ where: { user_id: user_id } });
    if (!user) {
      return res.error(responseMessages.userNotFound);
    }
    if (mobile) {
      user.mobile_number = mobile;
      await user.save();
      return res.success(responseMessages.mobileUpdated);
    }
    if (email && uid) {
      user.email = email;
      user.email_uid = uid;
      return res.success(responseMessages.emailUpdated);
    }
    return res.error(responseMessages.invalidRequest);
  } catch (error) {
    return next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  const { name, description, user_id } = req.body;
  try {
    if (!name && !description) {
      return res.error(responseMessages.invalidRequest);
    }
    let user = await User.findOne({ where: { user_id: user_id } });
    if (!user) {
      return res.error(responseMessages.userNotFound);
    }
    user.name = name;
    user.description = description;
    await user.save();
    return res.success(responseMessages.profileUpdateSuccessfully);
  } catch (error) {
    return next(error);
  }
};

exports.deleteAccount = async (req, res, next) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.error(responseMessages.invalidRequest);
  }

  try {
    const user = await User.findOne({ where: { user_id } });
    if (!user) {
      return res.error(responseMessages.userNotFound);
    }

    const adIds = (await Ad.findAll({
      where: { user_id },
      attributes: ["ad_id"],
    })).map((ad) => ad.ad_id);

    if (adIds.length) {
      await Promise.all([
        AdImage.destroy({ where: { ad_id: adIds } }),
        AdLocation.destroy({ where: { ad_id: adIds } }),
        AdPriceDetails.destroy({ where: { ad_id: adIds } }),
        AdWishLists.destroy({ where: { ad_id: adIds } }),
        AdView.destroy({ where: { ad_id: adIds } }),
      ]);
    }
    await Promise.all([
      Ad.destroy({ where: { user_id } }),
      ChatMessage.destroy({
        where: { [Op.or]: [{ sender_id: user_id }, { reciever_id: user_id }] },
      }),
      ChatRoom.destroy({
        where: { [Op.or]: [{ user1: user_id }, { user2: user_id }] },
      }),
      ContactView.destroy({
        where: { [Op.or]: [{ user_id }, { viewer_id: user_id }] },
      }),
      UserSearch.destroy({ where: { user_id } }),
    ]);

    await User.destroy({ where: { user_id } });

    return res.success(responseMessages.userDeleted);
  } catch (error) {
    return next(error);
  }
};

exports.updateNotificationToken = async (req, res, next) => {
  try {
    const { notification_token } = req.body;
    const userId = req.user.id;
    const user = await User.findOne({ where: { user_id: userId } });
    if (!user) {
      return res.error(responseMessages.userNotFound);
    }
    user.notification_token = notification_token;
    await user.save();
    return res.success(responseMessages.tokenUpdated);
  } catch (error) {
    return next(error);
  }
};

exports.userWithAds = async (req, res, next) => {
  try {
    const { user_id } = req.body;
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
      return res.error(responseMessages.userNotFound);
    }
    const formattedAds = await Promise.all(
      user.dataValues.ads.map((ad) => formatAd(ad)),
    );
    const ads = user.ads || [];
    const adCount = ads.length;
    const response = {
      id: user.id,
      user_id: user.user_id,
      name: user.name,
      email_uid: user.email_uid,
      profile: user.profile ? getImageUrlPublic(user.profile) : null,
      description: user.description,
      notification_token: user.notification_token,
      ads: formattedAds,
    };
    return res.success(responseMessages.adDetails, response);
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
    const filteredAds = ads.filter(Boolean);
    return res.success(responseMessages.userWishlistFetched, filteredAds);   
  } catch (error) {
    return next(error);
  }
};

exports.removeWishlist = async (req, res, next) => {
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
      return res.success(responseMessages.wishlistRemoved);
    } else {
      return res.success(responseMessages.wishlistAlreadyRemoved);
    }
  } catch (error) {
    return next(error);
  }
};

exports.viewContact = async (req, res, next) => {
  try {
    const { userId } = req.body;
    console.log(req.user)
    const viewerId = req.user.id;
    const user = await User.findOne({ where: { user_id: userId } });
    if (!user) {
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
    return res.success(responseMessages.userDetails, response);
  } catch (error) {
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
      return res.error(responseMessages.invalidRequest);
    }
    const referral_code = generateReferralCode();
    let existing = await ReferralCode.findOne({ where: { user_id } });

    if (existing) {
      existing.referral_code = referral_code;
      await existing.save();
      return res.success("Referral code updated successfully", existing);
    }
    const newReferral = await ReferralCode.create({
      user_id,
      referral_code,
    });
    return res.success("Referral code created successfully", newReferral);
  } catch (error) {
    return next(error);
  }
};
