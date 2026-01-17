const AdCategory = require("../../../../models/adCategory.model")
const AdImage = require("../../../../models/adImage.model");
const AdLocation = require("../../../../models/adLocation.model");
const Ad = require("../../../../models/ad.model");
const AdPriceDetails = require("../../../../models/adPriceDetails.model");
const AdViews = require("../../../../models/adView.model");
const AdWishLists = require("../../../../models/adWishList.model");
const ChatMessage = require("../../../../models/chatMessage.model");
const ChatRoom = require("../../../../models/chatRoom.model");
const ContactView = require("../../../../models/contactView.model");
const Otp = require("../../../../models/otp.model");
const Place = require("../../../../models/place.model");
const PriceCategory = require("../../../../models/priceCategory.model");
const SearchCategory = require("../../../../models/searchCategory.model");
const User = require("../../../../models/user.model");
const UserSearch = require("../../../../models/userSearch.model");
const BlockedUser = require("../../../../models/blockedUser.model");

const {
  responseStatusCodes,
  responseMessages,
} = require("../../../../helpers/appConstants");

exports.priceCategories = async (req, res) => {
  try {
    const priceCategories = await PriceCategory.findAll();
    const groupedCategories = priceCategories.reduce((group, item) => {
        const category = item.category;
        group[category] = group[category] || [];
        group[category].push(item);
        return group;
    }, {});
    //  res.status(responseStatusCodes.success).json(groupedCategories);
    return res.success(responseMessages.priceCategoriesFetched, groupedCategories);
  } catch (error) {
    return next(error);
    // res.status(responseStatusCodes.internalServerError).json({ message: responseMessages.internalServerError });
  }
};
exports.addPriceCategories = async (req, res) => {
  try {
    const {category, title} = req.body;
    const priceCategories = await PriceCategory.findOne({where:{title:title,category:category}});
    if(priceCategories){
      // return res.status(responseStatusCodes.success).json({ message: responseMessages.priceCategoriesExist });
      return res.success(responseMessages.priceCategoriesExist);
    }
    await PriceCategory.create({
      title:title,
      category:category
    })
    // return res.status(responseStatusCodes.success).json({ message: responseMessages.priceCategoriesAdded });
    return res.success(responseMessages.priceCategoriesAdded);
  } catch (error) {
    return next(error);
    // return res.status(responseStatusCodes.internalServerError).json({ message: responseMessages.internalServerError });
  }
};
exports.deletePriceCategories = async (req,res)=>{
  try{
    const {category, title}=req.body;
    const priceCategories = await PriceCategory.findOne({where:{title:title,category:category}});
    if(!priceCategories){
      // return res.status(responseStatusCodes.success).json({ message: responseMessages.priceCategoryNotFound });
      return res.success(responseMessages.priceCategoryNotFound);
    }
    await PriceCategory.destroy({where:{title:title,category:category}});
    return res.success(responseMessages.priceCategoryDeleted);
    // return res.status(responseStatusCodes.success).json({ message: responseMessages.priceCategoryDeleted });
  }catch(error){
    return next(error);
    // return res.status(responseStatusCodes.internalServerError).json({ message: responseMessages.internalServerError });
  }
}

exports.clearDatabase = async (req, res)=>{
  try{
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
    // return res.status(responseStatusCodes.success).json({ message: responseMessages.databaseCleared });
    return res.success(responseMessages.databaseCleared);
  }catch(e){
    // return res.status(responseStatusCodes.internalServerError).json({ message: responseMessages.internalServerError });
    return next(e)
  }
}
exports.getBlockedUsers = async (req, res, next) => {
  try {
    const blockedUsers = await BlockedUser.findAll();
    return res.success("Blocked users fetched successfully", blockedUsers);
  } catch (error) {
    return next(error);
  }
};

exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.findAll();
    return res.success("Users fetched successfully", users);
  } catch (error) {
    return next(error);
  }
};

exports.checkPhone = async (req, res, next) => {
  try {
    const { mobile_number } = req.query;

    if (!mobile_number) {
      return res
        .status(responseStatusCodes.badRequest)
        .json({ message: "Mobile number is required" });
    }

    const user = await User.findOne({ where: { mobile_number } });

    return res.success("Phone check completed", {
      exists: !!user,
    });
  } catch (error) {
    return next(error);
  }
};
