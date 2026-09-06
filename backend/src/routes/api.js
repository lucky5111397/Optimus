const express = require('express');
const { requireAuth } = require('../middleware/auth');
const activityController = require('../controllers/activity');
const analyticsController = require('../controllers/analytics');
const searchController = require('../controllers/search');
const executionsController = require('../controllers/executions');

const router = express.Router();

router.use(requireAuth);

// Activity feed
router.get('/activity', activityController.getActivity);

// Analytics
router.get('/analytics', analyticsController.getAnalytics);

// Search
router.get('/search', searchController.search);

// Executions history
router.get('/executions/history', executionsController.getExecutionHistory);

module.exports = router;
