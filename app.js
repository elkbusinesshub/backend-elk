const express = require("express");
const bodyParser = require("body-parser");
const sequelize = require("./config/db");
require("dotenv").config();
const utils = require("./helpers/utils");
const cors = require("cors");
const app = express();
const path = require("path");
const chatController = require("./modules/chat/v1/controller/chat.controller");
const socketIo = require("socket.io");
const http = require("http");
const ChatRoom = require("./models/chatRoom.model");
const ChatMessage = require("./models/chatMessage.model");
const { Op } = require("sequelize");
const server = http.createServer(app);
// const admin = require("firebase-admin");
const { responseStatusCodes } = require("./helpers/appConstants");

//Global Error Handler
process.on("uncaughtException", utils.unhandledErrorHandler);
process.on("unhandledRejection", utils.unhandledErrorHandler);

const io = socketIo(server, {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

// const serviceAccount = require("./firebaseServiceAccountKey.json");
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

const port = process.env.PORT || 3000;
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// app.use(bodyParser.json());
app.use(express.json({ limit: "100mb" }));
app.use(utils.globalResponseHandler);
app.use("/.well-known", express.static(path.join(__dirname, ".well-known")));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("Welcome to the Node.js MySQL API");
});

// app.use("/api", userRoutes);
require("./routes/index")(app);

app.use(utils.unknownRouteHandler);
app.use(utils.globalErrorHandler);

sequelize
  .sync({ alter: false })
  .then(() => {
    console.log("Database synced successfully!");
    server.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("Error syncing database:", err);
  });

io.on("connection", (socket) => {
  var socketUsers = [];
  socket.on("register", (authUserId) => {
    if (authUserId) {
      socketUsers.push({ socketId: socket.id, authUserId });
    }
  });

  socket.on("sendMessage", async (messageData) => {
    try {
      if (messageData.file) {
        const fileBuffer = Buffer.from(messageData.file, "base64");
        const fileMimeType = messageData.fileType;
        await chatController.addChat(
          {
            body: {
              authUserId: messageData.authUserId,
              userId: messageData.userId,
              message: messageData.message,
              type: messageData.type,
              file_name: messageData.file_name,
              ad_id: messageData.ad_id,
              ad_name: messageData.ad_name,
              status: messageData.status,
            },
            file: {
              buffer: fileBuffer,
              originalname: "filename.ext",
              mimetype: fileMimeType,
            },
          },
          {
            status: (code) => ({
              json: async (result) => {
                if (code == responseStatusCodes.success) {
                  try {
                    const data = await chatController.fetchChatRooms(
                      messageData.authUserId
                    );
                    socket.emit("chatRooms", data);
                  } catch (error) {
                    socket.emit("chatRooms", []);
                  }
                  if (messageData.type === 'system' || messageData.status === 'blocked') {
                    socket.emit('newMessage', result['data']);
                  } else {
                    io.emit('newMessage', result['data']);
                    io.emit('readMessage', result['data']);
                  }
                }
              },
            }),
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
              file_name: "",
              ad_id: messageData.ad_id,
              ad_name: messageData.ad_name,
              status: messageData.status,
            },
          },
          {
            status: (code) => ({
              json: async (result) => {
                if (code == responseStatusCodes.success) {
                  try {
                    const data = await chatController.fetchChatRooms(
                      messageData.authUserId
                    );
                    socket.emit("chatRooms", data);
                  } catch (error) {
                    socket.emit("chatRooms", []);
                  }
                  if (messageData.type === 'system') {
                    socket.emit('newMessage', result['data']);
                  } else {
                    io.emit('newMessage', result['data']);
                    io.emit('readMessage', result['data']);
                  }
                  // io.emit("newMessage", result["data"]);
                  // io.emit("readMessage", result["data"]);
                }
              },
            }),
          }
        );
      }
    } catch (error) {
      //
    }
  });

  socket.on("updateMessageStatus", async ({ authUserId, otherUserId }) => {
    try {
      await chatController.updateMessageStatus(authUserId, otherUserId);
    } catch (error) {
      //
    }
  });

  socket.on("getChatRooms", async (authUserId) => {
    try {
      const data = await chatController.fetchChatRooms(authUserId);
      socket.emit("chatRooms", data);
    } catch (error) {
      socket.emit("chatRooms", []);
    }
  });

  socket.on("requestChatRoomCount", async (authUserId) => {
    const count = await ChatRoom.count({
      where: {
        [Op.or]: [{ user1: authUserId }, { user2: authUserId }],
      },
      include: [
        {
          model: ChatMessage,
          as: "chat_messages",
          where: { status: "send", reciever_id: authUserId },
        },
      ],
    });
    socket.emit("chatRoomCount", count);
  });

  socket.on("disconnect", () => {
    socketUsers = socketUsers.filter((user) => user.socketId !== socket.id);
  });
});
