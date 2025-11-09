// const express = require("express");
// const router = express.Router();
// const { body } = require("express-validator");
// const userController = require("../modules/user/controller/user.controller");
// const adminController = require("../modules/admin/v1/controller/admin.controller");
// const placeController = require("../modules/place/controller/place.controller");
// const postController = require("../modules/post/controller/post.controller");
// const commonController = require("../modules/common/controller/common.controller");
// const chatController = require("../modules/chat/controller/chat.controller");
// const authenticateToken = require("../middlewares/authentication");
// const { responseStatusCodes } = require("../helpers/appConstants");
// const multer = require("multer");
// const upload = multer();
// const User = require("../models/user.model");
// const BlockedUser = require("../models/blockedUser.model");
// const {
//   validateGetPlace,
//   validatePlaceSearch,
//   validateGetPlaces,
// } = require("../modules/place/validation/place.validation");
// const {
//   validateAddChat,
//   validateGetChat,
//   validateChatRooms,
//   validateUnreadCount,
//   validateBlockUnblock,
//   validateIsBlocked,
// } = require("../modules/chat/validation/chat.validation");
// const {
//   validateAddPriceCategories,
//   validateDeletePriceCategories,
// } = require("../modules/common/validation/common.validation");
// const adminValidation = require("../modules/admin/validation/admin.validation");
// const userValidation = require("../modules/user/validation/user.validation");
// const validators = require("../modules/post/validation/post.validation");





// //common
// router.get("/price_categories", commonController.priceCategories);
// router.post(
//   "/add_price_categories",
//   validateAddPriceCategories,
//   commonController.addPriceCategories
// );
// router.delete(
//   "/delete_price_categories",
//   validateDeletePriceCategories,
//   commonController.deletePriceCategories
// );
// router.delete("/clear_all", commonController.clearDatabase);


// router.get("/blocked-users", async (req, res) => {
//   try {
//     const blockedUsers = await BlockedUser.findAll();
//     res.status(responseStatusCodes.success).json(blockedUsers);
//   } catch (error) {
//     console.error("Error fetching blocked users:", error);
//     res
//       .status(responseStatusCodes.internalServerError)
//       .json({ message: "An error occurred while fetching blocked users" });
//   }
// });
// router.get("/get-all-users", async (req, res) => {
//   try {
//     const blockedUsers = await User.findAll();
//     res.status(responseStatusCodes.success).json(blockedUsers);
//   } catch (error) {
//     console.error("Error fetching blocked users:", error);
//     res
//       .status(responseStatusCodes.internalServerError)
//       .json({ message: "An error occurred while fetching blocked users" });
//   }
// });
// router.get("/check-phone", async (req, res) => {
//   try {
//     const { mobile_number } = req.query;

//     if (!mobile_number) {
//       return res
//         .status(responseStatusCodes.badRequest)
//         .json({ message: "Mobile number is required" });
//     }

//     const user = await User.findOne({ where: { mobile_number } });

//     if (user) {
//       return res.status(responseStatusCodes.success).json({ exists: true });
//     }

//     return res.status(responseStatusCodes.success).json({ exists: false });
//   } catch (error) {
//     console.error("Error checking phone number:", error);
//     return res
//       .status(responseStatusCodes.internalServerError)
//       .json({ message: "Internal server error" });
//   }
// });

// module.exports = router;

const routeConfig = require("../config/routeConfig");
const express = require("express");
const router = express.Router();
routeConfig.forEach((route)=>{
  console.log(`/api/${route.version}/${route.route}`)
  router.use(`/api/${route.version}/${route.route}` ,require(`../modules/${route.path}/v1/index`))
  

});

module.exports = (app) => app.use(router);
