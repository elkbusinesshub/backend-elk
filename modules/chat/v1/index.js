const express = require("express");
const router = express.Router();
const chatController = require("./controller/chat.controller")
const validation = require("./validation/chat.validation");
const authenticateToken = require("../../../helpers/authentication");

//chat
router.post(
  "/add_chat",
  authenticateToken,
  validation.validateAddChat,
  chatController.addChat
);
router.post(
  '/report_user',
  authenticateToken,
  validation.validateBlockUnblock,
  chatController.reportAUser
);
router.get(
  "/get_chat",
  authenticateToken,
  validation.validateGetChat,
  chatController.getChatMessages
);
router.get(
  "/chat_rooms",
  authenticateToken,
  validation.validateChatRooms,
  chatController.getChatRooms
);
router.get(
  "/unread_chat_room_count",
  authenticateToken,
  validation.validateUnreadCount,
  chatController.getTotalChatRoomsCount
);
router.post(
  "/block_user",
  authenticateToken,
  validation.validateBlockUnblock,
  chatController.blockAUser
);
router.post(
  "/unblock_user",
  authenticateToken,
  validation.validateBlockUnblock,
  chatController.unblockAUser
);
router.get(
  "/is_blocked",
  authenticateToken,
  validation.validateIsBlocked,
  chatController.isUserBlocked
);

module.exports = router;
