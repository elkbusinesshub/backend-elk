const ChatRoom = require("../../../../models/chatRoom.model");
const ChatMessage = require("../../../../models/chatMessage.model");
require("dotenv").config();
const { Op, literal } = require("sequelize");
const BlockedUser = require("../../../../models/blockedUser.model");
const sequelize = require("../../../../config/db");
const User = require("../../../../models/user.model");
const {
  responseStatusCodes,
  responseMessages,
} = require("../../../../helpers/appConstants");
const { getImageUrlPublic, uploadToS3, generateRoomId } = require("../../../../helpers/utils");
const ReportUser = require("../../../../models/reportUser.model");
const { sendChatNotification } = require('../service/chat.service');
const dayjs = require("dayjs");


const addChat = async (req, res, next) => {
    try {
        const { authUserId, userId, message, type, file_name, ad_id, ad_name, status } = req.body;
        const file = req.file;

        const isMediaType = ['image', 'audio', 'video'].includes(type);

        // Validate file for media messages
        if (isMediaType && !file) {
            return res.error(responseMessages.invalidRequest);
        }

        // Check block status and chat room in parallel
        const [isBlocked, isYouBlocked, existingRoom] = await Promise.all([
            BlockedUser.findOne({ where: { blocker_id: userId, blocked_id: authUserId } }),
            BlockedUser.findOne({ where: { blocker_id: authUserId, blocked_id: userId } }),
            ChatRoom.findOne({
                where: {
                    [Op.or]: [
                        { user1: authUserId, user2: userId },
                        { user1: userId, user2: authUserId }
                    ]
                }
            })
        ]);

        const lastMessageTime = Date.now();

        // Create or update chat room
        const chatRoom = existingRoom
            ? await existingRoom.update({ last_message_time: lastMessageTime })
            : await ChatRoom.create({
                room_id: generateRoomId(),
                user1: authUserId,
                user2: userId,
                last_message_time: lastMessageTime
            });

        // Upload file if present
        if (file) await uploadToS3(file, file_name);

        // Build message payload
        const messagePayload = {
            room_id: chatRoom.room_id,
            sender_id: authUserId,
            reciever_id: userId,
            message,
            type,
            status: isBlocked ? 'blocked' : status,
            file_name: isMediaType ? file_name : '',
            ad_id,
            ad_name,
            time: lastMessageTime
        };

        const chatMessage = await ChatMessage.create(messagePayload);

        // Attach file URL for media messages
        if (isMediaType && file_name) {
            chatMessage.dataValues.file_url = getImageUrlPublic(file_name);
        }

        // Send push notification
        await sendChatNotification({ 
            isBlocked, 
            isYouBlocked, 
            type, 
            userId, 
            authUserId, 
            message 
        });

        return res.success(responseMessages.chatAdded, chatMessage.dataValues);

    } catch (error) {
        return next(error);
    }
};

const blockAUser = async (req, res, next) => {
  const { authUserId, otherUserId } = req.body;
  // if ( !authUserId && !otherUserId ) {
  //     return res.status(responseStatusCodes.badRequest).json({ message: responseMessages.invalidRequest });
  // }
  try {
    const existingBlock = await BlockedUser.findOne({
      where: { blocker_id: authUserId, blocked_id: otherUserId },
    });

    if (existingBlock) {
      // return res
      //   .status(responseStatusCodes.success)
      //   .json({ message: "Success" });
      return res.success(responseMessages.alreadyBlocked)
    }
    await BlockedUser.create({
      blocker_id: authUserId,
      blocked_id: otherUserId,
    });

    // return res
    //   .status(responseStatusCodes.success)
    //   .json({ message: "Success!" });
    return res.success(responseMessages.userBlocked);
  } catch (e) {
    // return res.status(responseStatusCodes.internalServerError).json({ message: responseMessages.internalServerError });
    return next(e);
  }
};


const reportAUser = async (req, res, next) => {
  const { authUserId, otherUserId, reason } = req.body;
  if (!authUserId && !otherUserId && !reason) {
    // return res
    //   .status(responseStatusCodes.badRequest)
    //   .json({ message: responseMessages.invalidRequest });
    return res.error(responseMessages.invalidRequest);
  }
  try {
    await ReportUser.create({
      reporter_id: authUserId,
      reported_id: otherUserId,
      reason: reason,
    });
    // return res
    //   .status(responseStatusCodes.success)
    // .json({ message: "Success!" });
    return res.success(responseMessages.userReported);
  } catch (e) {
    return next(e);
    // return res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ message: responseMessages.internalServerError });
  }
};


