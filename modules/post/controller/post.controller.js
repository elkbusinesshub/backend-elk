const User = require('../../../models/user.model');
const { Op, literal } = require('sequelize');
const AdWishLists = require('../../../models/adWishList.model');
const AdImage = require('../../../models/adImage.model');
const AdPriceDetails = require('../../../models/adPriceDetails.model');
const AdLocation = require('../../../models/adLocation.model');
const Ad = require('../../../models/ad.model');
const AdView = require('../../../models/adView.model');
const SearchCategory = require('../../../models/searchCategory.model');
const sequelize = require('../../../config/db');
const UserSearch = require('../../../models/userSearch.model');
const admin = require('../../../middlewares/firebase'); 
const messaging = admin.messaging();
const { responseStatusCodes } = require("../../../helpers/appConstants");
const { 
    getImageUrl,
    deleteImageFromS3,
    uploadToS3,
    formatAd,
    formatPagination } = require('../../../helpers/utils');

require('dotenv').config();

function generateAdId() {
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 1000);
    const userId = `${timestamp}${randomNum}`
    return parseInt(userId);
}

exports.createAd = async (req, res) => {
    try {
        const user = req.user;
        const { ad_id, title, description, category, ad_type, ad_prices } = req.body;
        await SearchCategory.create({
            keyword: title,
            category: category,
            ad_type: ad_type
        })
        const adStage = req.body.ad_stage || 1;
        const adStatus = req.body.ad_status || 'offline';
        var messageDisplay;
        var adId;
        if (!ad_id) {
            const ad = await Ad.create({
                ad_id: generateAdId(),
                user_id: user.id,
                title,
                description,
                category,
                ad_type,
                ad_stage: adStage,
                ad_status: adStatus
            });
            const adPrices = Object.entries(ad_prices).map(([key, value]) => ({
                ad_id: ad.ad_id,
                rent_duration: key,
                rent_price: value
            }));
            await AdPriceDetails.bulkCreate(adPrices);
            messageDisplay = 'Ad created successfully';
            adId = ad.ad_id;
        } else {
            const ad = await Ad.findOne({ where: { ad_id } });
            if (!ad) {
                return res.status(responseStatusCodes.notFound).json({ success: false, message: 'Ad not found' });
            }
            await AdPriceDetails.destroy({ where: { ad_id: ad.ad_id } });
            ad.title = title;
            ad.description = description;
            ad.category = category;
            ad.ad_type = ad_type;
            ad.ad_stage = adStage;
            ad.ad_status = adStatus;
            await ad.save();
            const adPrices = Object.entries(ad_prices).map(([key, value]) => ({
                ad_id: ad.ad_id,
                rent_duration: key,
                rent_price: value
            }));
            await AdPriceDetails.bulkCreate(adPrices);
            messageDisplay = 'Ad updated successfully';
            adId = ad.ad_id;
        }
        //id: { $ne: user.id },  
        const usersToNotify = await User.findAll();
        console.log(usersToNotify
        .map(user => user.notification_token));
        
        const tokens = usersToNotify
        .map(user => user.notification_token)
        .filter(token => token);
        tokens.push('ok')
        const message = {
            notification: {
                title: "New Ad Posted!",
                body: `Check out: ${title}`,
            },
            tokens: tokens,
        };
        const response = await messaging.sendEachForMulticast(message);        
        return res.status(responseStatusCodes.success).json({ success: true, message: messageDisplay, ad_id: adId, successCount: response.successCount, failureCount: response.failureCount });
    } catch (error) {
        console.log(error);
        
        return res.status(responseStatusCodes.internalServerError).json({ success: false, message: 'Server error' });
    }
}

