const { responseStatusCodes, responseMessages } = require("./appConstants");
const {
  PutObjectCommand,
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { Op, literal } = require("sequelize");
const sharp = require("sharp");

require("dotenv").config();

const createErrorResponse = (
  message,
  data,
  statusCode = responseStatusCodes.badRequest,
  success = false,
) => {
  return { success, statusCode, message, data };
};

const createSuccessResponse = (
  message,
  data,
  statusCode = responseStatusCodes.success,
  success = true,
) => {
  return { success, statusCode, message, data };
};

const globalResponseHandler = (req, res, next) => {
  try {
    if (!req?.body) req.body = {};
    res.success = (message, data, statusCode = responseStatusCodes.success) =>
      res
        .status(statusCode || responseStatusCodes.success)
        .json(createSuccessResponse(message, data, statusCode));

    res.error = (message, data, statusCode = responseStatusCodes.badRequest) =>
      res
        .status(statusCode || responseStatusCodes.badRequest)
        .json(createErrorResponse(message, data, statusCode));

    return next();
  } catch (error) {
    return res
      .status(statusCode || responseStatusCodes.internalServerError)
      .json(createErrorResponse(error.message, statusCode, data));
  }
};

const unknownRouteHandler = (req, res) =>
  res.error(responseMessages.urlNotFound, responseStatusCodes.notFound);
const globalErrorHandler = (err, req, res, next) =>
  res
    .status(responseStatusCodes.internalServerError)
    .json(
      createErrorResponse(err?.message || responseMessages.somethingwentWrong),
    );

const unhandledErrorHandler = (error) => {
  console.log("====== Unhandled Error ====");
  console.log({
    message: error?.message || String(error),
    stack: JSON.stringify(error?.stack),
  });
  console.log("=========================");
};

const s3 = new S3Client({
  region: process.env.BUCKET_REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
});

async function uploadToS3(file, fileName) {
  try {
    let fileBuffer = file.buffer;
    let contentType = file.mimetype;
    const isImage = file.mimetype.startsWith("image/");

    // if (isImage) {
    //   const sharpInstance = sharp(file.buffer).resize(800, 600, {
    //     fit: "inside",
    //     withoutEnlargement: true,
    //   });

    //   if (file.mimetype === "image/jpeg") {
    //     fileBuffer = await sharpInstance
    //       .jpeg({ quality: 75, progressive: false, mozjpeg: true })
    //       .toBuffer();
    //   } else if (file.mimetype === "image/png") {
    //     fileBuffer = await sharpInstance
    //       .png({ compressionLevel: 8, progressive: false })
    //       .toBuffer();
    //   } else {
    //     // Fallback for other image types — just pass through
    //     fileBuffer = await sharpInstance.toBuffer();
    //   }
    // }
    if (isImage) {
      const sharpInstance = sharp(file.buffer)
        .rotate()
        .resize(800, 600, {
          fit: "inside",
          withoutEnlargement: true,
        });

      if (file.mimetype === "image/jpeg") {
        fileBuffer = await sharpInstance
          .jpeg({
            quality: 75,
            mozjpeg: true,
          })
          .toBuffer();
      } else if (file.mimetype === "image/png") {
        fileBuffer = await sharpInstance
          .png({
            compressionLevel: 8,
          })
          .toBuffer();
      } else {
        fileBuffer = await sharpInstance.toBuffer();
      }
    }
    // if (isImage) {
    //   const sharpInstance = sharp(file.buffer)
    //     .rotate() // ✅ handles JPEG EXIF rotation
    //     .resize(800, 600, {
    //       fit: "inside",
    //       withoutEnlargement: true,
    //     })
    //     .withMetadata(); // ✅ preserves original metadata for all formats

    //   if (file.mimetype === "image/jpeg") {
    //     fileBuffer = await sharpInstance
    //       .jpeg({ quality: 75, progressive: false, mozjpeg: true })
    //       .toBuffer();
    //   } else if (file.mimetype === "image/png") {
    //     fileBuffer = await sharpInstance
    //       .png({ compressionLevel: 8, progressive: false })
    //       .toBuffer();
    //   } else {
    //     fileBuffer = await sharpInstance.toBuffer();
    //   }
    // }

    const command = new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: fileName,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await s3.send(command);
    return { success: true, finalFilename: fileName };
  } catch (error) {
    console.error("S3 upload error:", error);
    return { success: false, finalFilename: null };
  }
}

function getImageUrlPublic(imageKey) {
  const url = `https://${process.env.BUCKET_NAME}.s3.${process.env.BUCKET_REGION}.amazonaws.com/${imageKey}`;
  return url;
}
async function getImageUrl(imageKey) {
  const command = new GetObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: imageKey,
  });
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
    return false;
  }
}