const unblockAUser = async (req, res, next) => {
  const { authUserId, otherUserId } = req.body;
  //   if (!authUserId && !otherUserId) {
  //     return res
  //       .status(responseStatusCodes.badRequest)
  //       .json({ message: responseMessages.invalidRequest });
  //   }
  try {
    const result = await BlockedUser.destroy({
      where: { blocker_id: authUserId, blocked_id: otherUserId },
    });
    if (result === 0) {
      //   return res
      //     .status(responseStatusCodes.notFound)
      //     .json({ message: "No block record found" });
      return res.success(
        responseMessages.noBlockRecord,
        null,
        responseStatusCodes.notFound
      );
    }
    // return res
    //   .status(responseStatusCodes.success)
    //   .json({ message: "User unblocked successfully!" });
    return res.success(responseMessages.userUnblocked);
  } catch (e) {
    // return res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ message: responseMessages.internalServerError });
    return next(e);
  }
};

const isUserBlocked = async (req, res, next) => {
  const { blockerId, blockedId } = req.query;
  //   if (!blockerId || !blockedId) {
  //     return res
  //       .status(responseStatusCodes.badRequest)
  //       .json({ message: responseMessages.invalidRequest });
  //   }
  try {
    const isBlocked = await BlockedUser.findOne({
      where: { blocker_id: blockerId, blocked_id: blockedId },
    });

    if (isBlocked) {
      //   return res
      //     .status(responseStatusCodes.success)
      //     .json({ message: "User is blocked", blocked: true });
      return res.success(responseMessages.userBlocked, { blocked: true });
    } else {
      //   return res
      //     .status(responseStatusCodes.success)
      //     .json({ message: "User is not blocked", blocked: false });
      return res.success(responseMessages.userNotBlocked, { blocked: false });
    }
  } catch (e) {
    // return res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ message: responseMessages.internalServerError });
    return next(e);
  }
};


const updateMessageStatus = async (authUserId, otherUserId) => {
  try {
    let chatRoom = await ChatRoom.findOne({
      where: {
        [Op.or]: [
          { user1: authUserId, user2: otherUserId },
          { user1: otherUserId, user2: authUserId },
        ],
      },
    });
    if (!chatRoom) {
      return;
    }
    const chats = await ChatMessage.update(
      { status: "read" },
      {
        where: {
          room_id: chatRoom.room_id,
          sender_id: otherUserId,
          status: { [Op.eq]: "send" },
        },
      }
    );
    // return { authUserId, otherUserId };
    return res.success(responseMessages.messageUpdated, {
      authUserId,
      otherUserId,
    });
  } catch (e) {
    return next(e);
  }
};


const getChatMessages = async (req, res, next) => {
    try {
        const { authUserId, otherUserId } = req.query;

        // Run block checks and chat room query in parallel
        const [isBlockedByOther, isYouBlockedOther, chatRoom] = await Promise.all([
            BlockedUser.findOne({ where: { blocker_id: otherUserId, blocked_id: authUserId } }),
            BlockedUser.findOne({ where: { blocker_id: authUserId, blocked_id: otherUserId } }),
            ChatRoom.findOne({
                where: {
                    [Op.or]: [
                        { user1: authUserId, user2: otherUserId },
                        { user1: otherUserId, user2: authUserId }
                    ]
                }
            })
        ]);

        if (!chatRoom) {
            return res.success(responseMessages.chatRoomNotFound, { chatMessages: [], chatRoom: {} });
        }

        const chatMessages = await ChatMessage.findAll({
            where: {
                room_id: chatRoom.room_id,
                [Op.or]: [
                    { reciever_id: { [Op.ne]: authUserId } },
                    { status: { [Op.ne]: 'blocked' } }
                ]
            },
            order: [['time', 'ASC']]
        });

        const cleanMessages = chatMessages.map(msg => ({
            ...msg.dataValues,
            file_url: msg.file_name ? getImageUrlPublic(msg.file_name) : null
        }));

        return res.success(responseMessages.chatRoomFound, {
            chatMessages: cleanMessages,
            chatRoom: chatRoom.dataValues,
            isBlockedByOther: !!isBlockedByOther,
            isYouBlockedOther: !!isYouBlockedOther
        });

    } catch (error) {
        return next(error);
    }
};