exports.updateAdImage = async (req, res) => {
    const { ad_id, ad_stage, ad_status } = req.query;
    const images = req.files;
    try {
        const adImages = [];
        if (images || images.length !== 0) {
            for (const image of images) {
                const fileName = `${ad_id}_${image.originalname}`;
                const uploaded = await uploadToS3(image, fileName);
                if (!uploaded) {
                    return res.status(responseStatusCodes.internalServerError).json({ message: 'File upload failed' });
                }
                adImages.push({
                    ad_id: ad_id,
                    image: fileName,
                });
            }
            const ad = await Ad.findOne({ where: { ad_id: ad_id } });
            if (!ad) {
                return res.status(responseStatusCodes.notFound).json({ success: false, message: 'Ad not found' });
            }
            ad.ad_status = ad_status || 'offline';
            ad.ad_stage = ad_stage || 2;
            await ad.save();
            await AdImage.bulkCreate(adImages);
        }
        const updatedImages = await AdImage.findAll({ where: { ad_id } });
        for (const image of updatedImages) {
            image.image = await getImageUrl(image.image);
        }
        return res.status(responseStatusCodes.success).json({
            success: true,
            message: 'Image upload success',
            data: updatedImages
        });
    } catch (err) {
        return res.status(responseStatusCodes.internalServerError).json({ success: false, message: 'Server error' });
    }
}

exports.deletAdImage = async (req, res) => {
    const { id } = req.body;
    try {
        const data = await AdImage.findOne({ where: { id } });
        if (!data) {
            return res.status(responseStatusCodes.notFound).json({ success: false, message: 'Image not found' });
        }
        await deleteImageFromS3(data.image);
        await AdImage.destroy({ where: { id } });
        return res.status(responseStatusCodes.success).json({ success: true, message: 'Successfully deleted' });
    } catch (err) {
        return res.status(responseStatusCodes.internalServerError).json({ success: false, message: 'Delete error' });
    }
}

exports.updateAdAddress = async (req, res) => {
    const { ad_id, country, latitude, longitude, state, district, locality, ad_stage, ad_status, place } = req.body;
    try {
        let adLocation = await AdLocation.findOne({ where: { ad_id } });
        if (adLocation) {
            adLocation.country = country;
            adLocation.state = state;
            adLocation.district = district;
            adLocation.locality = locality;
            adLocation.place = place;
            adLocation.longitude = longitude;
            adLocation.latitude = latitude;
            await adLocation.save();
        } else {
            adLocation = new AdLocation({
                ad_id,
                country,
                state,
                district,
                locality,
                place,
                longitude,
                latitude
            });
            await adLocation.save();
        }
        const ad = await Ad.findOne({ where: { ad_id } });
        ad.ad_status = ad_status || 'online';
        ad.ad_stage = ad_stage || 3;
        await ad.save();
        if (!ad) {
            return res.status(responseStatusCodes.notFound).json({ success: false, message: 'Ad not found' });
        }
        return res.status(responseStatusCodes.success).json({ success: true, message: 'Location updated successfully' });
    } catch (err) {
        return res.status(responseStatusCodes.internalServerError).json({ success: false, message: 'Update error' });
    }
}

exports.deleteAd = async (req, res) => {
    const { adId } = req.body;
    try {
        const adRows = await Ad.findOne({ where: { ad_id: adId } });
        if (!adRows) {
            return res.status(responseStatusCodes.notFound).json({ message: 'Already deleted' });
        }
        await AdImage.destroy({ where: { ad_id: adId } });
        await AdLocation.destroy({ where: { ad_id: adId } });
        await AdPriceDetails.destroy({ where: { ad_id: adId } });
        await AdView.destroy({ where: { ad_id: adId } });
        await AdWishLists.destroy({ where: { ad_id: adId } });
        await Ad.destroy({ where: { ad_id: adId } });
        return res.status(responseStatusCodes.success).json({ message: 'Ad deleted' });
    } catch (error) {
        return res.status(responseStatusCodes.internalServerError).json({ message: 'Server error' });
    }
}

exports.getAdDetails = async (req, res) => {
    try {
        const userId = req.body.user_id;
        let wishLists
        let wishListAdIds
        if(userId){
            wishLists = await AdWishLists.findAll({ where: { user_id: userId } });
            wishListAdIds = wishLists.map(item => item.ad_id);
        }
        const ad = await Ad.findOne({
            where: { ad_id: req.body.ad_id },
            include: [
                { model: User, as: 'user' },
                { model: AdImage, as: 'ad_images' },
                { model: AdLocation, as: 'ad_location' },
                { model: AdPriceDetails, as: 'ad_price_details' },
            ],
            nest: true
        });
        if (!ad) {
            return res.status(responseStatusCodes.notFound).json({ message: 'Ad not found' });
        }
        // ad.user = ad.user.toJSON();
        // ad.user.token = undefined;
        // ad.user.createdAt = undefined;
        // ad.user.updatedAt = undefined;
        // ad.wishListed = userId?wishListAdIds.includes(ad.ad_id):false;
        if(userId){
            await insertAdViewCount(userId, ad.ad_id);
        }
        const formattedAd = await formatAd(ad);
        formattedAd.wishListed = userId ? wishListAdIds.includes(ad.ad_id) : false;
        res.status(responseStatusCodes.success).json(formattedAd);
    } catch (error) {        
        res.status(responseStatusCodes.internalServerError).json({ message: 'Server error' });
    }
};

