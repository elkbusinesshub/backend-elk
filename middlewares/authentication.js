const jwt = require("jsonwebtoken");
const { responseStatusCodes, messages } = require("../helpers/appConstants");

function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) {
      return res.error(
        messages.loginSessionExpired,
        responseStatusCodes.unAuthorized
      );
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
      if (err) {
        return res.error(
          messages.loginSessionExpired,
          responseStatusCodes.unAuthorized
        );
      }
      req.user = user;
      return next();
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = authenticateToken;
