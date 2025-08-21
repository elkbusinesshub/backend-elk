const AdCategory = require('../../../models/adCategory.model');
const AdImage = require('../../../models/adImage.model');
const AdLocation = require('../../../models/adLocation.model');
const Ad = require('../../../models/ad.model');
const AdPriceDetails = require('../../../models/adPriceDetails.model');
const AdViews = require('../../../models/adView.model');
const AdWishLists = require('../../../models/adWishList.model');
const ChatMessage = require('../../../models/chatMessage.model');
const ChatRoom = require('../../../models/chatRoom.model');
const ContactView = require('../../../models/contactView.model');
const Otp = require('../../../models/otp.model');
const Place = require('../../../models/place.model');
const PriceCategory = require('../../../models/priceCategory.model');
const SearchCategory = require('../../../models/searchCategory.model');
const User = require('../../../models/user.model');
const UserSearch = require('../../../models/userSearch.model');

exports.priceCategories = async (req, res) => {
  try {
    const priceCategories = await PriceCategory.findAll();
    const groupedCategories = priceCategories.reduce((group, item) => {
        const category = item.category;
        group[category] = group[category] || [];
        group[category].push(item);
        return group;
    }, {});
    res.status(responseStatusCodes.success).json(groupedCategories);
  } catch (error) {
    res.status(responseStatusCodes.internalServerError).json({ error: 'Something went wrong' });
  }
};
exports.addPriceCategories = async (req, res) => {
  try {
    const {category, title} = req.body;
    const priceCategories = await PriceCategory.findOne({where:{title:title,category:category}});
    if(priceCategories){
      return res.status(responseStatusCodes.success).json({ message: 'Already Exist!' });
    }
    await PriceCategory.create({
      title:title,
      category:category
    })
    return res.status(responseStatusCodes.success).json({ message: 'Success!' });
  } catch (error) {
    return res.status(responseStatusCodes.internalServerError).json({ error: 'Something went wrong' });
  }
};
exports.deletePriceCategories = async (req,res)=>{
  try{
    const {category, title}=req.body;
    const priceCategories = await PriceCategory.findOne({where:{title:title,category:category}});
    if(!priceCategories){
      return res.status(responseStatusCodes.success).json({ message: 'Nothing to delete!' });
    }
    await PriceCategory.destroy({where:{title:title,category:category}});
    return res.status(responseStatusCodes.success).json({ message: 'Successfully Deleted!' });
  }catch(error){
    return res.status(responseStatusCodes.internalServerError).json({ error: 'Something went wrong'+error });
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
    return res.status(responseStatusCodes.success).json({ message: 'Successfully Deleted!' });
  }catch(e){
    return res.status(responseStatusCodes.internalServerError).json({ error: 'Something went wrong'+error });
  }
}