exports.myAds = async (req, res) => {
    try {
        const userId = req.user.id;
        const ads = await Ad.findAll({
            where: { user_id: userId, ad_stage: 3 },
            attributes: {
                include: [
                    [literal(`(SELECT COUNT(*) FROM ad_wish_lists WHERE ad_wish_lists.ad_id = Ad.ad_id)`), 'ad_wish_lists_count'],
                    [literal(`(SELECT COUNT(*) FROM ad_views WHERE ad_views.ad_id = Ad.ad_id)`), 'ad_views_count'],
                ]
            },
            include: [
                { model: User, as: 'user' },
                { model: AdImage, as: 'ad_images' },
                { model: AdLocation, as: 'ad_location' },
                { model: AdPriceDetails, as: 'ad_price_details' },
            ],
            nest: true
        });
        const formattedAds = await Promise.all(
            ads.map(ad => formatAd(ad, { includeCounts: true }))
        );
        res.status(responseStatusCodes.success).json(formattedAds);
    } catch (error) {
        res.status(responseStatusCodes.internalServerError).json({ message: 'Server error' });
    }
};

const insertAdViewCount = async (userId, adId) => {
    try {
        let adView = await AdView.findOne({
            where: { user_id: userId, ad_id: adId }
        });
        if (!adView) {
            await AdView.create({
                user_id: userId,
                ad_id: adId,
                view_count: 1
            });
        } else {
            adView.view_count += 1;
            await adView.save();
        }
        return 'successfully updated';
    } catch (error) {
        throw new Error('Error updating ad view count'+error);
    }
};

exports.getRecentUnsavedPost = async (req, res) => {
    try {
        const userId = req.user.id;
        const ad = await Ad.findOne({
            where: {
                user_id: userId,
                ad_stage: {
                    [Op.lt]: 3,
                }
            },
            include: [
                { model: AdImage, as: 'ad_images' },
                { model: AdPriceDetails, as: 'ad_price_details' },
                { model: AdLocation, as: 'ad_location' }
            ],
            order: [['updatedAt', 'DESC']],
            nest: true,
        });
        if (!ad) {
            return res.status(responseStatusCodes.success).json({});
        }
        const formattedAd = await formatAd(ad, { includeUser: false });
        res.status(responseStatusCodes.success).json(formattedAd);
    } catch (error) {
        res.status(responseStatusCodes.internalServerError).json({ message: 'Server error' });
    }
};

exports.searchCategories = async (req, res) => {
    try {
        const { keyword, ad_type } = req.body;
        const datas = await SearchCategory.findAll(
            {
                where: {
                    keyword: { [Op.like]: `%${keyword}%` },
                    ad_type
                }
            }
        );
        const result = datas.filter(data => data.keyword.toLowerCase().startsWith(keyword.toLowerCase()));
        res.status(responseStatusCodes.success).json(result);
    } catch (error) {
        res.status(responseStatusCodes.internalServerError).json({ message: 'Server error' });
    }
};

