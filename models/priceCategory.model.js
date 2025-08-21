const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PriceCategory = sequelize.define('PriceCategory', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    category: {
        type: DataTypes.STRING,
        allowNull: false,
    },
}, {
    modelName: 'PriceCategory',
    tableName: 'price_categories',
    timestamps: true,
    defaultScope: {
        attributes: { exclude: ['id', 'createdAt', 'updatedAt'] },
    }
});

module.exports = PriceCategory;
