// services/ad.service.js
const { Op, literal } = require("sequelize");
const UserSearch = require("../../../../models/userSearch.model");
const BlockedUser = require("../../../../models/blockedUser.model");
const User = require("../../../../models/user.model");
const AdImage = require("../../../../models/adImage.model");
const AdLocation = require("../../../../models/adLocation.model");
const AdPriceDetails = require("../../../../models/adPriceDetails.model");
const { getDistanceCalculation, buildLocationWhere } = require("../../../../helpers/utils");

//Determine location filtering and distance calculation configuration
function getLocationConfig(userSearches, userLat, userLng) {
  // Priority 1: User's search history
  if (userSearches.length > 0) {
    const search = userSearches[0];
    const hasCoordinates =
      search.latitude !== null && search.longitude !== null;

    if (search.location && search.location_type) {
      const config = {
        lat: hasCoordinates ? search.latitude : null,
        lng: hasCoordinates ? search.longitude : null,
      };

      // Location-based filtering
      if (
        search.location_type === "locality" ||
        search.location_type === "place"
      ) {
        config.where = {
          [Op.or]: [{ locality: search.location }, { place: search.location }],
        };
      } else {
        config.where = {
          [Op.or]: [{ state: search.location }, { country: search.location }],
        };
      }

      return config;
    }
  }

  // Priority 2: User's current location
  if (userLat && userLng) {
    return {
      lat: userLat,
      lng: userLng,
    };
  }

  // No location-based sorting
  return null;
}

//Fetch user's recent searches
async function fetchUserSearches(userId) {
  return await UserSearch.findAll({
    where: { user_id: userId },
    order: [["createdAt", "DESC"]],
    limit: 1,
    attributes: ["location", "location_type", "latitude", "longitude"],
    raw: true,
  });
}

//Fetch blocked user IDs
async function fetchBlockedUserIds(userId) {
  const blockedRecords = await BlockedUser.findAll({
    where: {
      [Op.or]: [{ blocker_id: userId }, { blocked_id: userId }],
    },
    attributes: ["blocker_id", "blocked_id"],
    raw: true,
  });

  const blockedIds = new Set();
  blockedRecords.forEach((record) => {
    if (record.blocker_id !== userId) blockedIds.add(record.blocker_id);
    if (record.blocked_id !== userId) blockedIds.add(record.blocked_id);
  });

  return Array.from(blockedIds);
}

// Build ads query with all conditions
function buildAdsQuery({
  userId,
  blockedUserIds,
  userSearches,
  userLat,
  userLng,
  perPage,
  offset,
}) {
  const query = {
    where: {
      ad_status: "online",
      ad_type: "rent",
      ad_stage: 3,
    },
    include: [
      {
        model: User,
        as: "user",
        attributes: [
          "id",
          "user_id",
          "name",
          "email",
          "email_uid",
          "mobile_number",
          "profile",
          "description",
          "notification_token",
        ],
      },
      {
        model: AdImage,
        as: "ad_images",
        attributes: ["id", "ad_id", "image", "createdAt", "updatedAt"],
      },
      {
        model: AdPriceDetails,
        as: "ad_price_details",
        attributes: [
          "id",
          "ad_id",
          "rent_duration",
          "rent_price",
          "createdAt",
          "updatedAt",
        ],
      },
    ],
    distinct: true,
    limit: perPage,
    offset: offset,
    subQuery: false, // Important for performance with includes
  };

  // Exclude user's own ads and blocked users
  if (userId) {
    const excludedUsers = [userId, ...blockedUserIds];
    query.where.user_id = { [Op.notIn]: excludedUsers };
  }

  // Handle location-based filtering and distance calculation
  const locationConfig = getLocationConfig(userSearches, userLat, userLng);

  if (locationConfig) {
    query.include.push({
      model: AdLocation,
      as: "ad_location",
      attributes: [
        "id",
        "ad_id",
        "locality",
        "place",
        "district",
        "state",
        "country",
        "longitude",
        "latitude",
        "createdAt",
        "updatedAt",
      ],
      ...(locationConfig.where && { where: locationConfig.where }),
      required: true,
    });

    // Add distance calculation if coordinates available
    if (locationConfig.lat && locationConfig.lng) {
      query.attributes = {
        include: [
          [
            getDistanceCalculation(locationConfig.lat, locationConfig.lng),
            "distance",
          ],
        ],
      };
      query.order = [[literal("distance"), "ASC"]];
    }
  } else {
    // Default: include location without filtering
    query.include.push({
      model: AdLocation,
      as: "ad_location",
      attributes: [
        "id",
        "ad_id",
        "locality",
        "place",
        "district",
        "state",
        "country",
        "longitude",
        "latitude",
        "createdAt",
        "updatedAt",
      ],
      required: true,
    });
  }

  return query;
}

function buildServiceProvidersQuery({
  userId,
  blockedUserIds,
  userLat,
  userLng,
  location,
  location_type,
  hasLocation,
  perPage,
  offset,
}) {
  const userWhere = userId
    ? { [Op.and]: [{ [Op.ne]: userId }, { [Op.notIn]: blockedUserIds }] }
    : undefined;

  const baseWhere = {
    ad_type: "service",
    ad_status: "online",
    ad_stage: 3,
    ...(userWhere && { user_id: userWhere }),
  };

  const baseIncludes = [
    { model: User, as: "user" },
    { model: AdImage, as: "ad_images" },
    { model: AdPriceDetails, as: "ad_price_details" },
  ];

  const wishlistCountLiteral = literal(
    `(SELECT COUNT(*) FROM ad_wish_lists WHERE ad_wish_lists.ad_id = Ad.ad_id)`,
  );
  const viewsCountLiteral = literal(
    `(SELECT COUNT(*) FROM ad_views WHERE ad_views.ad_id = Ad.ad_id)`,
  );

  if (hasLocation) {
    // Validate coords (same as recommendedPosts guard)
    const distanceLiteral = literal(`(
      SELECT (6371 *
        acos(
          cos(radians(${userLat})) * cos(radians(ad_location.latitude)) *
          cos(radians(ad_location.longitude) - radians(${userLng})) +
          sin(radians(${userLat})) * sin(radians(ad_location.latitude))
        )
      ) AS distance
    )`);

    return {
      where: baseWhere,
      attributes: {
        include: [
          [wishlistCountLiteral, "ad_wish_lists_count"],
          [viewsCountLiteral, "ad_views_count"],
          [distanceLiteral, "distance"],
        ],
      },
      include: [
        ...baseIncludes,
        {
          model: AdLocation,
          as: "ad_location",
          where: buildLocationWhere(location_type, location),
        },
      ],
      // NOTE: ASC for wish/views looks wrong — was in original, keep or fix intentionally
      order: [
        [literal("ad_wish_lists_count"), "ASC"],
        [literal("ad_views_count"), "ASC"],
        [literal("distance"), "ASC"],
      ],
      distinct: true,
      limit: perPage,
      offset,
    };
  }

  return {
    where: baseWhere,
    attributes: {
      include: [
        [wishlistCountLiteral, "ad_wish_lists_count"],
        [viewsCountLiteral, "ad_views_count"],
      ],
    },
    include: [...baseIncludes, { model: AdLocation, as: "ad_location" }],
    order: [
      [literal("ad_wish_lists_count"), "DESC"],
      [literal("ad_views_count"), "DESC"],
    ],
    distinct: true,
    limit: perPage,
    offset,
  };
}

module.exports = {
  fetchUserSearches,
  fetchBlockedUserIds,
  buildServiceProvidersQuery,
  buildAdsQuery,
};
