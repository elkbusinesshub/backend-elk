const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AdCategory = sequelize.define('AdCategory', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
    },
    image: {
        type: DataTypes.STRING,
        allowNull: true,
    },
}, {
    modelName: 'AdCategory',
    tableName: 'ad_categories',
    timestamps: true,
});

module.exports = AdCategory;
