const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Ad = require('./ad.model');

const AdWishLists = sequelize.define('AdWishLists', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
    ad_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    user_id: {
        type: DataTypes.BIGINT,
        allowNull: false,       
    },
}, {
    modelName: 'AdWishLists',
    tableName: 'ad_wish_lists',
    timestamps: true,
});

AdWishLists.belongsTo(Ad, {as: 'ad', foreignKey: 'ad_id',targetKey: 'ad_id' });
Ad.hasMany(AdWishLists, {as: 'ad_wishlists', foreignKey: 'ad_id',sourceKey: 'ad_id' });
 
module.exports = AdWishLists;