// utils/formatAd.js
// async function formatAd(ad, options = {}) {
//   const includeUser = options.includeUser ?? true;
//   const includeCounts = options.includeCounts ?? false;

//   return {
//     id: ad.ad_id,
//     ad_id: ad.ad_id,
//     user_id: ad.user_id,
//     title: ad.title,
//     category: ad.category,
//     description: ad.description,
//     ad_type: ad.ad_type,
//     ad_status: ad.ad_status,
//     ad_stage: ad.ad_stage,
//     createdAt: ad.createdAt?.toISOString(),
//     updatedAt: ad.updatedAt?.toISOString(),
//     ...(ad.dataValues?.distance !== undefined && {
//       distance: ad.dataValues.distance,
//     }),
//     ...(includeCounts
//       ? {
//           ad_wish_lists_count: ad.dataValues?.ad_wish_lists_count ?? 0,
//           ad_views_count: ad.dataValues?.ad_views_count ?? 0,
//         }
//       : {}),
//     user:
//       includeUser && ad.user
//         ? {
//             id: ad.user.id,
//             user_id: ad.user.user_id,
//             name: ad.user.name,
//             email: ad.user.email,
//             email_uid: ad.user.email_uid,
//             mobile_number: ad.user.mobile_number,
//             profile: ad.user.profile
//               ? getImageUrlPublic(ad.user.profile)
//               : null,
//             description: ad.user.description,
//             notification_token: ad.user.notification_token,
//           }
//         : undefined,
//     ad_images: ad.ad_images
//       ? await Promise.all(
//           ad.ad_images.map(async (image) => ({
//             id: image.id,
//             ad_id: image.ad_id,
//             image: image.image ? getImageUrlPublic(image.image) : null,
//             createdAt: image.createdAt?.toISOString(),
//             updatedAt: image.updatedAt?.toISOString(),
//           }))
//         )
//       : [],
//     ad_location: ad.ad_location
//       ? {
//           id: ad.ad_location.id,
//           ad_id: ad.ad_location.ad_id,
//           locality: ad.ad_location.locality ?? "",
//           place: ad.ad_location.place ?? "",
//           district: ad.ad_location.district ?? "",
//           state: ad.ad_location.state ?? "",
//           country: ad.ad_location.country ?? "",
//           longitude: `${ad.ad_location.longitude}`,
//           latitude: `${ad.ad_location.latitude}`,
//           createdAt: ad.ad_location.createdAt?.toISOString(),
//           updatedAt: ad.ad_location.updatedAt?.toISOString(),
//         }
//       : null,
//     ad_price_details: ad.ad_price_details
//       ? ad.ad_price_details.map((priceDetail) => ({
//           id: priceDetail.id,
//           ad_id: priceDetail.ad_id,
//           rent_duration: priceDetail.rent_duration,
//           rent_price: priceDetail.rent_price,
//           createdAt: priceDetail.createdAt?.toISOString(),
//           updatedAt: priceDetail.updatedAt?.toISOString(),
//         }))
//       : [],
//   };
// }

