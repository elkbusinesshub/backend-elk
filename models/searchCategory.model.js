const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const SearchCategory = sequelize.define('SearchCategory', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
    },
    keyword: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    category: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    ad_type: {
        type: DataTypes.STRING,
        allowNull: false,
    },
}, {
    modelName: 'SearchCategory',
    tableName: 'search_categories',
    timestamps: true,
});

module.exports = SearchCategory;
