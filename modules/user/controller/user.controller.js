const User = require('../../../models/user.model');
const Otp = require('../../../models/otp.model');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const moment = require('moment');
const axios = require('axios');
const path = require('path');
require('dotenv').config();
const AdView = require('../../../models/adView.model');
const AdImage = require('../../../models/adImage.model');
const AdLocation = require('../../../models/adLocation.model');
const Ad = require('../../../models/ad.model');
const AdPriceDetails = require('../../../models/adPriceDetails.model');
const AdWishLists = require('../../../models/adWishList.model');
const ChatMessage = require('../../../models/chatMessage.model');
const ChatRoom = require('../../../models/chatRoom.model');
const ContactView = require('../../../models/contactView.model');
const UserSearch = require('../../../models/userSearch.model');
const crypto = require("crypto");
const {responseStatusCodes} = require("../../../helpers/appConstants");
const { 
    getImageUrl,
    uploadToS3,
    formatAd,
    formatPagination } = require('../../../helpers/utils');

const generateUserId = () => {
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 1000);
    const userId = `${timestamp}${randomNum}`
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
    const timeKey = crypto.createHash("md5").update('send-sms' + "sms@rits-v1.0" + expire).digest("hex");
    const timeAccessTokenKey = crypto.createHash("md5").update(process.env.SMS_ACCESS_TOKEN + timeKey).digest("hex");
    const signature = crypto.createHash("md5").update(timeAccessTokenKey + process.env.SMS_ACCESS_TOKEN_KEY).digest("hex");
    const route = 'transactional';
    const authSignature = signature;
    const smsHeader = 'SGMOLN';
    const countryCode = '+91';
    const url = `https://fastsms.sangamamonline.in/api/sms/v1.0/send-sms?accessToken=${process.env.SMS_ACCESS_TOKEN}&expire=${expire}&authSignature=${authSignature}&route=${route}&smsHeader=${smsHeader}&messageContent=${message}&recipients=${mobile}&contentType=text&removeDuplicateNumbers=1&countryCode=${countryCode}`;
    return await sendCurl(url);
};

exports.createUser = async (req, res) => {
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
                const token = jwt.sign({ id: user.user_id }, process.env.ACCESS_TOKEN_SECRET);
                // user.token = token;
                await user.save();

                return res.status(responseStatusCodes.success).json({
                    success: true,
                    message: 'User login success',
                    data: {
                        user_id:user.user_id,
                        name:user.name,
                        token: token,
                        profile: profileUrl,
                        mobile_number: user.mobile_number,
                        email:user.email,
                        description:user.description,
                        is_admin: user.is_admin
                    }
                });
            } else {
                user = new User({
                    name,
                    user_id: generateUserId(),
                    email,
                    email_uid:uuid,
                });
                await user.save();
                const token = jwt.sign({ id: user.user_id }, process.env.ACCESS_TOKEN_SECRET);
                // user.token = token;
                await user.save();

                return res.status(responseStatusCodes.success).json({
                    success: true,
                    message: 'User login success',
                    data: {
                        user_id:user.user_id,
                        name:user.name,
                        token: token,
                        profile: user.profile,
                        mobile_number: user.mobile_number,
                        email:user.email,
                        description:user.description,
                        is_admin: user.is_admin
                    }
                });
            }
        }
    } catch (error) {
        return res.status(responseStatusCodes.internalServerError).json({ message: 'Internal Server error', error });
    }
};

exports.sendOtp = async (req, res) => {
    try {
        const { mobile } = req.body;
        const limits = 50;
        const otpRequestsCount = await Otp.count({
            where: {
                mobile: mobile,
                createdAt: { [Op.gte]: moment().subtract(1, 'day').toDate() }
            }
        });
        if (otpRequestsCount > limits) {
            return res.status(429).json({ message: 'Otp limit reached, please try again later' });
        }
        const otp = Math.floor(100000 + Math.random() * 900000);
        const verificationId = generateRandomString();
        await sendSangamamOtp(mobile.slice(-10), otp);
        await Otp.create({
            mobile: mobile,
            verification_id: verificationId,
            otp: otp
        });
        res.json({ message: 'OTP sent', verificationId: verificationId });
    } catch (error) {
        res.status(responseStatusCodes.internalServerError).json({ message: `Internal Server Error. ${error}` });
    }
};

