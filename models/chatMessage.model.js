const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const ChatRoom = require('./chatRoom.model');

const ChatMessage = sequelize.define('ChatMessage', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
    },
    room_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    sender_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    reciever_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    message: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    type: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    file_name: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    file_url: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    ad_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
    },
    ad_name: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    time: {
        type: DataTypes.DATE,
        allowNull: false,
    }
}, {
    modelName:'ChatMessage',
    tableName:'chat_messages',
    timestamps: true,
});

ChatMessage.belongsTo(ChatRoom, {as:'chat_room', foreignKey: 'room_id',targetKey: 'room_id' });
ChatRoom.hasMany(ChatMessage, {as:'chat_messages', foreignKey: 'room_id',sourceKey: 'room_id' });

module.exports = ChatMessage;