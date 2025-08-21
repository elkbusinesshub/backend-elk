const { Model, DataTypes, literal } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./user.model');

class Ad extends Model {
    
}

Ad.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true,
    },
    ad_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        unique: true
    },
    user_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    category: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description:{
        type: DataTypes.STRING,
        allowNull: false
    }, 
    ad_type: {
        type: DataTypes.STRING,
        allowNull: false
    },
    ad_status: {
        type: DataTypes.STRING,
        allowNull: false
    },
    ad_stage: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    sequelize,
    modelName: 'Ad',
    tableName: 'ads',
    timestamps: true
});

Ad.belongsTo(User, {as: 'user', foreignKey: 'user_id', targetKey: 'user_id'});
User.hasMany(Ad, {as: 'ads', foreignKey: 'user_id',sourceKey: 'user_id' });

module.exports = Ad;
