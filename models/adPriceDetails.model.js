const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Ad = require('./ad.model');

const AdPriceDetails = sequelize.define('AdPriceDetails', {
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
    rent_price: {
        type: DataTypes.STRING,
        allowNull: false,       
    },
    rent_duration: {
        type: DataTypes.STRING,
        allowNull: false,        
    },
}, {
    modelName: 'AdPriceDetails',
    tableName: 'ad_price_details',
    timestamps: true,
});

AdPriceDetails.belongsTo(Ad, {as:'ad', foreignKey: 'ad_id',targetKey: 'ad_id' });
Ad.hasMany(AdPriceDetails, {as:'ad_price_details', foreignKey: 'ad_id',sourceKey: 'ad_id' });

module.exports = AdPriceDetails;