// utils/formatAd.js - OPTIMIZED VERSION
function formatAd(ad, options = {}) {
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
    ...(ad.dataValues?.distance !== undefined && {
      distance: ad.dataValues.distance,
    }),
    ...(includeCounts
      ? {
          ad_wish_lists_count: ad.dataValues?.ad_wish_lists_count ?? 0,
          ad_views_count: ad.dataValues?.ad_views_count ?? 0,
        }
      : {}),
    user:
      includeUser && ad.user
        ? {
            id: ad.user.id,
            user_id: ad.user.user_id,
            name: ad.user.name,
            email: ad.user.email,
            email_uid: ad.user.email_uid,
            mobile_number: ad.user.mobile_number,
            profile: ad.user.profile
              ? getImageUrlPublic(ad.user.profile)
              : null,
            description: ad.user.description,
            notification_token: ad.user.notification_token,
          }
        : undefined,
    ad_images: ad.ad_images
      ? ad.ad_images.map((image) => ({
          id: image.id,
          ad_id: image.ad_id,
          image: image.image ? getImageUrlPublic(image.image) : null,
          createdAt: image.createdAt?.toISOString(),
          updatedAt: image.updatedAt?.toISOString(),
        }))
      : [],
    ad_location: ad.ad_location
      ? {
          id: ad.ad_location.id,
          ad_id: ad.ad_location.ad_id,
          locality: ad.ad_location.locality ?? "",
          place: ad.ad_location.place ?? "",
          district: ad.ad_location.district ?? "",
          state: ad.ad_location.state ?? "",
          country: ad.ad_location.country ?? "",
          longitude: `${ad.ad_location.longitude}`,
          latitude: `${ad.ad_location.latitude}`,
          createdAt: ad.ad_location.createdAt?.toISOString(),
          updatedAt: ad.ad_location.updatedAt?.toISOString(),
        }
      : null,
    ad_price_details: ad.ad_price_details
      ? ad.ad_price_details.map((priceDetail) => ({
          id: priceDetail.id,
          ad_id: priceDetail.ad_id,
          rent_duration: priceDetail.rent_duration,
          rent_price: priceDetail.rent_price,
          createdAt: priceDetail.createdAt?.toISOString(),
          updatedAt: priceDetail.updatedAt?.toISOString(),
        }))
      : [],
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
        active: page > 1,
      },
      {
        url: buildUrl(page),
        label: `${page}`,
        active: true,
      },
      {
        url: page < totalPages ? buildUrl(page + 1) : null,
        label: "Next &raquo;",
        active: page < totalPages,
      },
    ],
    next_page_url: page < totalPages ? buildUrl(page + 1) : null,
    path,
    per_page: perPage,
    prev_page_url: page > 1 ? buildUrl(page - 1) : null,
    to: Math.min(offset + perPage, total),
    total,
  };
}

function getDistanceCalculation(lat, lng) {
  const safeLat = parseFloat(lat);
  const safeLng = parseFloat(lng);

  if (isNaN(safeLat) || isNaN(safeLng)) {
    throw new Error("Invalid coordinates for distance calculation");
  }

  return literal(`(
    6371 * acos(
      cos(radians(${safeLat})) * 
      cos(radians(ad_location.latitude)) * 
      cos(radians(ad_location.longitude) - radians(${safeLng})) + 
      sin(radians(${safeLat})) * 
      sin(radians(ad_location.latitude))
    )
  )`);
}

function buildLocationWhere(location_type, location) {
  return location_type === "locality" || location_type === "place"
    ? { [Op.or]: [{ locality: location }, { place: location }] }
    : { [Op.or]: [{ state: location }, { country: location }] };
}

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

function generateRoomId() {
  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 1000);
  const userId = `${timestamp}${randomNum}`;
  return parseInt(userId);
}

function generateAdId() {
  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 1000);
  const userId = `${timestamp}${randomNum}`;
  return parseInt(userId);
}

function escapeXml(unsafe) {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function logoBufferHeightRatio(_buf) {
  return 0.35;
}
// Extracted helper — generates a placeholder image when no files are uploaded
const generatePlaceholderImage = async (ad, width = 800, height = 400) => {
  const logoPath = path.join(__dirname, "../../../../assets/logo2.png");

  const logoBuffer = await sharp(logoPath)
    .resize(Math.round(width * 0.7))
    .png()
    .toBuffer();

  const logoBase64 = logoBuffer.toString("base64");
  const nameText = escapeXml(ad.title || "Ad");

  const textSvg = `
        <svg width="${width}" height="${height}">
            <rect width="100%" height="100%" fill="white"/>
            <style>
                .title { font-size: 110px; font-weight: 700; fill: #353333ff; text-anchor: middle; dominant-baseline: middle; }
            </style>
            <text x="50%" y="45%" class="title">${nameText}</text>
        </svg>
    `;

  const logoSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
            <image
                href="data:image/png;base64,${logoBase64}"
                x="${(width - Math.round(width * 0.7)) / 2}"
                y="${(height - Math.round(width * 0.7) * logoBufferHeightRatio(logoBuffer)) / 2}"
                width="${Math.round(width * 0.7)}"
                preserveAspectRatio="xMidYMid meet"
                opacity="0.2"
            />
        </svg>
    `;

  return sharp(Buffer.from(textSvg))
    .png()
    .composite([{ input: Buffer.from(logoSvg), top: 0, left: 0 }])
    .jpeg({ quality: 92 });
};

module.exports = {
  globalResponseHandler,
  globalErrorHandler,
  unhandledErrorHandler,
  unknownRouteHandler,
  createErrorResponse,
  createSuccessResponse,
  getImageUrl,
  deleteImageFromS3,
  uploadToS3,
  formatAd,
  formatPagination,
  getImageUrlPublic,
  getDistanceCalculation,
  buildLocationWhere,
  generateUserId,
  generateAdId,
  generateRoomId,
  generateAdId,
  generatePlaceholderImage,
  s3
};