exports.verifyOtp = async (req, res) => {
    try {
        const { verificationId, otp, name } = req.body;
        const otpRecord = await Otp.findOne({
            where: { verification_id: verificationId, otp: otp }
        }); 
        if (!otpRecord) {
            return res.status(responseStatusCodes.notFound).json({ message: 'Invalid OTP' });
        }

        const currentTime = moment();
        const otpTime = moment(otpRecord.createdAt);

        if (currentTime.diff(otpTime, 'minutes') > 10) {
            // await Otp.destroy({ where: { id: otpRecord.id } });
            return res.status(410).json({ message: 'OTP Expired' });
        }
        let user = await User.findOne({ where: { mobile_number: otpRecord.mobile } });
        if (user) {
            const token = jwt.sign({ id: user.user_id }, process.env.ACCESS_TOKEN_SECRET);
            user.set('token', token);
            let profileUrl;
            if (user.profile) {
                profileUrl = await getImageUrl(user.profile);
            }
            user.profile = profileUrl;
            return res.status(responseStatusCodes.success).json({
                success: true,
                message: 'User login success',
                data: {
                    user_id: user.user_id,
                    name: user.name,
                    mobile_number: user.mobile_number,
                    token: token,
                    profile: user.profile
                }
            });
        } else {
            const newUser = await User.create({
                name: name || 'User',
                user_id: generateUserId(),
                mobile_number: otpRecord.mobile,
            });
            const token = jwt.sign({ id: newUser.user_id }, process.env.ACCESS_TOKEN_SECRET);
            newUser.set('token', token);
            newUser.token = token;
            await newUser.save();
            return res.status(responseStatusCodes.success).json({
                success: true,
                message: 'User registration success',
                data: {
                    user_id: newUser.user_id,
                    name: newUser.name,
                    mobile_number: newUser.mobile_number,
                    token: token,
                    profile: newUser.profile
                }
            });
        }
    } catch (error) {
        res.status(responseStatusCodes.internalServerError).json({ message: 'Internal Server Error' });
    }
};

exports.verifyUpdateMobileOtp = async (req, res) => {
    try {
        const { verificationId, otp } = req.body;
        const otpRecord = await Otp.findOne({
            where: { verification_id: verificationId, otp: otp }
        });
        if (!otpRecord) {
            return res.status(responseStatusCodes.notFound).json({ message: 'Invalid OTP' });
        }
        const currentTime = moment();
        const otpTime = moment(otpRecord.createdAt);
        if (currentTime.diff(otpTime, 'minutes') > 10) {
            return res.status(410).json({ message: 'OTP Expired' });
        }
        return res.json({ message: 'Mobile number updated' });
    } catch (error) {
        res.status(responseStatusCodes.internalServerError).json({ message: 'Internal Server Error' });
    }
};

exports.getUserById = async (req, res) => {
    const id = req.query.id;
    try {
        const user = await User.findOne({ where: { user_id: id } });
        if (!user) {
            return res.status(responseStatusCodes.notFound).send({ message: 'User not found' });
        }
        let profileUrl;
        if (user.profile) {
            profileUrl = await getImageUrl(user.profile);
        }
        user.profile = profileUrl;
        res.status(responseStatusCodes.success).send(user);
    } catch (err) {
        res.status(responseStatusCodes.internalServerError).send({ message: 'Error retrieving user'+err });
    }
};

exports.updateProfilePic = async (req, res) => {    
    const id = req.query.id;
    const fileExtension = path.extname(req.file.originalname);
    const fileName = `${id}${fileExtension}`;
    try{
        const uploaded = await uploadToS3(req.file, fileName);
        if (!uploaded) {
            return res.status(500).json({ message: "Profile picture upload failed" });
        }
        const user = await User.findOne({where:{user_id:id}});
        user.profile=fileName;
        await user.save();
        let profileUrl;
        profileUrl = await getImageUrl(user.profile);
        res.status(responseStatusCodes.success).json({success: true, data: profileUrl});
    }catch(e){
        res.status(responseStatusCodes.internalServerError).json({ success: false, message: e.message });
    }
};

exports.updateEmailOrMobile = async (req, res) => {
    try {
        const { email, mobile, uid, user_id } = req.body;
        let user = await User.findOne({where:{user_id: user_id}});
        if (!user) {
            return res.status(responseStatusCodes.notFound).json({ success: false, message: 'User not found' });
        }
        if (mobile) {
            user.mobile_number = mobile;
            await user.save();
            return res.json({ success: true, message: 'Successfully updated' });
        }
        if (email && uid) {
            user.email = email;
            user.email_uid = uid;
            await user.save();
            return res.json({ success: true, message: 'Successfully updated' });
        }
        return res.status(responseStatusCodes.badRequest).json({ success: false, message: 'Invalid request' });
    } catch (error) {
        return res.status(responseStatusCodes.internalServerError).json({ success: false, message: 'Server error' });
    }
};

exports.updateProfile = async (req, res) => {
    const { name, description, user_id } = req.body;
    try{
        if (!name && !description) {
            return res.status(responseStatusCodes.badRequest).json({ success: false, message: 'Invalid request' });
        }
        let user = await User.findOne({where:{user_id: user_id}});
        if (!user) {
            return res.status(responseStatusCodes.notFound).json({ success: false, message: 'User not found' });
        }
        user.name = name;
        user.description = description;
        await user.save();

        return res.status(responseStatusCodes.success).json({ success: true, message: 'Profile successfully updated' });
    } catch (error) {
        return res.status(responseStatusCodes.internalServerError).json({ success: false, message: 'Server error' });
    }
};

