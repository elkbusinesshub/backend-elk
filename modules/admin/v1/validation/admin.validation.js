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
            "any.required": "Phone is required"
          }),
        ads: joi.string().required().messages({
          "any.required": "Ads data is required"
        }),
        location: joi.string().required().messages({
          "any.required": "Location data is required"
        })
      });

      await schema.validateAsync(req.body);

      // Validate parsed ads JSON
      const adsSchema = joi.array().items(
        joi.object({
          title: joi.string().trim().required().messages({
            "any.required": "Ad title is required"
          }),
          description: joi.string().trim().required().messages({
            "any.required": "Ad description is required"
          }),
          category: joi.string().required().messages({
            "any.required": "Ad category is required"
          }),
          type: joi.string().required().messages({
            "any.required": "Ad type is required"
          }),
          prices: joi
            .array()
            .items(
              joi.object({
                unit: joi.string().required().messages({
                  "any.required": "Price unit is required"
                }),
                price: joi.number().positive().required().messages({
                  "number.positive": "Price must be a positive number",
                  "any.required": "Price is required"
                })
              })
            )
            .optional()
        })
      ).min(1).required().messages({
        "array.min": "At least one ad is required"
      });

      const parsedAds = JSON.parse(req.body.ads);
      await adsSchema.validateAsync(parsedAds);

      // Validate parsed location JSON
      const locationSchema = joi.object({
        place: joi.string().trim().required().messages({
          "any.required": "Place is required"
        }),
        state: joi.string().trim().required().messages({
          "any.required": "State is required"
        }),
        country: joi.string().trim().required().messages({
          "any.required": "Country is required"
        }),
        latitude: joi.number().min(-90).max(90).required().messages({
          "number.min": "Latitude must be between -90 and 90",
          "number.max": "Latitude must be between -90 and 90",
          "any.required": "Latitude is required"
        }),
        longitude: joi.number().min(-180).max(180).required().messages({
          "number.min": "Longitude must be between -180 and 180",
          "number.max": "Longitude must be between -180 and 180",
          "any.required": "Longitude is required"
        })
      });

      const parsedLocation = JSON.parse(req.body.location);
      await locationSchema.validateAsync(parsedLocation);

      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  }
};