const express = require('express');
const router = express.Router();
const superAdminController = require("./controller/superadmin.controller");
const validation = require('./validation/superadmin.validation');
const multer = require("multer");
const upload = multer();


router.post(
    '/make_admin',
    validation.makeUserAdminValidation,
    superAdminController.makeUserAdmin
);
router.get(
  "/get-admin-ads",
  validation.getAdminAdsValidation,
  superAdminController.getAdminAds
);
router.delete(
  "/delete-ad",
 validation.deleteAdminAdValidation,
  superAdminController.deleteAdminAd
);
router.get(
  "/get-ad-locations",
  superAdminController.getAllAdLocations
);
router.get(
  "/get-users",
  superAdminController.getAllUsers
); 
router.put(
  "/block_user",
  validation.blockUserByIdValidation,
  superAdminController.blockUserById
);
router.get(
  "/get-sales-users",
  validation.getSalesUsersValidation,
  superAdminController.getSalesUsers
);

router.get(
  "/get-sales-user-by-id",
  validation.getSalesUserByIdValidation,
  superAdminController.getSalesUserById
);

router.get(
  "/get-ad-by-id",
  validation.getAdByIdValidation,
  superAdminController.getAdById
);

router.put(
  "/update-ad",
  upload.array("ad_images"),
  validation.updateAdValidation,
  superAdminController.updateAd
);

module.exports = router;