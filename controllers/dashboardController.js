const asyncHandler = require('express-async-handler');
const Attendance = require('../models/Attendance');
const Task = require('../models/Task');
const TaskStatus = require('../models/TaskStatus');

/**
 * @desc    Get dashboard statistics for the logged in user
 * @route   GET /api/dashboard/stats
 * @access  Private
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const companyId = req.user.company;

  // 1. Attendance Stats for current month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const attendanceRecords = await Attendance.find({
    user: userId,
    date: { $gte: startOfMonth }
  });

  let present = 0;
  let absent = 0;
  let leave = 0;

  attendanceRecords.forEach(record => {
    if (record.status === 'present') present++;
    if (record.status === 'absent') absent++;
    if (record.status === 'leave') leave++;
  });

  const totalDays = present + absent + leave;

  const attendance = { present, absent, leave, totalDays };

  // 2. Tasks by status for the pie chart
  const taskQuery = { company: companyId };
  if (!req.user.isCompanyOwner) {
    taskQuery.assignedTo = userId;
  }

  const userTasks = await Task.find(taskQuery).populate('status');

  const statusCountMap = {};

  userTasks.forEach(task => {
    if (task.status) {
      const statusId = task.status._id.toString();
      if (!statusCountMap[statusId]) {
        statusCountMap[statusId] = {
          statusName: task.status.name,
          color: task.status.color,
          count: 0
        };
      }
      statusCountMap[statusId].count++;
    }
  });

  const tasksByStatus = Object.values(statusCountMap);

  // 3. Recent 5 tasks
  const recentTasks = await Task.find(taskQuery)
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('status', 'name color');

  res.status(200).json({
    attendance,
    tasksByStatus,
    recentTasks
  });
});

module.exports = {
  getDashboardStats
};
