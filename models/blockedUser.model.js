const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class BlockedUser extends Model {}

BlockedUser.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false,
  },
  blocker_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  blocked_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
}, {
  sequelize,
  modelName: 'BlockedUser',
  tableName: 'blocked_users',
  timestamps: true,
});

module.exports = BlockedUser;