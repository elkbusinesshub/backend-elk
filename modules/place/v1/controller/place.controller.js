const Place = require("../../../../models/place.model");
const axios = require("axios");
const {
  responseStatusCodes,
  responseMessages,
} = require("../../../../helpers/appConstants");

require("dotenv").config();

const mapBoxToken = process.env.MAP_BOX_TOKEN;

async function savePlace(places) {
  try {
    for (const place of places) {
      if (
        place.type == "locality" ||
        place.type == "place" ||
        place.type == "district" ||
        place.type == "state" ||
        place.type == "country"
      ) {
        let dataToSave = {
          type: place.type,
          latitude: place.latitude,
          longitude: place.longitude,
        };
        if (place.type === "locality") {
          dataToSave.locality = place.name;
          dataToSave.place = place.place || null;
          dataToSave.district = place.district || null;
          dataToSave.state = place.state || null;
          dataToSave.country = place.country || null;
        } else if (place.type === "place") {
          dataToSave.place = place.name;
          dataToSave.district = place.district || null;
          dataToSave.state = place.state || null;
          dataToSave.country = place.country || null;
        } else if (place.type === "district") {
          dataToSave.district = place.name;
          dataToSave.state = place.state || null;
          dataToSave.country = place.country || null;
        } else if (place.type === "state") {
          dataToSave.state = place.name;
          dataToSave.country = place.country || null;
        } else if (place.type === "country") {
          dataToSave.country = place.name;
        }
        await Place.create(dataToSave);
      }
    }
  } catch (error) {
    console.error("Error saving places:", error);
  }
}

const PLACE_TYPE_MAP = { region: "state", neighborhood: "locality" };
const CTX_KEY_MAP = { street: "street", locality: "locality", place: "place", district: "district", region: "state", country: "country" };

exports.getPlace = async (req, res, next) => {
  const { longitude, latitude } = req.query;

  try {
    const response = await axios.get(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json`,
      { params: { access_token: mapBoxToken } }
    );

    const places = response.data.features;

    if (!places.length) {
      return res.success(responseMessages.locationNotFound, null, responseStatusCodes.notFound);
    }

    const results = places.map((feature) => {
      const placeType = feature.place_type[0];
      const context = feature.context || [];
      const data = {
        type: PLACE_TYPE_MAP[placeType] ?? placeType,
        name: feature.text || feature.properties?.name,
      };

      context.forEach((ctx) => {
        const key = Object.keys(CTX_KEY_MAP).find((k) => ctx.id.includes(k));
        if (key) data[CTX_KEY_MAP[key]] = ctx.text;
      });

      if (feature.geometry && placeType !== "street") {
        data.latitude = feature.geometry.coordinates[1];
        data.longitude = feature.geometry.coordinates[0];
      }

      return data;
    });

    await savePlace(results).catch((err) => logger.error("savePlace failed", err));

    return res.success(responseMessages.loactionDataFetched, results[0]);
  } catch (error) {
    return next(error);
  }
};

const mapBoxSearchPlace = async (place) => {
  const countryCode = "in";
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(
    place
  )}&country=${countryCode}&proximity=ip&language=en&access_token=${mapBoxToken}`;

  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    throw new Error(`Error fetching place data from MapBox: ${error.message}`);
  }
};

exports.placeSearch = async (req, res, next) => {
  const { query, limited } = req.body;
  // if (!query || typeof limited !== 'boolean') {
  //     return res.status(responseStatusCodes.badRequest).json({ message: responseMessages.invalidRequest });
  // }
  try {
    const places = await mapBoxSearchPlace(query);
    if (places.features && places.features.length > 0) {
      const results = places.features.map((feature) => {
        const data = {};
        const property = feature.properties || {};
        const context = property.context || {};

        data.type =
          property.feature_type === "region" ? "state" : property.feature_type;
        data.name = property.name || "";

        if (context.street) data.street = context.street.name;
        if (context.locality) data.locality = context.locality.name;
        if (context.place) data.place = context.place.name;
        if (context.district) data.district = context.district.name;
        if (context.region) data.state = context.region.name;
        if (context.country) data.country = context.country.name;

        if (feature.geometry && property.feature_type !== "street") {
          data.latitude = feature.geometry.coordinates[1];
          data.longitude = feature.geometry.coordinates[0];
        }
        return data;
      });
      savePlace(results);
      // return res.json(results);
      return res.success(responseMessages.loactionDataFetched, results);
    } else {
      // return res.status(responseStatusCodes.notFound).json({ message: responseMessages.locationNotFound });
      return res.success(
        responseMessages.locationNotFound,
        null,
        responseStatusCodes.notFound
      );
    }
  } catch (error) {
    // return res.status(responseStatusCodes.internalServerError).json({ message: responseMessages.internalServerError, message: error.message });
    return next(error);
  }
};

exports.getPlaces = async (req, res, next) => {
  const { type, state, city } = req.query;
  try {
    let query;
    switch (type) {
      case "state":
        query = Place.aggregate([
          { $match: { type: "state" } },
          {
            $group: {
              _id: "$state",
              value: { $first: "$state" },
              latitude: { $max: "$latitude" },
              longitude: { $max: "$longitude" },
              count: { $sum: 1 },
            },
          },
        ]);
        break;
      case "city":
        if (!state) {
          //   return res
          //     .status(responseStatusCodes.badRequest)
          //     .json({ message: responseMessages.invalidRequest });
          return res.error(responseMessages.invalidRequest);
        }
        query = Place.aggregate([
          { $match: { type: "city", state } },
          {
            $group: {
              _id: "$city",
              value: { $first: "$city" },
              latitude: { $max: "$latitude" },
              longitude: { $max: "$longitude" },
              count: { $sum: { $cond: [{ $ne: ["$locality", null] }, 1, 0] } },
            },
          },
        ]);
        break;
      case "locality":
        if (!state || !city) {
          //   return res
          //     .status(responseStatusCodes.badRequest)
          //     .json({ message: responseMessages.invalidRequest });
          return res.error(responseMessages.invalidRequest);
        }
        query = Place.aggregate([
          { $match: { type: "locality", state, city } },
          {
            $group: {
              _id: "$locality",
              value: { $first: "$locality" },
              latitude: { $max: "$latitude" },
              longitude: { $max: "$longitude" },
              count: { $sum: { $cond: [{ $ne: ["$locality", null] }, 1, 0] } },
            },
          },
        ]);
        break;
      default:
        // return res
        //   .status(responseStatusCodes.badRequest)
        //   .json({ message: responseMessages.invalidRequest });
        return res.error(responseMessages.invalidRequest);
    }
    const results = await query;
    // return res.json(results);
    return res.success(responseMessages.loactionDataFetched, results);
  } catch (error) {
    // return res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ message: responseMessages.internalServerError });
    return next(error);
  }
};