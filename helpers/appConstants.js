const { increment } = require("../models/user.model");

module.exports.responseStatusCodes = {
  success: 200,
  created: 201,
  unAuthorized: 401,
  forbidden: 403,
  badRequest: 400,
  notFound: 404,
  internalServerError: 500,
};

module.exports.responseMessages = {
  //server messages
  urlNotFound: "The resource you are looking for could not be found.",
  internalServerError: "Something went wrong, Please try again.",
  invalidRequest: "Invalid Request",

  //auth
  loginSessionExpired: "Login Session has been expired. Please login again.",
  accountBlocked: "Your Account has been blocked.",

  //user
  userNotFound: " User not Found.",

  //admin
  adminAdsFetched: "Admin ads fetched successfully.",
  salesUsersFetched: "All sales created users fetched successfully.",
  userBlocked: "User blocked successfully.",
  adDeleted: "Ad deleted successfully.",
  adNotFound: "Ad not found",
  adLocationsFetched: "Ad locations fetched successfully.",
  adminusercreated:"User and Ad created successfully",
  adminusercreatedalready:"User account already created",
  cannotReferYourself: "You Cannot refer yourself",

  //common
  priceCategoriesFetched: "Price Categories fetched successfully",
  priceCategoriesExist: "Price Category already exist",
  priceCategoriesAdded: "Price Category added successfully.",
  priceCategoryNotFound: "Price Category not found.",
  priceCategoryDeleted: "Price Category deleted successfully.",
  databaseCleared: "Database cleared successfully.",
  blockedUsersFetched: "Blocked users fetched successfully.",
  phoneNumberExist: "Phone number already exist.",
  phoneNumberNotExist: "Phone number does not exist",

  //users
  otpSend: "Otp send successfully",
  otpNotFound: "OTP not found",
  otpExpired: "OTP exppired",
  InvalidOtp: 'Invalid OTP',
  otpLimit: 'Otp limit reached, please try again later',
  userLogged: "User logged successfully",
  userRegistered: "User registrated successfully",
  userNotFound: "User not found",
  userDetails: "User details fetched successfully",
  profileUpdateFailed: "Profile update failed.",
  profileUpdateSuccessfully: "Profile updated successfully.",
  mobileUpdated: " Phone number updated successfully",  
  emailUpdated: "Email updated successfully",
  userDeleted: "Account deleted successfully",
  tokenUpdated: "Token updated successfully",
  userWishlistFetched: "User wishlist fetched successfully",
  wishlistRemoved: "Wishlist removed successfully",
  wishlistAlreadyRemoved: "Wishlist already removed successfully",
  referralError :"You cannot refer yourself",
  invalidReferralCode: "Invalid referral code",
  referralSuccessAlready: "Referral already applied",
  referralSuccess: "Referral applied successfully",
  adDetails: "Ad deails fetched successfully",

  //place
  loactionDataFetched : "Location data fetched successfully.",
  locationNotFound: "Location not available" ,
  placeFound: "Place found successfully",
  placeNotFound: "No place found",

  //ad
  adCreated: "Ad created successfully.",
  adNotFound: "Ad not found",
  adUpdated: "Ad updated successfully",
  imageUploadFailed: "File upload failed",
  imageUploadSuccess : " Image is uploaded successfully",
  imageNotFound: "Ad Image not found",
  imageDeleted: "Ad image deleted successfully",
  adLocation: "Ad Location updated successfully",
  adDeleted: "Ad deleted successfully",
  adDetailFetched: "Ad details fetched Successfully",
  myadsFetched: "My ads fetched successfully",
  noUnsavedPost: "Recently there is no unsaved post",
  unsavedAds: "Unsaved ad has been fetched successfully",
  searchCategories: "Search categories has been fetched successfully",
  recommentedPosts: "Recomended post has been fetched successfylly",
  allAds: "All ads has been fetched successfully",
  searchAds: "Search ads has been fetched successfully",
  rentCategoryPosts: "Rent category post has been fetched successfully",
  bestServiceProviders: "Best service providers has been fetched successfully",
  adCategories: "Ad categories has been fetched successfully",
  wishlistRemoved: "Ad has been removed from Wishlist successfully",
  wishlistAdded: "Ad has been added to wishlist successfully",
  adStatusChange: "Ad status has been updated successfully",
  locationSuccess: 'Location updated successfully',
  invalidCoordinates: 'Invalid coordinates',

  //chat
  fileUploadFailed: "File Uplaod Failed",
  chatAdded: "Chat message added successfully",
  blockUser: "Blocked user successfully",
  noBlockRecord: "No block record found",
  userUnblocked:  "User unblocked successfully",
  userBlocked : "User is blocked successfully",
  userNotBlocked: "User is not blocked",
  chatRoomNotFound: " Chat room not found",
  chatRoomFound: "Chat messages retrieved successfully",
  chatNotFound : "Chat message not found", 
  usersChatDeleted: "Chat message deleted for user successfully",
  deletedUserChat: "All chat messages deleted for user successfully",
  chatRoomAlreadyDeleted: "chat Room already deleted",
  chatRoomDeleted: "Chat room deleted successfully",
  chatAlreadyDeleted : "Chat message already deleted",
  chatDeleted : "Chat message deleted successfully",
  userReported: "User report successfully",
  messageUpdated: "Message Updated successfully",

  //superadmin
  allUsersFetched: "All user fetched successfully"
  


















};