const getTotalChatRoomsCount = async (req, res, next) => {
    try {
        const { authUserId } = req.query;

        const count = await ChatRoom.count({
            where: {
                [Op.or]: [{ user1: authUserId }, { user2: authUserId }]
            },
            include: [{
                model: ChatMessage,
                as: 'chat_messages',
                where: { status: 'send', reciever_id: authUserId },
                attributes: []  // don't fetch any message columns, we only need the count
            }],
            distinct: true  // ensures accurate count with join
        });

        return res.success(responseMessages.chatRoomFound, { count });

    } catch (error) {
        return next(error);
    }
};

// const getChatRooms = async (req, res, next) => {
//   const { authUserId } = req.query;
//   try {
//     const chatRooms = await ChatRoom.findAll({
//       where: {
//         [Op.or]: [{ user1: authUserId }, { user2: authUserId }],
//       },
//       attributes: {
//         include: [
//           [
//             sequelize.fn(
//               "COUNT",
//               sequelize.literal(
//                 `CASE WHEN chat_messages.reciever_id = ${authUserId} and chat_messages.status = 'send' THEN 1 END`
//               )
//             ),
//             "new_message_count",
//           ],
//         ],
//       },
//       include: [
//         { model: User, as: "User1" },
//         { model: User, as: "User2" },
//         {
//           model: ChatMessage,
//           as: "chat_messages",
//           attributes: [],
//           required: false,
//         },
//       ],
//       group: ["ChatRoom.id"],
//       order: [["last_message_time", "DESC"]],
//     });
//     let data = [];
//     if (chatRooms.length > 0) {
//       data = await Promise.all(
//         chatRooms.map(async (chatRoom) => {
//           const localTime = new Date(chatRoom.last_message_time).toLocaleString(
//             "en-US",
//             {
//               day: "numeric",
//               month: "long",
//               year: "numeric",
//               hour: "numeric",
//               minute: "numeric",
//               hour12: true,
//             }
//           );
//           chatRoom.last_message_time === localTime;
//           const authUser =
//             chatRoom.User1.id === authUserId
//               ? chatRoom.User1.toJSON()
//               : chatRoom.User2.toJSON();
//           const otherUser =
//             chatRoom.User1.id === authUserId
//               ? chatRoom.User2.toJSON()
//               : chatRoom.User1.toJSON();
//           authUser.profile = authUser.profile
//             ? getImageUrlPublic(authUser.profile)
//             : null;
//           otherUser.profile = otherUser.profile
//             ? getImageUrlPublic(otherUser.profile)
//             : null;
//           const isBlockedByOther = await BlockedUser.findOne({
//             where: {
//               blocker_id: otherUser.id,
//               blocked_id: authUser.id,
//             },
//           });

//           const isYouBlockedOther = await BlockedUser.findOne({
//             where: {
//               blocker_id: authUser.id,
//               blocked_id: otherUser.id,
//             },
//           });
//           return {
//             ...chatRoom.toJSON(),
//             last_message_time: localTime,
//             User1: null,
//             User2: null,
//             authUser,
//             otherUser,
//             isBlockedByOther: !!isBlockedByOther, // return boolean
//             isYouBlockedOther: !!isYouBlockedOther,
//           };
//         })
//       );
//     }
//     // res
//     //   .status(responseStatusCodes.success)
//     //   .json({ message: "Chat messages retrieved successfully", data });
//     return res.success(responseMessages.chatRoomFound, data);
//   } catch (e) {
//     // res
//     //   .status(responseStatusCodes.internalServerError)
//     //   .json({ message: "Something went wrong: " + e.message });
//     return next(e);
//   }
// };

