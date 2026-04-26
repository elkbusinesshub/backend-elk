const joi = require("joi");

const validateAddChat = async (req, res, next) => {
  try {
    const schema = joi.object({
      authUserId: joi.string().required().messages({
        "any.required": "authUserId is required",
        "string.empty": "authUserId is required",
      }),

      userId: joi.string().required().messages({
        "any.required": "userId is required",
        "string.empty": "userId is required",
      }),

      message: joi.string().required().messages({
        "any.required": "message is required",
        "string.empty": "message is required",
      }),

      type: joi
        .string()
        .valid("text", "system", "image", "audio", "video")
        .required()
        .messages({
          "any.required": "type is required",
          "any.only": "Invalid type",
        }),

      status: joi.string().required().messages({
        "any.required": "status is required",
        "string.empty": "status is required",
      }),
    }).unknown(true);

    await schema.validateAsync(req.body);
    return next();
  } catch (error) {
    return res.error(error?.message);
  }
};

const validateGetChat = async (req, res, next) => {
  try {
    const schema = joi.object({
      authUserId: joi.string().required().messages({
        "any.required": "authUserId is required",
        "string.empty": "authUserId is required",
      }),
      otherUserId: joi.string().required().messages({
        "any.required": "otherUserId is required",
        "string.empty": "otherUserId is required",
      }),
    });

    await schema.validateAsync(req.query);
    return next();
  } catch (error) {
    return res.error(error?.message);
  }
};

const validateChatRooms = async (req, res, next) => {
  try {
    const schema = joi.object({
      authUserId: joi.string().required().messages({
        "any.required": "authUserId is required",
        "string.empty": "authUserId is required",
      }),
    });
    await schema.validateAsync(req.query);
    return next();
  } catch (error) {
    return res.error(error?.message);
  }
};

const validateUnreadCount = async (req, res, next) => {
  try {
    const schema = joi.object({
      authUserId: joi.string().required().messages({
        "any.required": "authUserId is required",
        "string.empty": "authUserId is required",
      }),
    }).unknown(true);

    await schema.validateAsync(req.query);
    return next();
  } catch (error) {
    return res.error(error?.message);
  }
};

const validateBlockUnblock = async (req, res, next) => {
  try {
    const schema = joi.object({
      authUserId: joi.string().required().messages({
        "any.required": "authUserId is required",
        "string.empty": "authUserId is required",
      }),
      otherUserId: joi.string().required().messages({
        "any.required": "otherUserId is required",
        "string.empty": "otherUserId is required",
      }),
      reason: joi.string().allow(null).optional(),
    });

    await schema.validateAsync(req.body);
    return next();
  } catch (error) {
    return res.error(error?.message);
  }
};

const validateIsBlocked = async (req, res, next) => {
  try {
    const schema = joi.object({
      blockerId: joi.string().required().messages({
        "any.required": "blockerId is required",
        "string.empty": "blockerId is required",
      }),
      blockedId: joi.string().required().messages({
        "any.required": "blockedId is required",
        "string.empty": "blockedId is required",
      }),
    });

    await schema.validateAsync(req.query);
    return next();
  } catch (error) {
    return res.error(error?.message);
  }
};

module.exports = {
  validateAddChat,
  validateGetChat,
  validateChatRooms,
  validateUnreadCount,
  validateBlockUnblock,
  validateIsBlocked,
};
