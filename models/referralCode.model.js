const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./user.model');

const ReferralCode = sequelize.define('ReferralCode', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false,
  },
  user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      unique: true
  },
  referral_code: {
    type: DataTypes.STRING(32),
    allowNull: false,
    unique: true
  },
}, 
{
  modelName: 'ReferralCode',
  tableName: 'referral_code',
  timestamps: true,
});

ReferralCode.belongsTo(User, {as: 'user', foreignKey: 'user_id',targetKey: 'user_id' });
User.hasOne(ReferralCode, {as: 'referral_code', foreignKey: 'user_id',sourceKey: 'user_id' });

module.exports = ReferralCode;