//done
const getChatRooms = async (req, res, next) => {
    try {
        const { authUserId } = req.query;

        const chatRooms = await ChatRoom.findAll({
            where: {
                [Op.or]: [{ user1: authUserId }, { user2: authUserId }]
            },
            attributes: {
                include: [[
                    sequelize.fn(
                        'COUNT',
                        sequelize.literal(
                            `CASE WHEN chat_messages.reciever_id = ${authUserId} AND chat_messages.status = 'send' THEN 1 END`
                        )
                    ),
                    'new_message_count'
                ]]
            },
            include: [
                { model: User, as: 'User1', attributes: ['id', 'name', 'profile'] },
                { model: User, as: 'User2', attributes: ['id', 'name', 'profile'] },
                { model: ChatMessage, as: 'chat_messages', attributes: [], required: false }
            ],
            group: ['ChatRoom.id'],
            order: [['last_message_time', 'DESC']]
        });

        if (!chatRooms.length) {
            return res.success(responseMessages.chatRoomFound, []);
        }

        // Collect all other user IDs in one pass
        const otherUserIds = chatRooms.map(room =>
            room.User1.id === authUserId ? room.User2.id : room.User1.id
        );

        // Fetch all block statuses in 2 queries instead of 2N
        const [blockedByOthers, youBlockedOthers] = await Promise.all([
            BlockedUser.findAll({
                where: { blocker_id: { [Op.in]: otherUserIds }, blocked_id: authUserId },
                attributes: ['blocker_id']
            }),
            BlockedUser.findAll({
                where: { blocker_id: authUserId, blocked_id: { [Op.in]: otherUserIds } },
                attributes: ['blocked_id']
            })
        ]);

        // Build sets for O(1) lookup
        const blockedByOthersSet = new Set(blockedByOthers.map(b => b.blocker_id));
        const youBlockedOthersSet = new Set(youBlockedOthers.map(b => b.blocked_id));

        const data = chatRooms.map(chatRoom => {
            const isAuthUser1 = chatRoom.User1.id === authUserId;

            const authUser = (isAuthUser1 ? chatRoom.User1 : chatRoom.User2).toJSON();
            const otherUser = (isAuthUser1 ? chatRoom.User2 : chatRoom.User1).toJSON();

            if (authUser.profile) authUser.profile = getImageUrlPublic(authUser.profile);
            if (otherUser.profile) otherUser.profile = getImageUrlPublic(otherUser.profile);

            return {
                ...chatRoom.toJSON(),
                last_message_time: dayjs(chatRoom.last_message_time).format('MMMM D, YYYY h:mm A'),
                // User1: null,
                // User2: null,
                authUser,
                otherUser,
                isBlockedByOther: blockedByOthersSet.has(otherUser.id),
                isYouBlockedOther: youBlockedOthersSet.has(otherUser.id)
            };
        });

        return res.success(responseMessages.chatRoomFound, data);

    } catch (error) {
        return next(error);
    }
};

//done
const fetchChatRooms = async (authUserId) => {
  const id = String(authUserId); // ✅ normalize to string for comparison
  console.log("🔍 fetchChatRooms authUserId:", id, typeof id);

  try {
    const chatRooms = await ChatRoom.findAll({
      where: {
        [Op.or]: [{ user1: id }, { user2: id }]
      },
      attributes: {
        include: [[
          sequelize.fn(
            'COUNT',
            sequelize.literal(
              `CASE WHEN chat_messages.reciever_id = ${id} AND chat_messages.status = 'send' THEN 1 END`
            )
          ),
          'new_message_count'
        ]]
      },
      include: [
        { model: User, as: 'User1', attributes: ['user_id', 'name', 'profile'] },
        { model: User, as: 'User2', attributes: ['user_id', 'name', 'profile'] },
        { model: ChatMessage, as: 'chat_messages', attributes: [], required: false }
      ],
      group: ['ChatRoom.id'],
      order: [['last_message_time', 'DESC']]
    });

    console.log("🔍 chatRooms found:", chatRooms.length);
    if (!chatRooms.length) return [];

    const otherUserIds = chatRooms.map(room =>
      String(room.User1.user_id) === id ? room.User2.user_id : room.User1.user_id // ✅ cast comparison
    );

    const [blockedByOthers, youBlockedOthers] = await Promise.all([
      BlockedUser.findAll({
        where: { blocker_id: { [Op.in]: otherUserIds }, blocked_id: id },
        attributes: ['blocker_id']
      }),
      BlockedUser.findAll({
        where: { blocker_id: id, blocked_id: { [Op.in]: otherUserIds } },
        attributes: ['blocked_id']
      })
    ]);

    const blockedByOthersSet = new Set(blockedByOthers.map(b => String(b.blocker_id)));
    const youBlockedOthersSet = new Set(youBlockedOthers.map(b => String(b.blocked_id)));

    return chatRooms.map(chatRoom => {
      const isAuthUser1 = String(chatRoom.User1.user_id) === id; // ✅ cast comparison

      const authUser = (isAuthUser1 ? chatRoom.User1 : chatRoom.User2).toJSON();
      const otherUser = (isAuthUser1 ? chatRoom.User2 : chatRoom.User1).toJSON();

      if (authUser.profile) authUser.profile = getImageUrlPublic(authUser.profile);
      if (otherUser.profile) otherUser.profile = getImageUrlPublic(otherUser.profile);

      return {
        ...chatRoom.toJSON(),
        last_message_time: dayjs(chatRoom.last_message_time).format('MMMM D, YYYY h:mm A'),
        User1: null,
        User2: null,
        authUser,
        otherUser,
        isBlockedByOther: blockedByOthersSet.has(String(otherUser.user_id)),
        isYouBlockedOther: youBlockedOthersSet.has(String(otherUser.user_id))
      };
    });

  } catch (error) {
    console.error("❌ fetchChatRooms error:", error.message); // ✅ fixed — no next()
    return [];
  }
};

