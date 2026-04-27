const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const checkPermission = require('../middleware/checkPermission');
const {
  getMyAttendance,
  getMyStats,
  getAllAttendance,
  getAttendanceSummary,
  updateAttendance,
  requestLeave,
  getPendingLeaves,
  updateLeaveStatus,
  getAttendanceByUser
} = require('../controllers/attendanceController');

// All routes are protected
router.use(protect);

router.route('/me').get(getMyAttendance);
router.route('/me/stats').get(getMyStats);

router.route('/').get(checkPermission('attendance_read'), getAllAttendance);
router.route('/summary').get(checkPermission('attendance_read'), getAttendanceSummary);
router.route('/:id').put(checkPermission('attendance_read'), updateAttendance);

router.route('/leave').post(requestLeave);
router.route('/leave/pending').get(checkPermission('attendance_read'), getPendingLeaves);
router.route('/leave/:id').put(checkPermission('attendance_read'), updateLeaveStatus);

router.route('/user/:id').get(checkPermission('attendance_read'), getAttendanceByUser);

module.exports = router;
