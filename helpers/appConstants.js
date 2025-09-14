module.exports.responseStatusCodes = {
    success: 200,
    created: 201,
    unAuthorized: 401,
    forbidden: 403,
    badRequest: 400,
    notFound: 404,
    internalServerError: 500
};

module.exports.messages = {

    //server messages
    urlNotFound: "The resource you are looking for could not be found.",
    somethingwentWrong: "Something went wrong, Please try again.",

    //auth
    loginSessionExpired: "Login Session has been expired. Please login again.",
    accountBlocked:  "Your Account has been blocked.",

    //user
    userNotFound: " User not Found.",

    //admin
    adminAdsFetched: "Admin ads fetched successfully.",
    allUsersFetched: "All users fetched successfully.",
    userBlocked: "User blocked successfully.",
    adDeleted: "Ad deleted successfully.",
    adNotFound: "Ad not found",
    adLocationsFetched: "Ad locations fetched successfully."


    


    
};