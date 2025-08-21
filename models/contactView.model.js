const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ContactView = sequelize.define('ContactView', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
    },
    user_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    viewer_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
}, {
    modelName: 'ContactView',
    tableName: 'contact_views',
    timestamps: true,
});

module.exports = ContactView;