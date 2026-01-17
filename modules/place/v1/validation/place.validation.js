const joi = require("joi");

module.exports = {
  validateGetPlace: async (req, res, next) => {
    try {
      const schema = joi.object({
        longitude: joi.number().required(),
        latitude: joi.number().required(),
      });

      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  validatePlaceSearch: async (req, res, next) => {
    try {
      const schema = joi.object({
        query: joi.string().required(),
        limited: joi.boolean().optional()
      });

      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  validateGetPlaces: async (req, res, next) => {
    try {
      const schema = joi.object({
        type: joi.string()
          .valid("state", "city", "locality")
          .required(),

        state: joi.string().when("type", {
          is: joi.valid("city", "locality"),
          then: joi.required().messages({
            "any.required": "State is required for city/locality type",
          }),
          otherwise: joi.optional(),
        }),

        city: joi.string().when("type", {
          is: "locality",
          then: joi.required().messages({
            "any.required": "City is required for locality type",
          }),
          otherwise: joi.optional(),
        }),
      });

      await schema.validateAsync(req.query);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
};
