const express = require("express");
const router = express.Router();
const postController = require("./controller/post.controller");
const validation = require("./validation/post.validation");
const authentication = require("./../../../helpers/authentication");
const multer = require("multer");
const upload = multer();

//post
router.post(
  "/create_post",
  authentication,
  validation.createAdValidator,
  postController.createAd
);
router.post(
  "/update_ad_address",
  authentication,
  validation.updateAdAddressValidator,
  postController.updateAdAddress
);
router.get("/my_ads", authentication, postController.myAds);
router.post(
  "/get_ad_details",
  validation.getAdDetailsValidator,
  postController.getAdDetails
);
router.post(
  "/delete_ad_image",
  authentication,
  validation.deleteAdImageValidator,
  postController.deletAdImage
);
router.post(
  "/delete_ad",
  authentication,
  validation.deleteAdValidator,
  postController.deleteAd
);
router.get(
  "/get_recent_unsaved_ad",
  authentication,
  postController.getRecentUnsavedPost
);
router.post(
  "/change_online_status",
  authentication,
  validation.changeOnlineStatusValidator,
  postController.changeOnlineStatus
);
router.post(
  "/recomented_posts",
  validation.recommentedPostsValidator,
  postController.recommentedPosts
);
router.post(
  "/rent_category_posts",
  validation.rentCategoryPostsValidator,
  postController.rentCategoryPosts
);
router.post(
  "/categories_search",
  validation.searchCategoriesValidator,
  postController.searchCategories
);
router.post(
  "/best_service_providers",
  validation.bestServiceProvidersValidator,
  postController.bestServiceProviders
);
router.post(
  "/ad_catergories_for",
  authentication,
  postController.adCategoriesFor
);
router.post(
  "/add_to_wishlist",
  authentication,
  validation.addToWishlistValidator,
  postController.addToWishlist
);
router.post(
  "/upload_ad_image",
  authentication,
  upload.array("files"),
  validation.updateAdImageValidator,
  postController.updateAdImage
);
router.post(
  "/search_ad",
  validation.searchAdsValidator,
  postController.searchAds
);

module.exports = router;
