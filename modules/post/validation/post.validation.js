const { body, query } = require('express-validator');

// Middleware to handle validation results
const validate = (req, res, next) => {
    const errors = require('express-validator').validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
};

// Validators
exports.createAdValidator = [
    body('title').notEmpty().withMessage('Title is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('ad_type').notEmpty().withMessage('Ad type is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('ad_prices').notEmpty().withMessage('Ad prices are required'),
    validate
];

exports.updateAdImageValidator = [
    query('ad_id').notEmpty().withMessage('Ad ID is required'),
    validate
];

exports.updateAdAddressValidator = [
    body('ad_id').notEmpty().withMessage('Ad ID is required'),
    body('country').notEmpty().withMessage('Country is required'),
    body('latitude').notEmpty().withMessage('Latitude is required'),
    body('longitude').notEmpty().withMessage('Longitude is required'),
    validate
];

exports.deleteAdValidator = [
    body('adId').notEmpty().withMessage('Ad ID is required'),
    validate
];

exports.deleteAdImageValidator = [
    body('id').notEmpty().withMessage('Image ID is required'),
    validate
];

exports.getAdDetailsValidator = [
    body('ad_id').notEmpty().withMessage('Ad ID is required'),
    validate
];

exports.searchCategoriesValidator = [
    body('keyword').notEmpty().withMessage('Keyword is required'),
    body('ad_type').notEmpty().withMessage('Ad type is required'),
    validate
];

exports.recommentedPostsValidator = [
    body('page').notEmpty().withMessage('Page number is required'),
    validate
];

exports.searchAdsValidator = [
    body('keyword').notEmpty().withMessage('Keyword is required'),
    validate
];

exports.rentCategoryPostsValidator = [
    body('ad_type').notEmpty().withMessage('Ad type is required'),
    validate
];

exports.bestServiceProvidersValidator = [
    body('page').optional().isInt({ min: 1 }).withMessage('Page must be a number'),
    validate
];

exports.adCategoriesForValidator = [validate]; // no required fields

exports.addToWishlistValidator = [
    body('ad_id').notEmpty().withMessage('Ad ID is required'),
    validate
];

exports.changeOnlineStatusValidator = [
    body('ad_id').notEmpty().withMessage('Ad ID is required'),
    validate
];
