const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Ad = require('./ad.model');

class AdImage extends Model {}

AdImage.init({
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
    image: {
        type: DataTypes.STRING,
        allowNull: false,
    },
}, {
    sequelize,
    modelName: 'AdImage',
    tableName: 'ad_images',
    timestamps: true,
});

AdImage.belongsTo(Ad, {as: 'ad', foreignKey: 'ad_id',targetKey: 'ad_id' });
Ad.hasMany(AdImage, {as: 'ad_images', foreignKey: 'ad_id',sourceKey: 'ad_id' });

module.exports = AdImage;
