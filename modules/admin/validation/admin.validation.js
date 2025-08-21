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

// Validation for /get-admin-ads
const validateGetAdminAds = [
    query('date').optional().isISO8601().withMessage('Date must be in YYYY-MM-DD format'),
    query('location').optional().isString().withMessage('Location must be a string'),
    validate
];

// Validation for /delete-ad
const validateDeleteAdminAd = [
    query('id').exists().withMessage('Ad ID is required').isInt().withMessage('Ad ID must be a number'),
    validate
];

// Validation for /get-ad-locations
const validateGetAdLocations = [
    // No required query params for this endpoint
    validate
];

// Validation for /get-users
const validateGetUsers = [
    // No required query params for this endpoint
    validate
];

// Validation for /block_user
const validateBlockUserById = [
    body('id').exists().withMessage('User ID is required').isInt().withMessage('User ID must be a number'),
    validate
];

module.exports = {
    validateGetAdminAds,
    validateDeleteAdminAd,
    validateGetAdLocations,
    validateGetUsers,
    validateBlockUserById
};
