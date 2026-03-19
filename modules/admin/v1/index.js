const express = require('express');
const router = express.Router();
const adminController = require("./controller/admin.controller");
const validation = require('./validation/admin.validation');
const multer = require("multer");
const upload = multer();

router.post(
  '/admin-ad-create',
  upload.any(),
  validation.createUserAdAdminValidation,
  adminController.createUserAdAdmin
);

router.get(
  '/get_sales_ads',
  adminController.getSalesAds
);

router.get(
  '/get_sales_users',
  adminController.getSalesUsers
);

module.exports = router;