const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class ReportUser extends Model {}

ReportUser.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false,
  },
  reporter_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  reported_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  }, 
  reason: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  sequelize,
  modelName: 'ReportUser',
  tableName: 'report_users',
  timestamps: true,
});

module.exports = ReportUser;