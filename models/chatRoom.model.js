const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./user.model');

class ChatRoom extends Model {}

ChatRoom.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false,
  },
  room_id:{
    type: DataTypes.BIGINT,
    allowNull: false,
    unique: true,
  },
  user1:{
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  user2:{
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  last_message_time:{
    type:DataTypes.DATE,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'ChatRoom',
  tableName: 'chat_rooms',
  timestamps: true,
});

ChatRoom.belongsTo(User, { as: 'User1', foreignKey: 'user1', targetKey: 'user_id' });
ChatRoom.belongsTo(User, { as: 'User2', foreignKey: 'user2', targetKey: 'user_id' });

module.exports = ChatRoom;
