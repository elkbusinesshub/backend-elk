const joi = require("joi");

module.exports = {
  getAdminAdsValidation: async (req, res, next) => {
    try {
      const schema = joi.object({
        date: joi.date().optional().allow(""),
        location: joi.string().optional().allow(""),
        limit: joi.number().required(),
        offset: joi.number().required(),
      });
      await schema.validateAsync(req.query);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  deleteAdminAdValidation: async (req, res, next) => {
    try {
      const schema = joi.object({
        id: joi.string().required(),
      });
      await schema.validateAsync(req.query);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  blockUserByIdValidation: async (req, res, next) => {
    try {
      const schema = joi.object({
        id: joi.number().required(),
      });
      await schema.validateAsync(req.query);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  makeUserAdminValidation: async (req, res, next) => {
    try {
      const schema = joi.object({
        user_id: joi.number().required(),
        role: joi.string().required(),
      });
      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  getSalesUsersValidation: async (req, res, next) => {
    try {
      const schema = joi.object({
        offset: joi.number().optional(),
        limit: joi.number().optional(),
      });
      await schema.validateAsync(req.query);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  getSalesUserByIdValidation: async (req, res, next) => {
    try {
      const schema = joi.object({
        id: joi.number().required(),
      });
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
        title: joi.string().optional(),
        description: joi.string().optional(),
        ad_price_details: joi.any().optional(),
      });
      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  getAdByIdValidation: async (req, res, next) => {
    try {
      const schema = joi.object({
        id: joi.number().required(),
      });
      await schema.validateAsync(req.query);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
};
