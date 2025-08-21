const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Ad = require('./ad.model');

const AdLocation = sequelize.define('AdLocation', {
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
  locality: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  place: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  district: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  state: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  country: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  longitude: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  latitude: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
}, 
{
  modelName: 'AdLocation',
  tableName: 'ad_locations',
  timestamps: true,
});

AdLocation.belongsTo(Ad, {as: 'ad', foreignKey: 'ad_id',targetKey: 'ad_id' });
Ad.hasOne(AdLocation, {as: 'ad_location', foreignKey: 'ad_id',sourceKey: 'ad_id' });

module.exports = AdLocation;
