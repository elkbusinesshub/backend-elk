const admin = require("../../../../helpers/firebase");
const User = require('../../../../models/user.model');




const sendChatNotification = async ({
  isBlocked,
  isYouBlocked,
  type,
  userId,
  authUserId,
  message,
}) => {
  if (isBlocked || type === "system") return;

  const receiver = await User.findOne({
    where: { user_id: userId },
    attributes: ["notification_token"],
  });

  if (!receiver?.notification_token) return;

  const sender = await User.findOne({
    where: { user_id: authUserId },
    attributes: ["name"],
  });

  const notification = {
    token: receiver.notification_token,
    notification: {
      title: `New Message from ${sender?.name ?? "Someone"}`,
      body: message.length > 60 ? `${message.substring(0, 60)}…` : message,
    },
    data: {
      type: "chat",
      isBlockedByOther: isBlocked ? "1" : "0",
      isYouBlock: isYouBlocked ? "1" : "0",
      userId: userId.toString(),
      authUserId: authUserId.toString(),
    },
  };

  try {
    await admin.messaging().send(notification);
  } catch (err) {
    console.warn("⚠️ FCM send error:", err.code, err.message);
    if (
      [
        "messaging/registration-token-not-registered",
        "messaging/invalid-registration-token",
      ].includes(err.code)
    ) {
      await User.update(
        { notification_token: null },
        { where: { user_id: userId } },
      );
    }
  }
};

module.exports = {
  sendChatNotification,
};
