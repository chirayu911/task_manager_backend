const express = require('express');
const router = express.Router();
const {
  getConversations,
  getUnreadCount,
  createOrGetConversation,
  addParticipantToGroup,
  removeParticipantFromGroup,
  getMessages,
  markMessagesAsRead,
  sendMessage
} = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

router.get('/conversations', protect, getConversations);
router.get('/conversations/unread-count', protect, getUnreadCount);
router.post('/conversations', protect, createOrGetConversation);
router.put('/conversations/:id/add-participant', protect, addParticipantToGroup);
router.put('/conversations/:id/remove-participant', protect, removeParticipantFromGroup);

router.get('/messages/:conversationId', protect, getMessages);
router.put('/messages/:conversationId/read', protect, markMessagesAsRead);
router.post('/messages', protect, sendMessage);

module.exports = router;
