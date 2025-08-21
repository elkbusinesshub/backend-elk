const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Ad = require('./ad.model');

const AdViews = sequelize.define('AdViews', {
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
    view_count: {
        type: DataTypes.INTEGER,
        allowNull: false,        
    },
}, {
    modelName: 'AdViews',
    tableName: 'ad_views',
    timestamps: true,
});

AdViews.belongsTo(Ad, {as: 'ad', foreignKey: 'ad_id',targetKey: 'ad_id' });
Ad.hasMany(AdViews, {as: 'ad_views', foreignKey: 'ad_id',sourceKey: 'ad_id' });

module.exports = AdViews;