//done
const deleteOneChatMessageForUser = async (req, res, next) => {
  const { authUserId, messageId } = req.body;
  //   if (!authUserId || !messageId) {
  //     return res
  //       .status(responseStatusCodes.badRequest)
  //       .json({ message: responseMessages.invalidRequest });
  //   }
  try {
    const chatMessage = await ChatMessage.findByPk(messageId);
    if (!chatMessage) {
      //   return res
      //     .status(responseStatusCodes.notFound)
      //     .json({ message: "Chat message not found" });
      return res.error(
        responseMessages.chatNotFound,
        null,
        responseStatusCodes.notFound
      );
    }
    if (!chatMessage.deleted_for.includes(authUserId)) {
      chatMessage.deleted_for.push(authUserId);
      await chatMessage.save();
    }
    // res
    //   .status(responseStatusCodes.success)
    //   .json({ message: "Chat message deleted for user successfully" });
    return res.success(responseMessages.usersChatDeleted);
  } catch (error) {
    // res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ message: "Something went wrong: " });
    return next(error);
  }
};

//done
const deleteAllMessagesForUser = async (req, res, next) => {
    try {
        const { authUserId, otherUserId } = req.body;

        const chatRoom = await ChatRoom.findOne({
            where: {
                [Op.or]: [
                    { user1: authUserId, user2: otherUserId },
                    { user1: otherUserId, user2: authUserId }
                ]
            },
            attributes: ['room_id']
        });

        if (!chatRoom) {
            return res.error(responseMessages.chatRoomNotFound, null, responseStatusCodes.notFound);
        }

        const chatMessages = await ChatMessage.findAll({
            where: {
                room_id: chatRoom.room_id,
                // only fetch messages not already deleted for this user
                deleted_for: { [Op.not]: { [Op.contains]: [authUserId] } }
            },
            attributes: ['id', 'deleted_for']
        });

        if (chatMessages.length) {
            await Promise.all(
                chatMessages.map(message => {
                    message.deleted_for = [...message.deleted_for, authUserId];
                    return message.save();
                })
            );
        }

        return res.success(responseMessages.deletedUserChat);

    } catch (error) {
        return next(error);
    }
};

//done
const deleteRoom = async (req, res, next) => {
  const { id } = req.body;
  //   if (!id) {
  //     return res
  //       .status(responseStatusCodes.badRequest)
  //       .json({ message: responseMessages.invalidRequest });
  //   }
  try {
    const chatRoom = await ChatRoom.findOne({ where: { room_id: id } });
    if (!chatRoom) {
      return res
        .status(responseStatusCodes.success)
        .json({ message: "Already deleted!" });
    }
    await ChatMessage.destroy({ where: { room_id: id } });
    // await Participant.destroy({ where: { room_id: id } });
    await ChatRoom.destroy({ where: { room_id: id } });
    // return res
    //   .status(responseStatusCodes.success)
    //   .json({ message: "Successfully Deleted!" });
    return res.success(responseMessages.chatRoomDeleted);
  } catch (error) {
    // return res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ message: responseMessages.internalServerError });
    return next(error);
  }
};

//done
const deleteMessage = async (req, res, next) => {
  const { id } = req.body;
//   if (!id) {
//     return res
//       .status(responseStatusCodes.badRequest)
//       .json({ message: responseMessages.invalidRequest });
//   }
  try {
    const message = await ChatMessage.findOne({ where: { id: id } });
    if (!message) {
    //   return res
    //     .status(responseStatusCodes.badRequest)
    //     .json({ message: "Already deleted!" });
    return res.error(responseMessages.chatAlreadyDeleted);
    }
    await ChatMessage.destroy({ where: { id: id } });
    // return res
    //   .status(responseStatusCodes.success)
    //   .json({ message: "Successfully Deleted!" });
    return res.success(responseMessages.chatAlreadyDeleted);
  } catch (error) {
    // return res
    //   .status(responseStatusCodes.internalServerError)
    //   .json({ message: responseMessages.internalServerError });
    return next(error);
  }
};

module.exports = {
  addChat,
  blockAUser,
  reportAUser,
  unblockAUser,
  isUserBlocked,
  getChatMessages,
  getTotalChatRoomsCount,
  getChatRooms,
  fetchChatRooms,
  deleteOneChatMessageForUser,
  deleteAllMessagesForUser,
  deleteRoom,
  deleteMessage
}