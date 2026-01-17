const express = require('express');
const router = express.Router();
const commonController = require('./controller/common.controller')
const validation = require('./validation/common.validation');

router.get("/price_categories", commonController.priceCategories);
router.post(
    "/add_price_categories",
    validation.validateAddPriceCategories,
    commonController.addPriceCategories
);
router.delete("/clear_all", commonController.clearDatabase);
router.delete(
    "/delete_price_categories",
    validation.validateDeletePriceCategories,
    commonController.deletePriceCategories
);
router.get("/blocked-users", commonController.getBlockedUsers);
router.get("/get-all-users", commonController.getAllUsers);
router.get("/check-phone", commonController.checkPhone);

module.exports = router;