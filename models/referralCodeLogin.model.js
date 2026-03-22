const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./user.model');

const ReferralCodeLogin = sequelize.define('ReferralCodeLogin', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false,
  },
  refered_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
  },
  login_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    unique: true
  },
}, 
{
  modelName: 'ReferralCodeLogin',
  tableName: 'referral_code_login',
  timestamps: true,
});

ReferralCodeLogin.belongsTo(User, {
    as: 'referrer',
    foreignKey: 'refered_id',
    targetKey: 'user_id'
});
  
ReferralCodeLogin.belongsTo(User, {
    as: 'login_user',
    foreignKey: 'login_id',
    targetKey: 'user_id'
});

User.hasMany(ReferralCodeLogin, {
    as: 'referrals_made',
    foreignKey: 'refered_id',
    sourceKey: 'user_id'
});

User.hasOne(ReferralCodeLogin, {
    as: 'referral_used',
    foreignKey: 'login_id',
    sourceKey: 'user_id'
});
  
module.exports = ReferralCodeLogin;
