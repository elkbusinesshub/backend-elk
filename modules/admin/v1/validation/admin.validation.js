const joi = require("joi");

module.exports = {
  getSalesAdsValidation: async (req, res, next) => {
    try {
      const schema = joi.object({});
      await schema.validateAsync(req.query);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },

  getSalesUsersValidation: async (req, res, next) => {
    try {
      const schema = joi.object({});
      await schema.validateAsync(req.query);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },

  createUserAdAdminValidation: async (req, res, next) => {
    try {
      const schema = joi.object({
        name: joi.string().optional(),
        phone: joi.string().required(),
        ads: joi.string().required(),
        location: joi.string().required()
      });
      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  }
};