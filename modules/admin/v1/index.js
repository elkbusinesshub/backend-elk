const express = require("express");
const router = express.Router();
const adminController = require("./controller/admin.controller");
const validation = require("./validation/admin.validation");
const multer = require("multer");
const upload = multer();
const authenticateToken = require("../../../helpers/authentication");

router.post(
  "/admin-ad-create",
  authenticateToken,
  upload.any(),
  validation.createUserAdAdminValidation,
  adminController.createUserAdAdmin,
);

router.get("/get_sales_ads", authenticateToken, validation.getSalesAdsValidator,adminController.getSalesAds);

router.get("/get_sales_users",authenticateToken,validation.getSalesUsersValidator, adminController.getSalesUsers);

module.exports = router;
