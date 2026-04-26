const joi = require("joi");

module.exports = {
  createUserAdAdminValidation: async (req, res, next) => {
    try {
      // Validate top-level body fields first
      const schema = joi.object({
        name: joi.string().trim().optional(),
        phone: joi
          .string()
          .pattern(/^\d{10}$/)
          .required()
          .messages({
            "string.pattern.base": "Phone must be a valid 10-digit number",
            "any.required": "Phone is required",
          }),
        ads: joi.string().required().messages({
          "any.required": "Ads data is required",
        }),
        location: joi.string().required().messages({
          "any.required": "Location data is required",
        }),
      });

      await schema.validateAsync(req.body);

      // Validate parsed ads JSON
      const adsSchema = joi
        .array()
        .items(
          joi.object({
            title: joi.string().trim().required().messages({
              "any.required": "Ad title is required",
            }),
            description: joi.string().trim().required().messages({
              "any.required": "Ad description is required",
            }),
            category: joi.string().required().messages({
              "any.required": "Ad category is required",
            }),
            type: joi.string().required().messages({
              "any.required": "Ad type is required",
            }),
            prices: joi
              .array()
              .items(
                joi.object({
                  unit: joi.string().required().messages({
                    "any.required": "Price unit is required",
                  }),
                  price: joi.number().positive().required().messages({
                    "number.positive": "Price must be a positive number",
                    "any.required": "Price is required",
                  }),
                  category: joi.string().required().messages({
                    "any.required": "Category is required",
                  }),
                }),
              )
              .optional(),
          }),
        )
        .min(1)
        .required()
        .messages({
          "array.min": "At least one ad is required",
        });

      const parsedAds = JSON.parse(req.body.ads);
      await adsSchema.validateAsync(parsedAds);

      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  getSalesAdsValidator: async (req, res, next) => {
    try {
      const schema = joi.object({
        limit: joi.number().integer().min(1).default(10),
        offset: joi.number().integer().min(0).default(0),
      });

      await schema.validateAsync(req.query);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },

  getSalesUsersValidator: async (req, res, next) => {
    try {
      const schema = joi.object({
        limit: joi.number().integer().min(1).default(10),
        offset: joi.number().integer().min(0).default(0),
      });

      await schema.validateAsync(req.query);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
};
