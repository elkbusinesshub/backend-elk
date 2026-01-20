const joi = require("joi");

module.exports = {
  validateSendOtp: async (req, res, next) => {
    try {
      const schema = joi.object({
        mobile: joi.string().required(),
      });

      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },

  validateVerifyOtp: async (req, res, next) => {
    try {
      const schema = joi.object({
        verificationId: joi.string().required().label("Verification ID"),
        otp: joi.string().length(6).required().label("OTP"),
        name: joi.string().min(2).max(100).optional().label("Name"),
        referralCode: joi.string().optional().allow(null, "").label("Referral Code"),
      });

      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },

  validateCreateUser: async (req, res, next) => {
    try {
      const schema = joi.object({
        email: joi.string().required(),
        uuid: joi.string().required(),
        name: joi.string().min(2).max(100).required().label("Name"),
      });

      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  validateGetUserById: async (req, res, next) => {
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
  validateUpdateProfilePic: async (req, res, next) => {
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
  validateVerifyUpdateMobile: async (req, res, next) => {
    try {
      const schema = joi.object({
        verificationId: joi.string().required(),
        otp: joi.string().required(),
      });

      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  validateUpdateEmailOrMobile: async (req, res, next) => {
    try {
      const schema = joi.object({
        email: joi.string().optional(),
        uuid: joi.string().optional(),
        mobile: joi.string().optional(),
        user_id: joi.string().required(),
      });

      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  validateUpdateProfile: async (req, res, next) => {
    try {
      const schema = joi.object({
        name: joi.string().min(2).max(100).required().label("Name"),
        description: joi.string().min(2).max(100).required(),
        user_id: joi.string().required(),
      });

      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  validateUpdateNotificationToken: async (req, res, next) => {
    try {
      const schema = joi.object({
        notification_token: joi.string().required(),
      });

      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  validateUserWithAds: async (req, res, next) => {
    try {
      const schema = joi.object({
        user_id: joi.number().required(),
      });

      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  validateRemoveWishlist: async (req, res, next) => {
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
  validateViewContact: async (req, res, next) => {
    try {
      const schema = joi.object({
        userId: joi.number().required(),
      });

      await schema.validateAsync(req.body);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
  validateDeleteAccount:  async (req, res, next) => {
    try {
      const schema = joi.object({
        user_id: joi.string().required(),
      });

      await schema.validateAsync(req.query);
      return next();
    } catch (error) {
      return res.error(error?.message);
    }
  },
};
