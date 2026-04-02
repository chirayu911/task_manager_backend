const asyncHandler = require('express-async-handler');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const Project = require('../models/Project');
const { encryptMessage, decryptMessage } = require('../utils/encryption');

// @desc    Get all conversations for the user
// @route   GET /api/chat/conversations
const getConversations = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Pre-flight: Sync all projects the user is part of into Conversations
  const userProjects = await Project.find({
    company: req.user.company,
    $or: [{ assignedUsers: userId }, { createdBy: userId }]
  });

  for (const project of userProjects) {
    let conv = await Conversation.findOne({ project: project._id });
    if (!conv) {
      // Create it!
      const participants = new Set([project.createdBy.toString(), ...project.assignedUsers.map(id => id.toString())]);
      await Conversation.create({
        isGroup: true,
        name: project.title,
        project: project._id,
        participants: Array.from(participants),
        createdBy: project.createdBy,
        company: req.user.company
      });
    } else {
      // Update name to match project name and add user if not in participants
      let updated = false;
      if (conv.name !== project.title) {
        conv.name = project.title;
        updated = true;
      }
      if (!conv.participants.includes(userId)) {
        conv.participants.push(userId);
        updated = true;
      }
      if (updated) await conv.save();
    }
  }

  const conversations = await Conversation.find({
    participants: { $in: [userId] },
    company: req.user.company,
  })
    .populate({
      path: 'participants',
      select: 'name email profilePicture role',
      populate: { path: 'role', select: 'name' }
    })
    .populate('latestMessage')
    .sort({ updatedAt: -1 });

  // Compute unread count and decrypt latest message content for preview
  const decryptedConversations = await Promise.all(conversations.map(async (c) => {
    let conv = c.toObject();
    if (conv.latestMessage && conv.latestMessage.content) {
      conv.latestMessage.content = decryptMessage(conv.latestMessage.content);
    }
    
    conv.unreadCount = await Message.countDocuments({
      conversationId: conv._id,
      readBy: { $ne: userId }
    });

    return conv;
  }));

  res.json(decryptedConversations);
});

// @desc    Get total unread messages count
// @route   GET /api/chat/conversations/unread-count
const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  
  const conversations = await Conversation.find({ participants: { $in: [userId] } }, '_id');
  const convIds = conversations.map(c => c._id);

  const count = await Message.countDocuments({
    conversationId: { $in: convIds },
    readBy: { $ne: userId }
  });

  res.json({ unreadCount: count });
});

// @desc    Get or create a direct conversation
// @route   POST /api/chat/conversations
const createOrGetConversation = asyncHandler(async (req, res) => {
  const { participantId, participantIds, projectId, isGroup, name } = req.body;
  const userId = req.user._id;

  if (projectId) {
    // Project Chat
    let conv = await Conversation.findOne({ project: projectId });
    if (!conv) {
      const project = await Project.findById(projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      conv = await Conversation.create({
        isGroup: true,
        name: project.title,
        project: projectId,
        participants: [project.createdBy, ...project.assignedUsers], // Add existing participants
        createdBy: userId,
        company: req.user.company
      });
    }
    const populatedConv = await Conversation.findById(conv._id).populate({
      path: 'participants',
      select: 'name email profilePicture role',
      populate: { path: 'role', select: 'name' }
    });
    return res.status(200).json(populatedConv);
  }

  if (isGroup) {
     const groupParticipants = [userId];
     if (participantIds && Array.isArray(participantIds)) {
       participantIds.forEach(id => {
         if (id !== userId.toString()) groupParticipants.push(id);
       });
     }

     const newGroup = await Conversation.create({
        isGroup: true,
        name,
        participants: groupParticipants, 
        createdBy: userId,
        company: req.user.company
     });
     
     const populatedGroup = await Conversation.findById(newGroup._id).populate({
      path: 'participants',
      select: 'name email profilePicture role',
      populate: { path: 'role', select: 'name' }
     });
     return res.status(201).json(populatedGroup);
  }

  // Direct Message Mode
  let conv = await Conversation.findOne({
    isGroup: false,
    participants: { $all: [userId, participantId] },
    company: req.user.company
  });

  if (!conv) {
    conv = await Conversation.create({
      isGroup: false,
      participants: [userId, participantId],
      createdBy: userId,
      company: req.user.company
    });
  }

  const populatedConv = await Conversation.findById(conv._id).populate({
    path: 'participants',
    select: 'name email profilePicture role',
    populate: { path: 'role', select: 'name' }
  });
  res.status(200).json(populatedConv);
});

// @desc    Add Participant to Chat Group
// @route   PUT /api/chat/conversations/:id/add-participant
const addParticipantToGroup = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  const conversationId = req.params.id;

  const conversation = await Conversation.findById(conversationId);
  if (!conversation || !conversation.isGroup) {
    return res.status(404).json({ message: "Group chat not found" });
  }

  // Check if current user is the owner
  if (conversation.createdBy?.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Only the group creator can add participants." });
  }

  if (!conversation.participants.includes(userId)) {
    conversation.participants.push(userId);
    await conversation.save();

    const io = req.app.get("io");
    if (io) {
      io.to(userId.toString()).emit("addedToConversation", conversation);
      io.emit("updateConversationsList");
    }
  }

  res.json(conversation);
});

