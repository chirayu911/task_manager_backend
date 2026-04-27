const asyncHandler = require('express-async-handler');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const { sendLeaveRequestEmail, sendLeaveStatusEmail } = require('../utils/sendEmail');

/**
 * @desc    Get logged in user's attendance
 * @route   GET /api/attendance/me
 * @access  Private
 */
const getMyAttendance = asyncHandler(async (req, res) => {
  const attendance = await Attendance.find({ user: req.user._id })
    .sort({ date: 0 });

  res.status(200).json(attendance);
});

/**
 * @desc    Get logged in user's attendance stats (last 30 days)
 * @route   GET /api/attendance/me/stats
 * @access  Private
 */
const getMyStats = asyncHandler(async (req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const stats = await Attendance.aggregate([
    {
      $match: {
        user: req.user._id,
        date: { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const result = { present: 0, absent: 0, leave: 0 };
  stats.forEach(stat => {
    result[stat._id] = stat.count;
  });

  res.status(200).json(result);
});

/**
 * @desc    Get all attendance records (Company Owner or permitted staff)
 * @route   GET /api/attendance
 * @access  Private
 */
const getAllAttendance = asyncHandler(async (req, res) => {
  const attendance = await Attendance.find({ company: req.user.company })
    .populate('user', 'name email profilePicture')
    .sort({ date: 0 });

  res.status(200).json(attendance);
});

/**
 * @desc    Get attendance summary per user
 * @route   GET /api/attendance/summary
 * @access  Private
 */
const getAttendanceSummary = asyncHandler(async (req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const summary = await Attendance.aggregate([
    {
      $match: {
        company: req.user.company,
        date: { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: { user: '$user', status: '$status' },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.user',
        stats: {
          $push: {
            k: '$_id.status',
            v: '$count'
          }
        }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    {
      $unwind: '$userInfo'
    },
    {
      $project: {
        _id: 1,
        name: '$userInfo.name',
        email: '$userInfo.email',
        stats: { $arrayToObject: '$stats' }
      }
    }
  ]);

  res.status(200).json(summary);
});

/**
 * @desc    Update an attendance record manually (Owner)
 * @route   PUT /api/attendance/:id
 * @access  Private
 */
const updateAttendance = asyncHandler(async (req, res) => {
  const { status } = req.body;

  const attendance = await Attendance.findById(req.params.id);

  if (!attendance) {
    res.status(404);
    throw new Error('Attendance record not found');
  }

  attendance.status = status || attendance.status;
  await attendance.save();

  res.status(200).json(attendance);
});

/**
 * @desc    Internal cron job logic to mark absent users
 */
const markAbsent = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all users with a company
    const users = await User.find({ company: { $exists: true, $ne: null } });

    for (let user of users) {
      // Upsert record: if exists (e.g. present or leave), it won't change status to absent because we only do insert,
      // or we can explicitly look for missing and insert.
      const existingRecord = await Attendance.findOne({ user: user._id, date: today });
      
      if (!existingRecord) {
        await Attendance.create({
          user: user._id,
          company: user.company,
          date: today,
          status: 'absent'
        });
      }
    }
    console.log(`[CRON] Attendance processed for date ${today.toISOString().split('T')[0]}`);
  } catch (error) {
    console.error('[CRON ERROR] marking attendance:', error);
  }
};

/**
 * @desc    Submit a leave request
 * @route   POST /api/attendance/leave
 * @access  Private
 */
const requestLeave = asyncHandler(async (req, res) => {
  const { date, reason } = req.body;
  
  const parsedDate = new Date(date);
  parsedDate.setHours(0,0,0,0);

  const existing = await LeaveRequest.findOne({ user: req.user._id, date: parsedDate });
  if (existing) {
    res.status(400);
    throw new Error('Leave request already exists for this date');
  }

  const leaveRequest = await LeaveRequest.create({
    user: req.user._id,
    company: req.user.company,
    date: parsedDate,
    reason,
    status: 'pending'
  });

  const owner = await User.findOne({ company: req.user.company, isCompanyOwner: true });
  if (owner && owner.email) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const formattedDate = parsedDate.toLocaleDateString();
    await sendLeaveRequestEmail(owner.email, req.user.name, formattedDate, reason, frontendUrl);
  }

  res.status(201).json(leaveRequest);
});

/**
 * @desc    Get pending leave requests
 * @route   GET /api/attendance/leave/pending
 * @access  Private
 */
const getPendingLeaves = asyncHandler(async (req, res) => {
  const leaves = await LeaveRequest.find({ company: req.user.company, status: 'pending' })
    .populate('user', 'name email profilePicture')
    .sort({ date: 1 });
  res.status(200).json(leaves);
});

/**
 * @desc    Approve/Reject leave request
 * @route   PUT /api/attendance/leave/:id
 * @access  Private
 */
const updateLeaveStatus = asyncHandler(async (req, res) => {
  const { status } = req.body; 
  const leave = await LeaveRequest.findById(req.params.id).populate('user');

  if (!leave) {
    res.status(404);
    throw new Error('Leave request not found');
  }

  leave.status = status;
  await leave.save();

  if (status === 'approved') {
    await Attendance.findOneAndUpdate(
      { user: leave.user._id, date: leave.date },
      { 
        $set: { 
          company: leave.company,
          status: 'leave'
        } 
      },
      { upsert: true, new: true }
    );
  }

  if (leave.user && leave.user.email) {
    const formattedDate = new Date(leave.date).toLocaleDateString();
    await sendLeaveStatusEmail(leave.user.email, status, formattedDate);
  }

  res.status(200).json(leave);
});

/**
 * @desc    Get specific user's attendance records
 * @route   GET /api/attendance/user/:id
 * @access  Private (Owner/Admin)
 */
const getAttendanceByUser = asyncHandler(async (req, res) => {
  const attendance = await Attendance.find({ 
    user: req.params.id,
    company: req.user.company 
  }).sort({ date: 0 });
  
  res.status(200).json(attendance);
});

module.exports = {
  getMyAttendance,
  getMyStats,
  getAllAttendance,
  getAttendanceSummary,
  updateAttendance,
  markAbsent,
  requestLeave,
  getPendingLeaves,
  updateLeaveStatus,
  getAttendanceByUser
};