exports.recommentedPosts = async (req, res) => {
    try {
        const page =parseInt(req.body.page);
        const perPage = 16;
        const offset = (page - 1) * perPage;
        let userSearches = [];
        if(req.body.id){
            userSearches = await UserSearch.findAll({
                where: {
                    user_id: req.body.id
                },
                order: [['createdAt', 'ASC']],
                limit: 2,
                raw: true,
                nest: true
            });
        }
        let adsQuery = {
            where: {
                ad_status: 'online',
                ad_type: "rent",
                ad_stage: 3
            },
            include: [
                { model: User, as: 'user' },
                { model: AdImage, as: 'ad_images' },
                { model: AdPriceDetails, as: 'ad_price_details' },
            ],
            distinct: true,
            limit: perPage,
            offset: offset,
        };
        if (req.body.id) {
            adsQuery.where.user_id = { [Op.ne]: req.body.id };
        }
        if (userSearches.length !== 0) {
            const firstSearch = userSearches[0];
            const hasLocationDetails = firstSearch.location && firstSearch.location_type && firstSearch.latitude !== null && firstSearch.longitude !== null;
            if (hasLocationDetails) {
                if (userSearches[0].location_type === 'locality' || userSearches[0].location_type === 'place') {
                    adsQuery.include.push({
                        model: AdLocation,
                        as: 'ad_location',
                        where: {
                            [Op.or]: [
                                { locality: userSearches[0].location },
                                { place: userSearches[0].location }
                            ]
                        }
                    });
                } else {
                    adsQuery.include.push({
                        model: AdLocation,
                        as: 'ad_location',
                        where: {
                            [Op.or]: [
                                { state: userSearches[0].location },
                                { country: userSearches[0].location }
                            ]
                        }
                    });
                }
                adsQuery.attributes = {
                    include: [
                        [
                            literal(`(
                                SELECT (6371 * 
                                    acos(cos(radians(${userSearches[0].latitude})) * cos(radians(ad_location.latitude)) * 
                                    cos(radians(ad_location.longitude) - radians(${userSearches[0].longitude})) + 
                                    sin(radians(${userSearches[0].latitude})) * sin(radians(ad_location.latitude)))
                                ) AS distance
                            )`), 'distance'
                        ],
                    ]
                };
                adsQuery.order = [
                    [sequelize.literal('distance'), 'ASC']
                ];
            } else {
                adsQuery.include.push({
                    model: AdLocation,
                    as: "ad_location"
                })
            }
        } else {
            adsQuery.include.push({
                model: AdLocation,
                as: "ad_location",
                required: true,
            })
            if(req.body.latitude && req.body.longitude){
                adsQuery.attributes = {
                    include: [
                        [
                            literal(`(
                                SELECT (6371 * 
                                    acos(cos(radians(${req.body.latitude})) * cos(radians(ad_location.latitude)) * 
                                    cos(radians(ad_location.longitude) - radians(${req.body.longitude})) + 
                                    sin(radians(${req.body.latitude})) * sin(radians(ad_location.latitude)))
                                ) AS distance
                            )`), 'distance'
                        ],
                    ]
                };
                adsQuery.order = [
                    [sequelize.literal('distance'), 'ASC']
                ];
            }
        }
        const { count, rows: ads } = await Ad.findAndCountAll(adsQuery);
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`;
        const pagination = formatPagination({ page: Number(page), perPage, total: count, path: fullUrl });
        const formattedAds = await Promise.all(ads.map(ad => formatAd(ad)));

        res.status(responseStatusCodes.success).json({
            ...pagination,
            data: formattedAds
        });
    } catch (error) {
        res.status(responseStatusCodes.internalServerError).json({ message: 'Server error' });
    }
};

exports.getAllPosts = async (req, res) => {
    let posts = await Ad.findAll(
        {
            where: {
                ad_status: 'online',
                ad_type: "rent",
                ad_stage: 3
            },
            include: [
                { model: User, as: 'user' },
                { model: AdImage, as: 'ad_images' },
                { model: AdPriceDetails, as: 'ad_price_details' },
            ]
        }
    );
    res.status(responseStatusCodes.success).json(posts);
}

exports.searchAds = async (req, res) => {   
    try {
        const { keyword, page = 1, min_price, max_price } = req.body;
        const perPage = 15;
        const offset = (page - 1) * perPage;
        let adsQuery = {
            where: {
                ad_status: 'online',
                ad_stage: 3
            },
            include: [
                { model: User, as: 'user' },
                { model: AdImage, as: 'ad_images' },
                { 
                    model: AdPriceDetails,
                    as: 'ad_price_details',
                    where: {
                        ...(min_price !== undefined ? { rent_price: { [Op.gte]: Number(min_price) } } : {}),
                        ...(max_price !== undefined ? { rent_price: { ...(min_price !== undefined ? { [Op.gte]: Number(min_price), [Op.lte]: Number(max_price) } : { [Op.lte]: Number(max_price) }) } } : {})
                    },
                },
                { model: AdLocation, as: 'ad_location' }
            ],
            distinct: true,
            limit: perPage,
            offset: offset,
        };

        if (!isNaN(keyword)) {
            adsQuery.where.ad_id = Number(keyword);
        } else {
            adsQuery.where[Op.or] = [
                { title: { [Op.like]: `%${keyword}%` } },
                { category: { [Op.like]: `%${keyword}%` } },
                { description: { [Op.like]: `%${keyword}%` } }
            ];
        }

        const { count, rows: ads } = await Ad.findAndCountAll(adsQuery);
        const formattedAds = await Promise.all(ads.map(ad => formatAd(ad)));
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`;
        const pagination = formatPagination({ page: Number(page), perPage, total: count, path: fullUrl });
        res.status(responseStatusCodes.success).json({
            ...pagination,
            data: formattedAds
        });
        res.status(responseStatusCodes.success).json(response);
    } catch (error) {
        console.error(error);
        res.status(responseStatusCodes.internalServerError).json({ message: 'Server error' });
    }
};

