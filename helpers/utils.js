
const { PutObjectCommand, S3Client, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

require('dotenv').config();

const s3 = new S3Client({
    region: process.env.BUCKET_REGION,
    credentials: {
        accessKeyId: process.env.ACCESS_KEY,
        secretAccessKey: process.env.SECRET_ACCESS_KEY,
    },
});

async function uploadToS3(file, fileName) {
    try {
        const command = new PutObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: fileName,
            Body: file.buffer,
            ContentType: file.mimetype,
        });
        await s3.send(command);
        return true;
    } catch (error) {
        console.error("Error uploading to S3:", error);
        return false;
    }
}

async function getImageUrl(imageKey) {
    const command = new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: imageKey,
    });
    const url = `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${imageKey}`;
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 604800 });
    return signedUrl;
}

async function deleteImageFromS3(imageKey) {
    try {
        const command = new DeleteObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: imageKey,
        });

        await s3.send(command);
        return true;
    } catch (error) {
        console.error(`Error deleting image ${imageKey}:`, error);
        return false;
    }
}

// utils/formatAd.js
async function formatAd(ad, options = {}) {
    const includeUser = options.includeUser ?? true;
    const includeCounts = options.includeCounts ?? false;

    return {
        id: ad.ad_id,
        ad_id: ad.ad_id,
        user_id: ad.user_id,
        title: ad.title,
        category: ad.category,
        description: ad.description,
        ad_type: ad.ad_type,
        ad_status: ad.ad_status,
        ad_stage: ad.ad_stage,
        createdAt: ad.createdAt?.toISOString(),
        updatedAt: ad.updatedAt?.toISOString(),
        ...(ad.dataValues?.distance !== undefined && { distance: ad.dataValues.distance }),
        ...(includeCounts ? {
            ad_wish_lists_count: ad.dataValues?.ad_wish_lists_count ?? 0,
            ad_views_count: ad.dataValues?.ad_views_count ?? 0
        } : {}),
        user: includeUser && ad.user ? {
            id: ad.user.id,
            user_id: ad.user.user_id,
            name: ad.user.name,
            email: ad.user.email,
            email_uid: ad.user.email_uid,
            mobile_number: ad.user.mobile_number,
            profile: ad.user.profile ? await getImageUrl(ad.user.profile) : null,
            description: ad.user.description,
            notification_token: ad.user.notification_token
        } : undefined,
        ad_images: ad.ad_images
            ? await Promise.all(ad.ad_images.map(async (image) => ({
                id: image.id,
                ad_id: image.ad_id,
                image: image.image ? await getImageUrl(image.image) : null,
                createdAt: image.createdAt?.toISOString(),
                updatedAt: image.updatedAt?.toISOString()
            })))
            : [],
        ad_location: ad.ad_location
            ? {
                id: ad.ad_location.id,
                ad_id: ad.ad_location.ad_id,
                locality: ad.ad_location.locality ?? '',
                place: ad.ad_location.place ?? '',
                district: ad.ad_location.district ?? '',
                state: ad.ad_location.state ?? '',
                country: ad.ad_location.country ?? '',
                longitude: `${ad.ad_location.longitude}`,
                latitude: `${ad.ad_location.latitude}`,
                createdAt: ad.ad_location.createdAt?.toISOString(),
                updatedAt: ad.ad_location.updatedAt?.toISOString()
            }
            : null,
        ad_price_details: ad.ad_price_details
            ? ad.ad_price_details.map(priceDetail => ({
                id: priceDetail.id,
                ad_id: priceDetail.ad_id,
                rent_duration: priceDetail.rent_duration,
                rent_price: priceDetail.rent_price,
                createdAt: priceDetail.createdAt?.toISOString(),
                updatedAt: priceDetail.updatedAt?.toISOString()
            }))
            : []
    };
}

function formatPagination({ page, perPage, total, path }) {
    const totalPages = Math.ceil(total / perPage);
    const offset = (page - 1) * perPage;

    const buildUrl = (pageNum) => `${path}?page=${pageNum}`;

    return {
        current_page: page,
        first_page_url: buildUrl(1),
        from: offset + 1,
        last_page: totalPages,
        last_page_url: buildUrl(totalPages),
        links: [
            {
                url: page > 1 ? buildUrl(page - 1) : null,
                label: "&laquo; Previous",
                active: page > 1
            },
            {
                url: buildUrl(page),
                label: `${page}`,
                active: true
            },
            {
                url: page < totalPages ? buildUrl(page + 1) : null,
                label: "Next &raquo;",
                active: page < totalPages
            }
        ],
        next_page_url: page < totalPages ? buildUrl(page + 1) : null,
        path,
        per_page: perPage,
        prev_page_url: page > 1 ? buildUrl(page - 1) : null,
        to: Math.min(offset + perPage, total),
        total
    };
}

module.exports = {
    getImageUrl,
    deleteImageFromS3,
    uploadToS3,
    formatAd,
    formatPagination,
};