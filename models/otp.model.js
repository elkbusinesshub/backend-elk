const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Otp extends Model {}

Otp.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false,
  },
  mobile: {
    type: DataTypes.STRING(15),
    allowNull: false,
  },
  verification_id: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  otp: {
    type: DataTypes.STRING(10),
    allowNull: false,
  },
}, {
  sequelize,
  modelName: 'Otp',
  tableName: 'otp',
  timestamps: true,
});

module.exports = Otp;