// @desc    Remove Participant from Chat Group
// @route   PUT /api/chat/conversations/:id/remove-participant
const removeParticipantFromGroup = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  const conversationId = req.params.id;

  const conversation = await Conversation.findById(conversationId);
  if (!conversation || !conversation.isGroup) {
    return res.status(404).json({ message: "Group chat not found" });
  }

  // Check if current user is the owner
  if (conversation.createdBy?.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Only the group creator can remove participants." });
  }

  if (conversation.participants.includes(userId)) {
    conversation.participants = conversation.participants.filter(id => id.toString() !== userId);
    await conversation.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("updateConversationsList");
    }
  }

  res.json({ message: "Participant removed successfully" });
});

// @desc    Get messages for a conversation
// @route   GET /api/chat/messages/:conversationId
const getMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  const messages = await Message.find({ conversationId })
    .populate('sender', 'name profilePicture')
    .sort({ createdAt: 1 });

  const decryptedMessages = messages.map(msg => {
    let obj = msg.toObject();
    obj.content = decryptMessage(obj.content);
    return obj;
  });

  res.json(decryptedMessages);
});

// @desc    Mark messages as read
// @route   PUT /api/chat/messages/:conversationId/read
const markMessagesAsRead = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id;

  await Message.updateMany(
    { conversationId, readBy: { $ne: userId } },
    { $addToSet: { readBy: userId } }
  );

  res.json({ message: "Messages marked as read" });
});

// @desc    Send a message via HTTP (fallback)
// @route   POST /api/chat/messages
const sendMessage = asyncHandler(async (req, res) => {
  const { conversationId, content } = req.body;
  const senderId = req.user._id;

  if (!content) return res.status(400).json({ message: "Message content cannot be empty" });

  const encryptedContent = encryptMessage(content);

  const message = await Message.create({
    conversationId,
    sender: senderId,
    content: encryptedContent,
    readBy: [senderId]
  });

  await Conversation.findByIdAndUpdate(conversationId, {
    latestMessage: message._id,
    updatedAt: new Date()
  });

  const fullMessage = await Message.findById(message._id).populate('sender', 'name profilePicture');
  let cleanMessage = fullMessage.toObject();
  cleanMessage.content = decryptMessage(cleanMessage.content);

  const io = req.app.get("io");
  if (io) {
     io.to(conversationId).emit("receiveMessage", cleanMessage);
     io.emit("updateConversationsList");
  }

  res.status(201).json(cleanMessage);
});

module.exports = {
  getConversations,
  getUnreadCount,
  createOrGetConversation,
  addParticipantToGroup,
  removeParticipantFromGroup,
  getMessages,
  markMessagesAsRead,
  sendMessage
};
