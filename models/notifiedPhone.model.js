// models/notifiedPhone.model.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const NotifiedPhone = sequelize.define(
  "NotifiedPhone",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    phone_number: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {
    tableName: "notified_phones",
    timestamps: true,
    updatedAt: false, 
  }
);

module.exports = NotifiedPhone;