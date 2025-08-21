const { body, validationResult } = require('express-validator');
const { responseStatusCodes } = require("../../../helpers/appConstants");

// Middleware to handle validation results
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(responseStatusCodes.badRequest).json({ message: 'Invalid request', errors: errors.array() });
    }
    next();
};

// Validation for /add_price_categories
const validateAddPriceCategories = [
    body('category').exists().withMessage('category is required').isString(),
    body('title').exists().withMessage('title is required').isString(),
    validate
];

// Validation for /delete_price_categories
const validateDeletePriceCategories = [
    body('category').exists().withMessage('category is required').isString(),
    body('title').exists().withMessage('title is required').isString(),
    validate
];

// No validation needed for /price_categories (GET) and /clear_all (DELETE) endpoints
module.exports = {
    validateAddPriceCategories,
    validateDeletePriceCategories
};
