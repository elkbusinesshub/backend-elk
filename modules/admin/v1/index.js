const express = require('express');
const router = express.Router();
const adminController = require("./controller/admin.controller");
const validation = require('./validation/admin.validation');



router.get(
  "/get-admin-ads",
  validation.getAdminAdsValidation,
  adminController.getAdminAds
);
router.delete(
  "/delete-ad",
  adminController.deleteAdminAd
);
router.get(
  "/get-ad-locations",
  adminController.getAllAdLocations
);
router.get(
  "/get-users",
  adminController.getAllUsers
);
router.put(
  "/block_user",
  validation.blockUserByIdValidation,
  adminController.blockUserById
);

module.exports = router;