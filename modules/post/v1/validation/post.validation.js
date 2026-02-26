const joi = require("joi");

module.exports = {
  createAdValidator: async (req, res, next) => {
    try {
      const schema = joi.object({
        ad_id: joi.number().allow(null).default(null).optional(),
        title: joi.string().required(),
        description: joi.string().required(),
        ad_type: joi.string().required(),
        category: joi.string().required(),
        ad_prices: joi.any().required(),
        ad_status: joi.string().allow(null).optional(),
        ad_stage: joi.number().allow(null).optional(),
      });
      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },

  updateAdImageValidator: async (req, res, next) => {
    try {
      const schema = joi.object({
        ad_id: joi.string().required(),
        ad_status: joi.string().optional(),
        ad_stage: joi.number().optional(),
      });
      await schema.validateAsync(req.query);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },

  updateAdAddressValidator: async (req, res, next) => {
    try {
      const schema = joi.object({
        ad_id: joi.number().required(),
        ad_stage: joi.number().allow(null).optional(),
        ad_status: joi.string().allow(null).optional(),
        country: joi.string().required(),
        latitude: joi.number().required(),
        longitude: joi.number().required(),
        state: joi.string().allow("").optional(),
        district: joi.string().allow("").optional(),
        locality: joi.string().allow("").optional(),
        place: joi.string().allow("").optional(),
      });
      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  getAdDetailsValidator: async (req, res, next) => {
    try {
      const schema = joi.object({
        ad_id: joi.number().optional(),
        user_id: joi.number().optional(),
      });
      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  deleteAdImageValidator: async (req, res, next) => {
    try {
      const schema = joi.object({
        id: joi.string().required(),
      });
      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  deleteAdValidator: async (req, res, next) => {
    try {
      const schema = joi.object({
        adId: joi.string().required(),
      });
      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  changeOnlineStatusValidator: async (req, res, next) => {
    try {
      const schema = joi.object({
        ad_id: joi.string().required(),
      });
      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  recommentedPostsValidator: async (req, res, next) => {
    try {
      const schema = joi.object({
        latitude: joi.number().optional(),
        longitude: joi.number().optional(),
        limit: joi.number().integer().min(1).optional(),
       id: joi.number().integer().optional(),
        offset: joi.number().integer().min(0).optional(),
      });

      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  rentCategoryPostsValidator: async (req, res, next) => {
    try {
      const schema = joi.object({
        ad_type: joi.string().required().messages({
          "any.required": "Ad type is required",
          "string.empty": "Ad type is required",
        }),
        location_type: joi.string().optional(),
        location: joi.string().optional(),
        latitude: joi.number().optional(),
        longitude: joi.number().optional(),
        category: joi.string().allow('').empty('').default(null).optional(),
        keyword: joi.string().allow('').empty('').default(null).optional(),
        limit: joi.number().integer().min(1).default(1).optional(),
        offset: joi.number().integer().min(0).default(0).optional(),
        user_id: joi.string().optional(),
        min_price: joi.number().optional(),
        max_price: joi.number().optional(),
      });

      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  searchCategoriesValidator: async (req, res, next) => {
    try {
      const schema = joi.object({
        ad_type: joi.string().required().messages({
          "any.required": "Ad type is required",
          "string.empty": "Ad type is required",
        }),
        keyword: joi.string().required(),
      });

      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  bestServiceProvidersValidator: async (req, res, next) => {
    try {
      const schema = joi
        .object({
          location_type: joi
            .string()
            .valid("state", "city", "locality", "place","country")
            .optional(),
          location: joi.string().optional(),
          latitude: joi.number().optional(),
          longitude: joi.number().optional(),
          limit: joi.number().integer().min(1).default(1),
          offset: joi.number().integer().min(0),
          user_id: joi.number().optional(),
        })
        .custom((value, helpers) => {
          const hasAny =
            value.location_type ||
            value.location ||
            value.latitude ||
            value.longitude;
          const hasAll =
            value.location_type &&
            value.location &&
            value.latitude &&
            value.longitude;

          if (hasAny && !hasAll) {
            return helpers.error("any.custom", {
              message:
                "location_type, location, latitude, and longitude are all required when filtering by location",
            });
          }

          return value;
        });

      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  searchAdsValidator: async (req, res, next) => {
    try {
      const schema = joi
        .object({
          keyword: joi
            .alternatives()
            .try(joi.string(), joi.number())
            .required(),

          page: joi.number().integer().min(1).default(1),

          min_price: joi.number().min(0).optional(),

          max_price: joi.number().min(0).optional(),
        })
        .custom((value, helpers) => {
          if (
            value.min_price !== undefined &&
            value.max_price !== undefined &&
            value.min_price > value.max_price
          ) {
            return helpers.error("any.custom", {
              message: "min_price cannot be greater than max_price",
            });
          }
          return value;
        });

      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  addToWishlistValidator: async (req, res, next) => {
    try {
      const schema = joi.object({
        ad_id: joi.number().required(),
      });
      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
};
