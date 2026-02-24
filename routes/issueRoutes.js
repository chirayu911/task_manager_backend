const express = require('express');
const router = express.Router();
const {
  getIssues,
  getIssueById,
  createIssue,
  updateIssue,
  deleteIssue,
} = require('../controllers/issueController');
const { protect } = require('../middleware/authMiddleware');

// All issue routes require the user to be logged in
router.use(protect);

router.route('/')
  .get(getIssues)
  .post(createIssue);

router.route('/:id')
  .get(getIssueById) // ⭐ Added GET for single issue retrieval
  .put(updateIssue)
  .delete(deleteIssue);

module.exports = router;