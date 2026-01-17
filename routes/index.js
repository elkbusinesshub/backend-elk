const routeConfig = require("../config/routeConfig");
const express = require("express");
const router = express.Router();
routeConfig.forEach((route)=>{
  console.log(`/api/${route.version}/${route.route}`)
  router.use(`/api/${route.version}/${route.route}` ,require(`../modules/${route.path}/v1/index`))
});

module.exports = (app) => app.use(router);
