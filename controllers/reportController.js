const asyncHandler = require('express-async-handler');
const Task = require('../models/Task');
const TaskStatus = require('../models/TaskStatus');

// @desc    Get aggregated dashboard reports for graphs
// @route   GET /api/reports/dashboard
const getDashboardReports = asyncHandler(async (req, res) => {
  const companyId = req.user.company;
  const { projectId } = req.query;
  
  const query = { company: companyId };
  if (projectId) {
    query.project = projectId;
  }

  // Find all tasks/issues for the user's company and optionally project
  const tasks = await Task.find(query)
    .populate('status', 'name')
    .select('itemType status createdAt hours')
    .lean();

  const statusCounts = {
    Task: {},
    Issue: {}
  };

  const completedStatuses = ['completed', 'done', 'resolved', 'closed'];
  const events = [];

  tasks.forEach(t => {
    // Default to 'Task' if type is missing
    const type = t.itemType && t.itemType.toLowerCase() === 'issue' ? 'Issue' : 'Task';
    const statusName = t.status?.name || 'Uncategorized';
    const statusNameLower = statusName.toLowerCase();
    
    // Aggregate by Status
    if (!statusCounts[type][statusName]) {
      statusCounts[type][statusName] = 0;
    }
    statusCounts[type][statusName]++;
    
    // Add creation event (+1 active item)
    const createdDate = new Date(t.createdAt).toISOString().split('T')[0];
    events.push({ date: createdDate, type, delta: 1 });

    // If completed, add a completion event (-1 active item) on the day it was updated
    if (completedStatuses.some(s => statusNameLower.includes(s))) {
      const updatedDate = new Date(t.updatedAt || t.createdAt).toISOString().split('T')[0];
      events.push({ date: updatedDate, type, delta: -1 });
    }
  });

  // Aggregate Events by Date
  const timelineRaw = {};
  events.forEach(e => {
    if (!timelineRaw[e.date]) {
       timelineRaw[e.date] = { date: e.date, TaskDelta: 0, IssueDelta: 0 };
    }
    timelineRaw[e.date][e.type + 'Delta'] += e.delta;
  });

  // Sort dates chronologically
  const timelineSorted = Object.values(timelineRaw).sort((a, b) => new Date(a.date) - new Date(b.date));

  // Compute running totals for active objects
  let activeTasks = 0;
  let activeIssues = 0;
  const timeline = timelineSorted.map(day => {
    activeTasks += day.TaskDelta;
    activeIssues += day.IssueDelta;
    return {
      date: day.date,
      ActiveTasks: Math.max(0, activeTasks),
      ActiveIssues: Math.max(0, activeIssues)
    };
  });

  // Convert statusCounts objects to arrays for recharts mapping
  const formatStatus = (dataObj) => Object.entries(dataObj).map(([name, count]) => ({ name, count }));

  res.json({
    statusCounts: {
      Task: formatStatus(statusCounts.Task),
      Issue: formatStatus(statusCounts.Issue)
    },
    timeline
  });
});

module.exports = {
  getDashboardReports
};