exports.rentCategoryPosts = async (req, res) => {       
    try {
        const { ad_type, location_type, location, latitude, longitude, category, keyword, page = 1, user_id, min_price, max_price } = req.body;
        const perPage = 15;
        const offset = (page - 1) * perPage;
        if(user_id){
            await UserSearch.create({
                user_id: user_id,
                keyword: req.body.keyword || '',
                category: req.body.category || '',
                ad_type: req.body.ad_type,
                location_type: req.body.location_type || '',
                location: req.body.location || '',
                latitude: req.body.latitude || null,
                longitude: req.body.longitude || null,
            })
        }
        let adsQuery;
        const allAds = await Ad.findAll({ attributes: ['ad_id'] });
        const allAdIds = allAds.map(ad => ad.ad_id);
        if (keyword && allAdIds.includes(Number(keyword))) {            
            adsQuery = {
                where: {
                    ad_id: Number(keyword),
                    ad_stage: 3
                },
                include: [
                    { model: User, as: 'user' },
                    { model: AdImage, as: 'ad_images' },
                    { 
                        model: AdPriceDetails, 
                        as: 'ad_price_details',
                        where: {
                            ...(min_price !== undefined ? { rent_price: { [Op.gte]: Number(min_price) } } : {}),
                            ...(max_price !== undefined ? { rent_price: { ...(min_price !== undefined ? { [Op.gte]: Number(min_price), [Op.lte]: Number(max_price) } : { [Op.lte]: Number(max_price) }) } } : {})
                        },
                    },
                    { model: AdLocation, as: 'ad_location' }
                ],
                distinct: true,
                limit: perPage,
                offset: offset,
            };
        } else if (!location_type || !location || !latitude || !longitude) {            
            adsQuery = {
                where: {
                    ad_type: ad_type,
                    ad_status: 'online',
                    ad_stage: 3
                },
                include: [
                    { model: User, as: 'user' },
                    { model: AdImage, as: 'ad_images' },
                    { 
                        model: AdPriceDetails,
                        as: 'ad_price_details',
                        where: {
                            ...(min_price !== undefined ? { rent_price: { [Op.gte]: Number(min_price) } } : {}),
                            ...(max_price !== undefined ? { rent_price: { ...(min_price !== undefined ? { [Op.gte]: Number(min_price), [Op.lte]: Number(max_price) } : { [Op.lte]: Number(max_price) }) } } : {})
                        },
                    },
                    { model: AdLocation, as: 'ad_location' }
                ],
                distinct: true,
                limit: perPage,
                offset: offset,
            };
            if (category) adsQuery.where.category = category;
            if (keyword) {                
                adsQuery.where[Op.or] = [
                    { category: { [Op.like]: `%${keyword}%` } },
                    { title: { [Op.like]: `%${keyword}%` } },
                    { description: { [Op.like]: `%${keyword}%` } },
                ];
            }
        } else {
            adsQuery = {
                where: {
                    ad_type: ad_type,
                    ad_status: 'online',
                    ad_stage: 3
                },
                attributes: {
                    include: [
                        [
                            literal(`(
                                SELECT (6371 * 
                                    acos(cos(radians(${latitude})) * cos(radians(ad_location.latitude)) * 
                                    cos(radians(ad_location.longitude) - radians(${longitude})) + 
                                    sin(radians(${latitude})) * sin(radians(ad_location.latitude)))
                                ) AS distance
                            )`), 'distance'
                        ],
                    ]
                },
                include: [
                    { model: User, as: 'user' },
                    { model: AdImage, as: 'ad_images' },
                    { 
                        model: AdPriceDetails,
                        as: 'ad_price_details',
                        where: {
                            ...(min_price !== null ? { rent_price: { [Op.gte]: Number(min_price) } } : {}),
                            ...(max_price !== null ? { rent_price: { ...(min_price !== null ? { [Op.gte]: Number(min_price), [Op.lte]: Number(max_price) } : { [Op.lte]: Number(max_price) }) } } : {})
                        },
                    },
                ],
                order: [
                    [sequelize.literal('distance'), 'ASC']
                ],
                distinct: true,
                limit: perPage,
                offset: offset,
            };
            if (category) adsQuery.where.category = category;
            if (keyword) {                
                adsQuery.where = {
                    ...adsQuery.where,
                    [Op.or]: [
                        { category: { [Op.like]: `%${keyword}%` } },
                        { title: { [Op.like]: `%${keyword}%` } },
                        { description: { [Op.like]: `%${keyword}%` } },
                    ]
                };
            }
            if (location_type === 'locality' || location_type === 'place') {
                adsQuery.include.push({
                    model: AdLocation,
                    as: 'ad_location',
                    where: {
                        [Op.or]: [
                            { locality: location },
                            { place: location }
                        ]
                    }
                });
            } else {
                adsQuery.include.push({
                    model: AdLocation,
                    as: 'ad_location',
                    where: {
                        [Op.or]: [
                            { state: location },
                            { country: location }
                        ]
                    }
                });
            }
        }
        const { count, rows: ads } = await Ad.findAndCountAll(adsQuery);
        
        const userId = user_id;
        let wishListAdIds;
        if(userId){
            const wishLists = await AdWishLists.findAll({
                where: { user_id: userId },
                attributes: ['ad_id']
            });
            wishListAdIds = wishLists.map(wishList => wishList.ad_id);
            ads.map(ad => {
                ad.wishListed = wishListAdIds.includes(ad.ad_id);
                if (ad.user) {
                    ad.user = ad.user.toJSON();
                    delete ad.user.token;
                }
            });
        }
        const formattedAds = await Promise.all(
            ads.map(ad => formatAd(ad, { userId: user_id, wishListAdIds }))
        );
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`;
        const response = {
            ...formatPagination({ page: Number(page), perPage, total: count, path: fullUrl }),
            data: formattedAds
        };
        res.status(responseStatusCodes.success).json(response);
    } catch (error) {
        res.status(responseStatusCodes.internalServerError).json({ message: 'Server error' });
    }
};

exports.bestServiceProviders = async (req, res) => {
    try {
        const perPage = 10;
        const { location_type, location, latitude, longitude, page = 1, user_id } = req.body;        
        const offset = (page - 1) * perPage;
        const hasLocation = location_type && location && latitude && longitude;
        let adsQuery;
        if (hasLocation) {
            adsQuery = {
                where: {
                    ad_type: 'service',
                    ad_status: 'online',
                    user_id: { [Op.ne]: user_id },
                    ad_stage: 3
                },
                attributes: {
                    include: [
                        [literal(`(SELECT COUNT(*) FROM ad_wish_lists WHERE ad_wish_lists.ad_id = Ad.ad_id)`), 'ad_wish_lists_count'],
                        [literal(`(SELECT COUNT(*) FROM ad_views WHERE ad_views.ad_id = Ad.ad_id)`), 'ad_views_count'],
                        [
                            literal(`(
                                SELECT (6371 * 
                                    acos(cos(radians(${latitude})) * cos(radians(ad_location.latitude)) * 
                                    cos(radians(ad_location.longitude) - radians(${longitude})) + 
                                    sin(radians(${latitude})) * sin(radians(ad_location.latitude)))
                                ) AS distance
                            )`), 'distance'
                        ],
                    ]
                },
                include: [
                    { model: User, as: 'user' },
                    { model: AdImage, as: 'ad_images' },
                    { model: AdPriceDetails, as: 'ad_price_details' },
                ],
                order: [
                    [sequelize.literal('ad_wish_lists_count'), 'ASC'],
                    [sequelize.literal('ad_views_count'), 'ASC'],
                    [sequelize.literal('distance'), 'ASC'],
                ],
                distinct: true,
                limit: perPage,
                offset: offset,
            };
            if (user_id) {
                adsQuery.where.user_id = { [Op.ne]: user_id };
            }
            if (location_type === 'locality' || location_type === 'place') {
                adsQuery.include.push({
                    model: AdLocation,
                    as: 'ad_location',
                    where: {
                        [Op.or]: [
                            { locality: location },
                            { place: location }
                        ]
                    }
                });
            } else {
                adsQuery.include.push({
                    model: AdLocation,
                    as: 'ad_location',
                    where: {
                        [Op.or]: [
                            { state: location },
                            { country: location }
                        ]
                    }
                });
            }
        } else {
            adsQuery = {
                where: {
                    ad_type: 'service',
                    ad_status: 'online',
                    ad_stage: 3
                },
                attributes: {
                    include: [
                        [literal(`(SELECT COUNT(*) FROM ad_wish_lists WHERE ad_wish_lists.ad_id = Ad.ad_id)`), 'ad_wish_lists_count'],
                        [literal(`(SELECT COUNT(*) FROM ad_views WHERE ad_views.ad_id = Ad.ad_id)`), 'ad_views_count'],
                    ]
                },
                include: [
                    { model: User, as: 'user' },
                    { model: AdImage, as: 'ad_images' },
                    { model: AdPriceDetails, as: 'ad_price_details' },
                    {
                        model: AdLocation,
                        as: 'ad_location'
                    }
                ],
                order: [
                    [sequelize.literal('ad_wish_lists_count'), 'DESC'],
                    [sequelize.literal('ad_views_count'), 'DESC'],
                ],
                distinct: true,
                limit: perPage,
                offset: offset,
            };
            if (user_id) {
                adsQuery.where.user_id = { [Op.ne]: user_id };
            }
        }

        const { count, rows: ads } = await Ad.findAndCountAll(adsQuery);
        const formattedAds = await Promise.all(
            ads.map(ad => formatAd(ad, { userId: user_id, wishListAdIds, includeCounts: true }))
        );
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`;
        res.status(responseStatusCodes.success).json({
            ...formatPagination({ page: Number(page), perPage, total: count, path: fullUrl }),
            data: formattedAds
        });
    } catch (error) {
        res.status(responseStatusCodes.internalServerError).json({ message: 'Server error' });
    }
};

