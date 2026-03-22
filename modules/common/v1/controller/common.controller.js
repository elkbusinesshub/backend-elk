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

const {
  responseStatusCodes,
  responseMessages,
} = require("../../../../helpers/appConstants");
const ReferralCode = require("../../../../models/referralCode.model");
const ReferralCodeLogin = require("../../../../models/referralCodeLogin.model");

//done
exports.priceCategories = async (req, res, next) => {
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

//done
exports.addPriceCategories = async (req, res, next) => {
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

//done
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

//done
exports.clearDatabase = async (req, res, next) => {
    try {
        // Drop child tables in parallel first
        await Promise.all([
            AdLocation.drop({ cascade: true }),
            AdImage.drop({ cascade: true }),
            AdPriceDetails.drop({ cascade: true }),
            AdWishLists.drop({ cascade: true }),
            AdViews.drop({ cascade: true }),
            ContactView.drop({ cascade: true }),
            Otp.drop({ cascade: true }),
            Place.drop({ cascade: true }),
            SearchCategory.drop({ cascade: true }),
            UserSearch.drop({ cascade: true }),
            ChatMessage.drop({ cascade: true }),
        ]);

        // Drop parent tables after children
        await Promise.all([
            AdCategory.drop({ cascade: true }),
            Ad.drop({ cascade: true }),
            ChatRoom.drop({ cascade: true }),
        ]);

        // Drop root table last
        await User.drop({ cascade: true });

        return res.success(responseMessages.databaseCleared);

    } catch (error) {
        return next(error);
    }
};


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

exports.getReferralCodes = async (req,res,next) => {
  try{
    let codes = await ReferralCode.findAll()
    return res.success('Ok',{codes});
  }catch(e){
    return next(e); 
  }
} 