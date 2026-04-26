const joi = require("joi");

module.exports = {
  getAdminAdsValidation: async (req, res, next) => {
    try {
      const schema = joi
        .object({
          date: joi.date().optional().allow(""),
          location: joi.string().optional().allow(""),
          limit: joi.number().required(),
          offset: joi.number().required(),
        })
        .unknown(true);
      await schema.validateAsync(req.query);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  deleteAdminAdValidation: async (req, res, next) => {
    try {
      const schema = joi
        .object({
          id: joi.string().required(),
        })
        .unknown(true);
      await schema.validateAsync(req.query);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  blockUserByIdValidation: async (req, res, next) => {
    try {
      const schema = joi
        .object({
          id: joi.number().required(),
        })
        .unknown(true);
      await schema.validateAsync(req.query);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  makeUserAdminValidation: async (req, res, next) => {
    try {
      const schema = joi
        .object({
          user_id: joi.number().required(),
          role: joi.string().required(),
        })
        .unknown(true);
      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  getSalesUsersValidation: async (req, res, next) => {
    try {
      const schema = joi
        .object({
          offset: joi.number().optional(),
          limit: joi.number().optional(),
        })
        .unknown(true);
      await schema.validateAsync(req.query);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  getSalesUserByIdValidation: async (req, res, next) => {
    try {
      const schema = joi
        .object({
          id: joi.number().required(),
        })
        .unknown(true);
      await schema.validateAsync(req.query);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  updateAdValidation: async (req, res, next) => {
    try {
      const schema = joi.object({
        id: joi.number().required(),
        category: joi.string().required(),
        title: joi.string().optional(),
        description: joi.string().optional(),
        ad_price_details: joi.any().optional(),
        deleted_image_ids: joi
          .alternatives()
          .try(
            joi.string().optional(),
            joi.array().items(joi.number()).optional(),
          )
          .optional(),
      });
      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  getAdByIdValidation: async (req, res, next) => {
    try {
      const schema = joi
        .object({
          id: joi.number().required(),
        })
        .unknown(true);
      await schema.validateAsync(req.query);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  getCheckPhoneValidation: async (req, res, next) => {
    try {
      const schema = joi.object({
        phone_number: joi
          .string()
          .pattern(/^[0-9]{10}$/)
          .required()
          .messages({
            "string.pattern.base": "Phone number must be exactly 10 digits",
            "any.required": "phone_number is required",
          }),
      });
      await schema.validateAsync(req.query);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },

  addPhoneValidation: async (req, res, next) => {
    try {
      const schema = joi.object({
        phone_number: joi
          .string()
          .pattern(/^[0-9]{10}$/)
          .required()
          .messages({
            "string.pattern.base": "Phone number must be exactly 10 digits",
            "any.required": "phone_number is required",
          }),
      });
      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
};