exports.deleteAccount = async (req, res) => {
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
                [Op.or]: [
                    { sender_id: user_id },
                    { reciever_id: user_id },
                ],
            },
        });
        await ChatRoom.destroy({
            where: {
                [Op.or]: [
                    { user1: user_id },
                    { user2: user_id },
                ],
            },
        });
        await ContactView.destroy({
            where: {
                [Op.or]: [
                    { user_id: user_id },
                    { viewer_id: user_id },
                ],
            },
        });
        await UserSearch.destroy({where:{user_id:user_id}});
        const deletedUser = await User.destroy({ where: { user_id: user_id } });
        if (!deletedUser) {
            return res.status(responseStatusCodes.notFound).json({ success: false, message: 'User not found' });
        }
        return res.status(responseStatusCodes.success).json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        return res.status(responseStatusCodes.internalServerError).json({ success: false, message: 'An error occurred while deleting the account' });
    }
};

exports.updateNotificationToken = async (req, res) => {
    try {
        const { notification_token } = req.body;
        const userId = req.user.id;        
        const user = await User.findOne({where: { user_id: userId }});
        if (!user) {
            return res.status(responseStatusCodes.notFound).json({ message: 'User not found' });
        }
        user.notification_token = notification_token;
        await user.save();
        res.json({ message: 'Token updated successfully' });
    } catch (error) {
        res.status(responseStatusCodes.internalServerError).json({ message: 'Server error' });
    }
};

exports.userWithAds = async (req, res) => {
    try {
        const { user_id } = req.body;
        const user = await User.findOne({
            where:{ user_id },
            include: [
                {
                    model: Ad,
                    as:'ads',
                    include: [
                        {model: AdImage, as: 'ad_images'},
                        {model: AdLocation,as:'ad_location'},
                        {model: AdPriceDetails,as:'ad_price_details'},
                    ]
                },
            ],
            nest: true
        })
        if (!user) {
            return res.status(responseStatusCodes.notFound).json({ message: 'User not found' });
        }
        const formattedAds = await Promise.all(ads.map(ad => formatAd(ad)));
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`;
        const pagination = formatPagination({ page: Number(page), perPage, total: count, path: fullUrl });

        const response = {
            id: user.id,
            user_id: user.user_id,
            name: user.name,
            email_uid: user.email_uid,
            profile: user.profile ? await getImageUrl(user.profile) : null,
            description: user.description,
            notification_token: user.notification_token,
            ads: formattedAds,
            ...pagination
        };
        return res.status(responseStatusCodes.success).json(response);
    } catch (error) {
        return res.status(responseStatusCodes.internalServerError).json({ message: 'Server error' });
    }
};

exports.userWishlists = async (req, res) => {
    try {
        const userId = req.user;
        const wishlist = await AdWishLists.findAll({
            where: { user_id: userId.id },
            attributes: ['ad_id']
        });
        const ads=[];
        const adIds = wishlist.map(w => w.ad_id);
        for(i in adIds){
            const ad = await Ad.findOne({
                where: { ad_id: adIds[i] },
                include: [
                    {model: User,as:'user'},
                    {model: AdImage,as:'ad_images'},
                    {model: AdLocation,as:'ad_location'},
                    {model: AdPriceDetails,as:'ad_price_details'},
                ],
                nest: true
            });
            ads.push(formatAd(ad));
        }
        res.status(responseStatusCodes.success).json(ads);
    } catch (error) {
        res.status(responseStatusCodes.internalServerError).json({ message: 'Server error' });
    }
};

exports.removeWishlist = async (req, res) => {
    try {
        const { ad_id } = req.body;
        const userId = req.user.id;
        const wishlistItem = await AdWishLists.findOne({
            where: {
                user_id: userId,
                ad_id: ad_id
            }
        });
        if (wishlistItem) {
            await wishlistItem.destroy();
            return res.json({ message: 'Wishlist removed' });
        } else {
            return res.json({ message: 'Wishlist already removed' });
        }
    } catch (error) {
        return res.status(responseStatusCodes.internalServerError).json({ message: 'Server error' });
    }
};

exports.viewContact = async (req, res) => {
    try {
        const { userId } = req.body;
        const viewerId = req.user.id;
        const user = await User.findOne({where:{ user_id: userId }});
        if (!user) {
            return res.status(responseStatusCodes.notFound).json({ message: 'User not found' });
        }
        let profileUrl;
        if (user.profile) {
            profileUrl = await getImageUrl(user.profile);
        }
        user.profile = profileUrl;
        user.authUserId = viewerId
        await ContactView.create({
            user_id: userId,
            viewer_id: viewerId   
        });
        const response={
            id:user.id,
            user_id:user.user_id,
            name:user.name,
            email:user.email,
            email_uid:user.email_uid,
            mobile_number:user.mobile_number,
            description:user.description,
            notification_token:user.notification_token,
            profile:profileUrl??null,
            authUserId:viewerId
        }
        return res.status(responseStatusCodes.success).json({ message: 'User data fetched', data: response });
    } catch (error) {
        return res.status(responseStatusCodes.internalServerError).json({ message: 'Server error' });
    }
};