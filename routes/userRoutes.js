const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const userController = require('../modules/user/controller/user.controller');
const adminController = require('../modules/admin/controller/admin.controller');
const placeController = require('../modules/place/controller/place.controller');
const postController = require('../modules/post/controller/post.controller');
const commonController = require('../modules/common/controller/common.controller');
const chatController = require('../modules/chat/controller/chat.controller');
const authenticateToken = require('../middlewares/authentication');
const {responseStatusCodes} = require("../helpers/appConstants");
const multer = require('multer');
const upload = multer();
const User = require('../models/user.model');
const BlockedUser = require('../models/blockedUser.model');
const { validateGetPlace, validatePlaceSearch, validateGetPlaces } = require('../modules/place/validation/place.validation');
const { validateAddChat, validateGetChat, validateChatRooms, validateUnreadCount, validateBlockUnblock, validateIsBlocked } = require('../modules/chat/validation/chat.validation');
const { validateAddPriceCategories, validateDeletePriceCategories } = require('../modules/common/validation/common.validation');
const adminValidation = require('../modules/admin/validation/admin.validation');
const userValidation = require('../modules/user/validation/user.validation');
const validators = require('../modules/post/validation/post.validation');

//user
router.post('/send_otp', userValidation.validateSendOtp, userController.sendOtp);
router.post('/verify_otp', userValidation.validateVerifyOtp, userController.verifyOtp);
router.post('/create_user', userValidation.validateCreateUser, userController.createUser);
router.post('/get_user', authenticateToken, userValidation.validateGetUserById, userController.getUserById);
router.post('/update_profile_pic', authenticateToken, userValidation.validateUpdateProfilePic, upload.single('file'), userController.updateProfilePic);
router.post('/verify_update_mobile', authenticateToken, userValidation.validateVerifyUpdateMobile, userController.verifyUpdateMobileOtp);
router.post('/update_email_or_mobile', authenticateToken, userValidation.validateUpdateEmailOrMobile, userController.updateEmailOrMobile);
router.post('/update_profile', authenticateToken, userValidation.validateUpdateProfile, userController.updateProfile);
router.post('/update_notification_token', authenticateToken, userValidation.validateUpdateNotificationToken, userController.updateNotificationToken);
router.post('/user_with_ads', authenticateToken, userValidation.validateUserWithAds, userController.userWithAds);
router.post('/remove_wishlist', authenticateToken, userValidation.validateRemoveWishlist, userController.removeWishlist);
router.post('/view_contact', authenticateToken, userValidation.validateViewContact, userController.viewContact);
router.delete('/delete_account', authenticateToken, userValidation.validateDeleteAccount, userController.deleteAccount);
router.get('/user_wishlists', authenticateToken, userController.userWishlists);

//admin
router.get('/get-admin-ads', adminValidation.validateGetAdminAds, adminController.getAdminAds);
router.delete('/delete-ad', adminValidation.validateDeleteAdminAd, adminController.deleteAdminAd);
router.get('/get-ad-locations', adminValidation.validateGetAdLocations, adminController.getAllAdLocations);
router.get('/get-users', adminValidation.validateGetUsers, adminController.getAllUsers);
router.put('/block_user', adminValidation.validateBlockUserById, adminController.blockUserById);

//place
router.post('/get_place', validateGetPlace, placeController.getPlace);
router.post('/place_search', validatePlaceSearch, placeController.placeSearch);
router.post('/get_places', validateGetPlaces, placeController.getPlaces);

//post
router.post('/create_post', authenticateToken, validators.createAdValidator, postController.createAd);
router.post('/upload_ad_image', authenticateToken, upload.array('files'), validators.updateAdImageValidator, postController.updateAdImage);
router.post('/update_ad_address', authenticateToken, validators.updateAdAddressValidator, postController.updateAdAddress);
router.get('/my_ads', authenticateToken, postController.myAds);
router.post('/get_ad_details', validators.getAdDetailsValidator, postController.getAdDetails);
router.post('/delete_ad_image', authenticateToken, validators.deleteAdImageValidator, postController.deletAdImage);
router.post('/delete_ad', authenticateToken, validators.deleteAdValidator, postController.deleteAd);
router.get('/get_recent_unsaved_ad', authenticateToken, postController.getRecentUnsavedPost);
router.post('/change_online_status', authenticateToken, validators.changeOnlineStatusValidator, postController.changeOnlineStatus);
router.post('/recomented_posts', validators.recommentedPostsValidator, postController.recommentedPosts);
router.post('/rent_category_posts', validators.rentCategoryPostsValidator, postController.rentCategoryPosts);
router.post('/categories_search', validators.searchCategoriesValidator, postController.searchCategories);
router.post('/best_service_providers', validators.bestServiceProvidersValidator, postController.bestServiceProviders);
router.post('/search_ad', validators.searchAdsValidator, postController.searchAds);
router.post('/ad_catergories_for', authenticateToken, validators.adCategoriesForValidator, postController.adCategoriesFor);
router.post('/add_to_wishlist', authenticateToken, validators.addToWishlistValidator, postController.addToWishlist);

//chat
router.post('/add_chat', authenticateToken, validateAddChat, chatController.addChat);
router.get('/get_chat', validateGetChat, chatController.getChatMessages);
router.get('/chat_rooms', validateChatRooms, chatController.getChatRooms);
router.get('/unread_chat_room_count', validateUnreadCount, chatController.getTotalChatRoomsCount);
router.post('/block_user', validateBlockUnblock, chatController.blockAUser);
router.post('/unblock_user', validateBlockUnblock, chatController.unblockAUser);
router.get('/is_blocked', validateIsBlocked, chatController.isUserBlocked);

//common
router.get('/price_categories', commonController.priceCategories);
router.post('/add_price_categories', validateAddPriceCategories, commonController.addPriceCategories);
router.delete('/delete_price_categories', validateDeletePriceCategories, commonController.deletePriceCategories);
router.delete('/clear_all', commonController.clearDatabase);





//
router.post('/send_token_notification',()=>{});
router.get('/blocked-users', async (req, res) => {
    try {
      const blockedUsers = await BlockedUser.findAll();
      res.status(responseStatusCodes.success).json(blockedUsers);
    } catch (error) {
      console.error("Error fetching blocked users:", error);
      res.status(responseStatusCodes.internalServerError).json({ message: "An error occurred while fetching blocked users" });
    }
});
router.get('/get-all-users', async (req, res) => {
    try {
      const blockedUsers = await User.findAll();
      res.status(responseStatusCodes.success).json(blockedUsers);
    } catch (error) {
      console.error("Error fetching blocked users:", error);
      res.status(responseStatusCodes.internalServerError).json({ message: "An error occurred while fetching blocked users" });
    }
});
router.get('/check-phone', async (req, res) => {
  try {
      const { mobile_number } = req.query;

      if (!mobile_number) {
          return res.status(responseStatusCodes.badRequest).json({ message: 'Mobile number is required' });
      }

      const user = await User.findOne({ where: { mobile_number } });

      if (user) {
          return res.status(responseStatusCodes.success).json({ exists: true });
      }

      return res.status(responseStatusCodes.success).json({ exists: false});
  } catch (error) {
      console.error('Error checking phone number:', error);
      return res.status(responseStatusCodes.internalServerError).json({ message: 'Internal server error' });
  }
});


module.exports = router;