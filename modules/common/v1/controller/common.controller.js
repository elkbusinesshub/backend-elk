const AdCategory = require("../../../models/adCategory.model");
const AdImage = require("../../../models/adImage.model");
const AdLocation = require("../../../models/adLocation.model");
const Ad = require("../../../models/ad.model");
const AdPriceDetails = require("../../../models/adPriceDetails.model");
const AdViews = require("../../../models/adView.model");
const AdWishLists = require("../../../models/adWishList.model");
const ChatMessage = require("../../../models/chatMessage.model");
const ChatRoom = require("../../../models/chatRoom.model");
const ContactView = require("../../../models/contactView.model");
const Otp = require("../../../models/otp.model");
const Place = require("../../../models/place.model");
const PriceCategory = require("../../../models/priceCategory.model");
const SearchCategory = require("../../../models/searchCategory.model");
const User = require("../../../models/user.model");
const UserSearch = require("../../../models/userSearch.model");
const {
  responseStatusCodes,
  messages,
} = require("../../../../helpers/appConstants");
const BlockedUser = require("../../../../models/blockedUser.model");

const priceCategories = async (req, res) => {
  try {
    const priceCategories = await PriceCategory.findAll();
    const groupedCategories = priceCategories.reduce((group, item) => {
      const category = item.category;
      group[category] = group[category] || [];
      group[category].push(item);
      return group;
    }, {});
    return res.success(messages.priceCategoriesFetched, groupedCategories);
  } catch (error) {
    console.error(error);
    return next(error);
  }
};
const addPriceCategories = async (req, res) => {
  try {
    const { category, title } = req.body;
    const priceCategories = await PriceCategory.findOne({
      where: { title: title, category: category },
    });
    if (priceCategories) {
      return res.success(messages.priceCategoriesExist);
    }
    await PriceCategory.create({
      title: title,
      category: category,
    });
    return res.success(messages.priceCategoriesAdded);
  } catch (error) {
    console.error(error);
    return next(error);
  }
};
const deletePriceCategories = async (req, res) => {
  try {
    const { category, title } = req.body;
    const priceCategories = await PriceCategory.findOne({
      where: { title: title, category: category },
    });
    if (!priceCategories) {
      return res.success(messages.priceCategoryNotFound);
    }
    await PriceCategory.destroy({
      where: { title: title, category: category },
    });
    return res.success(messages.priceCategoryDeleted);
  } catch (error) {
    console.error(error);
    return next(error);
  }
};

const clearDatabase = async (req, res) => {
  try {
    await AdLocation.drop();
    await AdImage.drop();
    await AdPriceDetails.drop();
    await AdWishLists.drop();
    await AdCategory.drop();
    await AdViews.drop();
    await Ad.drop();
    await ContactView.drop();
    await Otp.drop();
    await Place.drop();
    await SearchCategory.drop();
    await UserSearch.drop();
    await ChatMessage.drop();
    await ChatRoom.drop();
    await ChatMessage.drop();
    await ChatRoom.drop();
    await User.drop();
    // await sequelize.drop();
    return res.success(messages.databaseCleared);
  } catch (error) {
    console.error(error);
    return next(error);
  }
};

const getBlockedUsers = async (req, res) => {
  try {
    const blockedUsers = await BlockedUser.findAll();
    return res.success(messages.blockedUsersFetched, blockedUsers);
  } catch (error) {
    console.error(error);
    return next(error);
  }
};

// const getAllUsers = async (req, res) => {
//   try {
//     const blockedUsers = await User.findAll();
//     res.status(responseStatusCodes.success).json(blockedUsers);
//   } catch (error) {
//     console.error("Error fetching blocked users:", error);
//     return next(error);
//   }
// };

const validatePhoneNumber = async (req, res) => {
  try {
    const { mobile_number } = req.params;
    const user = await User.findOne({ where: { mobile_number } });
    if (user) {
      return res.success(messages.phoneNumberExist,{exist: true});
    }
    return res.success(messages.phoneNumberNotExist, {exist: false});
  } catch (error) {
    console.error("Error checking phone number:", error);
    return next(error);
  }
};

module.exports = {
  validatePhoneNumber,
  getAllUsers,
  getBlockedUsers,
  deletePriceCategories,
  priceCategories,
  addPriceCategories,
  clearDatabase,
};
