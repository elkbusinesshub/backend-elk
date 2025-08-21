const express = require('express');
const bodyParser = require('body-parser');
const userRoutes = require('./routes/userRoutes');
const sequelize = require('./config/db');
require('dotenv').config();
const cors = require('cors');
const app = express();
const path = require('path')
const chatController = require('./modules/chat/controller/chat.controller');
const socketIo = require('socket.io');
const http = require('http');
const ChatRoom = require('./models/chatRoom.model');
const ChatMessage = require('./models/chatMessage.model');
const { Op } = require('sequelize');
const server = http.createServer(app);
// const admin = require("firebase-admin");
const {responseStatusCodes} = require("./helpers/appConstants");

const io = socketIo(server, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// const serviceAccount = require("./firebaseServiceAccountKey.json");
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

const port = process.env.PORT || 3000;
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());
app.use('/api', userRoutes);
app.use('/.well-known', express.static(path.join(__dirname, '.well-known')));
app.get('/', (req, res) => {
  res.send('Welcome to the Node.js MySQL API');
}); 

sequelize.sync({ alter: false })
  .then(() => {
    console.log('Database synced successfully!');
    server.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  }) 
  .catch(err => {
    console.error('Error syncing database:', err);
  });

io.on('connection', (socket) => {
  var socketUsers=[];
  console.log('A user connected',socket.id);
  socket.on('register', (authUserId) => {
    console.log(`Register called`);
    if (authUserId) {
      socketUsers.push({ socketId: socket.id, authUserId });
      console.log(`User ${authUserId} connected`);
      console.log('Current connected users:', socketUsers);
    }
  });

  socket.on('sendMessage', async (messageData) => {
    try {
      if (messageData.file) {        
        const fileBuffer = Buffer.from(messageData.file, 'base64');
        const fileMimeType = messageData.fileType;
        await chatController.addChat(
          {
            body: {
              authUserId: messageData.authUserId,
              userId: messageData.userId,
              message: messageData.message,
              type: messageData.type,
              file_name:messageData.file_name,
              ad_id:messageData.ad_id,
              ad_name:messageData.ad_name,
              status: messageData.status
            },
            file: {
              buffer: fileBuffer,
              originalname: 'filename.ext',
              mimetype: fileMimeType,
            },
          },
          { 
            status: (code) => ({ 
              json: async(result) => {
                if(code==responseStatusCodes.success){
                  try {
                    const data = await chatController.fetchChatRooms(messageData.authUserId);
                    socket.emit('chatRooms', data);
                  } catch (error) {
                    console.error('Error fetching chat rooms:', error);
                    socket.emit('chatRooms', []);
                  }
                  io.emit('newMessage', result['data']);
                  io.emit('readMessage', result['data']);
                }
              } 
            }) 
          }
        );
      } else {
        await chatController.addChat(
          {
            body: {
              authUserId: messageData.authUserId,
              userId: messageData.userId,
              message: messageData.message,
              type: messageData.type,
              file_name: '',
              ad_id:messageData.ad_id,
              ad_name:messageData.ad_name,
              status: messageData.status
            }
          },
          {
            status: (code) => ({ 
              json: async (result) => {
                if(code==responseStatusCodes.success){
                  try {
                    const data = await chatController.fetchChatRooms(messageData.authUserId);
                    socket.emit('chatRooms', data);
                  } catch (error) {
                    console.error('Error fetching chat rooms:', error);
                    socket.emit('chatRooms', []);
                  }
                  io.emit('newMessage', result['data']);
                  io.emit('readMessage', result['data']);
                }
              } 
            }) 
          }
        );
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });

  socket.on('updateMessageStatus', async ({ authUserId, otherUserId }) => {
    console.log('updateMessageStatus');
    
    try {
      await chatController.updateMessageStatus(authUserId, otherUserId);
    } catch (error) {
      console.error('Error updating message status:', error);
    }
  });

  socket.on('getChatRooms',async (authUserId)=>{
    try {
      const data = await chatController.fetchChatRooms(authUserId);
      socket.emit('chatRooms', data);
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
      socket.emit('chatRooms', []);
    }
  });
 
  socket.on("requestChatRoomCount", async (authUserId) => {
    const count = await ChatRoom.count({
        where: {
            [Op.or]: [
                { user1: authUserId },
                { user2: authUserId }
            ]
        },
        include: [{
          model: ChatMessage,
          as: 'chat_messages',
          where: { status: 'send',reciever_id: authUserId },
        }],
    });
    socket.emit("chatRoomCount", count);
  });

  socket.on('disconnect', () => {
    socketUsers = socketUsers.filter(user => user.socketId !== socket.id);
    console.log('A user disconnected',socketUsers);
  });
});