exports.adCategoriesFor = async (req, res) => {
    try {
        const adCategoriesArray = []
        res.status(responseStatusCodes.success).json(adCategoriesArray);
    } catch (error) {
        res.status(responseStatusCodes.internalServerError).json({ message: 'Server error' });
    }
};

exports.addToWishlist = async (req, res) => {
    try {
        const { ad_id } = req.body;
        const userId = req.user.id;
        const wishList = await AdWishLists.findOne({
            where: {
                ad_id: ad_id,
                user_id: userId
            }
        });
        if (wishList) {
            await wishList.destroy();
            return res.status(responseStatusCodes.success).json({ success: true, message: 'Wishlist removed' });
        } else {
            await AdWishLists.create({
                user_id: userId,
                ad_id: ad_id
            });
            return res.status(responseStatusCodes.success).json({ success: true, message: 'Wishlist added' });
        }
    } catch (error) {
        res.status(responseStatusCodes.internalServerError).json({ message: 'Server error' });
    }
};

exports.changeOnlineStatus = async (req, res) => {
    try {
        const { ad_id } = req.body;
        const ad = await Ad.findOne({ where: { ad_id } });
        if (!ad) {
            return res.status(responseStatusCodes.notFound).json({ message: 'Ad not found' });
        }
        ad.ad_status = ad.ad_status === 'online' ? 'offline' : 'online';
        await ad.save();
        res.status(responseStatusCodes.success).json({ message: `Ad status changed to ${ad.ad_status}` });
    } catch (error) {
        res.status(responseStatusCodes.internalServerError).json({ message: 'Server error' });
    }
};