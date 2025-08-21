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

// Validation for /send_otp
const validateSendOtp = [
    body('mobile').exists().withMessage('Mobile number is required').isMobilePhone().withMessage('Invalid mobile number'),
    validate
];

// Validation for /verify_otp
const validateVerifyOtp = [
    body('verificationId').exists().withMessage('Verification ID is required'),
    body('otp').exists().withMessage('OTP is required').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    body('name').optional().isString(),
    validate
];

// Validation for /create_user
const validateCreateUser = [
    body('name').exists().withMessage('Name is required'),
    body('uuid').exists().withMessage('UUID is required'),
    body('mobile').optional().isMobilePhone().withMessage('Invalid mobile number'),
    body('email').optional().isEmail().withMessage('Invalid email'),
    validate
];

// Validation for /get_user
const validateGetUserById = [
    query('id').exists().withMessage('User ID is required'),
    validate
];

// Validation for /update_profile_pic
const validateUpdateProfilePic = [
    query('id').exists().withMessage('User ID is required'),
    validate
];

// Validation for /verify_update_mobile
const validateVerifyUpdateMobile = [
    body('verificationId').exists().withMessage('Verification ID is required'),
    body('otp').exists().withMessage('OTP is required').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    validate
];

// Validation for /update_email_or_mobile
const validateUpdateEmailOrMobile = [
    body('user_id').exists().withMessage('User ID is required'),
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('mobile').optional().isMobilePhone().withMessage('Invalid mobile number'),
    body('uid').optional(),
    validate
];

// Validation for /update_profile
const validateUpdateProfile = [
    body('user_id').exists().withMessage('User ID is required'),
    body('name').exists().withMessage('Name is required').isLength({ min: 3 }).withMessage('Name must be at least 3 characters long'),
    body('description').exists().withMessage('Description is required').isLength({ min: 3 }).withMessage('Description must be at least 3 characters long'),
    validate
];

// Validation for /update_notification_token
const validateUpdateNotificationToken = [
    body('notification_token').exists().withMessage('Notification token is required'),
    validate
];

// Validation for /user_with_ads
const validateUserWithAds = [
    body('user_id').exists().withMessage('User ID is required'),
    validate
];

// Validation for /remove_wishlist
const validateRemoveWishlist = [
    body('ad_id').exists().withMessage('Ad ID is required').isInt().withMessage('Ad ID must be a number'),
    validate
];

// Validation for /view_contact
const validateViewContact = [
    body('userId').exists().withMessage('User ID is required'),
    validate
];

// Validation for /delete_account
const validateDeleteAccount = [
    query('user_id').exists().withMessage('User ID is required'),
    validate
];

module.exports = {
    validateSendOtp,
    validateVerifyOtp,
    validateCreateUser,
    validateGetUserById,
    validateUpdateProfilePic,
    validateVerifyUpdateMobile,
    validateUpdateEmailOrMobile,
    validateUpdateProfile,
    validateUpdateNotificationToken,
    validateUserWithAds,
    validateRemoveWishlist,
    validateViewContact,
    validateDeleteAccount
};
