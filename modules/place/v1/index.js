const express = require("express");
const router = express.Router();
const placeController = require("./controller/place.controller");
const validation = require("./validation/place.validation")


//place
router.post("/get_place", validation.validateGetPlace, placeController.getPlace);
router.post("/place_search", validation.validatePlaceSearch, placeController.placeSearch);
router.post("/get_places", validation.validateGetPlaces, placeController.getPlaces);

module.exports = router;
