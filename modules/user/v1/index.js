const express = require("express");
const router = express.Router();
const userController = require("./controller/user.controller");
const validation = require("./validation/user.validation");
const authentication = require("./../../../middlewares/authentication");
const multer = require("multer");
const upload = multer();
//user
router.post("/send_otp", validation.validateSendOtp, userController.sendOtp); //
router.post(
  "/verify_otp",
  validation.validateVerifyOtp,
  userController.verifyOtp
); //
router.post(
  "/create_user",
  validation.validateCreateUser,
  userController.createUser
); //
router.post(
  "/get_user",
 authentication,
  validation.validateGetUserById,
  userController.getUserById
); //
router.post(
  "/update_profile_pic",
  authentication,
  validation.validateUpdateProfilePic,
  upload.single("file"),
  userController.updateProfilePic
); //
router.post(
  "/verify_update_mobile",
  authentication,
  validation.validateVerifyUpdateMobile,
  userController.verifyUpdateMobileOtp
); //
router.post(
  "/update_email_or_mobile",
  authentication,
  validation.validateUpdateEmailOrMobile,
  userController.updateEmailOrMobile
);//
router.post(
  "/update_profile",
  authentication,
  validation.validateUpdateProfile,
  userController.updateProfile
); //
router.post(
  "/update_notification_token",
  authentication,
  validation.validateUpdateNotificationToken,
  userController.updateNotificationToken
);//
router.post(
  "/user_with_ads",
  authentication,
  validation.validateUserWithAds,
  userController.userWithAds
);
router.post(
  "/remove_wishlist",
  authentication,
  validation.validateRemoveWishlist,
  userController.removeWishlist
);
router.post(
  "/view_contact",
  authentication,
  validation.validateViewContact,
  userController.viewContact
);
router.delete(
  "/delete_account",
  authentication,
  validation.validateDeleteAccount,
  userController.deleteAccount
);
router.get("/user_wishlists", authentication, userController.userWishlists);

module.exports = router;
