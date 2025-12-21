const express = require("express");
const router = express.Router();
const chatController = require("./controller/chat.controller")
const validation = require("./validation/chat.validation");
const authentication = require("./../../../helpers/authentication");

//chat
router.post(
  "/add_chat",
  authentication,
  validation.validateAddChat,
  chatController.addChat
);
router.get(
  "/get_chat",
  validation.validateGetChat,
  chatController.getChatMessages
);
router.get(
  "/chat_rooms",
  validation.validateChatRooms,
  chatController.getChatRooms
);
router.get(
  "/unread_chat_room_count",
  validation.validateUnreadCount,
  chatController.getTotalChatRoomsCount
);
router.post(
  "/block_user",
  validation.validateBlockUnblock,
  chatController.blockAUser
);
router.post(
  "/unblock_user",
  validation.validateBlockUnblock,
  chatController.unblockAUser
);
router.get(
  "/is_blocked",
  validation.validateIsBlocked,
  chatController.isUserBlocked
);

module.exports = router;
