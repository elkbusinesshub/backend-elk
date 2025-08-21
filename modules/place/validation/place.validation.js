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

// Validation for /get_place
const validateGetPlace = [
    body('longitude').exists().withMessage('Longitude is required').isFloat().withMessage('Longitude must be a number'),
    body('latitude').exists().withMessage('Latitude is required').isFloat().withMessage('Latitude must be a number'),
    validate
];

// Validation for /place_search
const validatePlaceSearch = [
    body('query').exists().withMessage('Query is required').isString().withMessage('Query must be a string'),
    body('limited').exists().withMessage('Limited flag is required').isBoolean().withMessage('Limited must be a boolean'),
    validate
];

// Validation for /get_places
const validateGetPlaces = [
    query('type')
        .exists().withMessage('Type is required')
        .isIn(['state', 'city', 'locality']).withMessage('Invalid type'),

    query('state')
        .custom((value, { req }) => {
            if ((req.query.type === 'city' || req.query.type === 'locality') && !value) {
                throw new Error('State is required for city/locality type');
            }
            return true;
        }),

    query('city')
        .custom((value, { req }) => {
            if (req.query.type === 'locality' && !value) {
                throw new Error('City is required for locality type');
            }
            return true;
        }),
    validate
];


module.exports = {
    validateGetPlace,
    validatePlaceSearch,
    validateGetPlaces
};
