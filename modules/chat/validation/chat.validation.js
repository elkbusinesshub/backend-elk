const { body, query, validationResult } = require('express-validator');
const { responseStatusCodes } = require("../../../helpers/appConstants");

// Middleware to handle validation results
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(responseStatusCodes.badRequest).json({ message: 'Invalid request', errors: errors.array() });
    }
    next();
};

// Validation for /add_chat
const validateAddChat = [
    body('authUserId').exists().withMessage('authUserId is required'),
    body('userId').exists().withMessage('userId is required'),
    body('message').exists().withMessage('message is required'),
    body('type').exists().withMessage('type is required').isIn(['text', 'system', 'image', 'audio', 'video']).withMessage('Invalid type'),
    body('status').exists().withMessage('status is required'),
    validate
];

// Validation for /get_chat
const validateGetChat = [
    query('authUserId').exists().withMessage('authUserId is required'),
    query('otherUserId').exists().withMessage('otherUserId is required'),
    validate
];

// Validation for /chat_rooms
const validateChatRooms = [
    query('authUserId').exists().withMessage('authUserId is required'),
    validate
];

// Validation for /unread_chat_room_count
const validateUnreadCount = [
    query('authUserId').exists().withMessage('authUserId is required'),
    validate
];

// Validation for /block_user and /unblock_user
const validateBlockUnblock = [
    body('authUserId').exists().withMessage('authUserId is required'),
    body('otherUserId').exists().withMessage('otherUserId is required'),
    validate
];

// Validation for /is_blocked
const validateIsBlocked = [
    query('blockerId').exists().withMessage('blockerId is required'),
    query('blockedId').exists().withMessage('blockedId is required'),
    validate
];

module.exports = {
    validateAddChat,
    validateGetChat,
    validateChatRooms,
    validateUnreadCount,
    validateBlockUnblock,
    validateIsBlocked
};
