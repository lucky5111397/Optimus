const express = require('express');
const tasksController = require('../controllers/tasks');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', tasksController.listTasks);
router.post('/', tasksController.createTask);
router.get('/:id', tasksController.getTask);
router.get('/:id/context', tasksController.getTaskContext);
router.post('/:id/plan', tasksController.generatePlan);
router.get('/:id/plan', tasksController.getTaskPlan);
router.post('/:id/approve', tasksController.approvePlan);
router.post('/:id/reject', tasksController.rejectPlan);

const executionsController = require('../controllers/executions');
router.post('/:id/execute', executionsController.startExecution);
router.get('/:id/execution', executionsController.getExecution);
router.get('/:id/execution/events', executionsController.getExecutionEvents);
router.get('/:id/execution/audit', executionsController.getExecutionAudit);
router.post('/:id/execution/cancel', executionsController.cancelExecution);

router.get('/:id/report', tasksController.getReport);
router.get('/:id/review', tasksController.getTaskReview);
router.post('/:id/deliver', tasksController.deliverTask);
router.post('/:id/sync', tasksController.syncTaskPR);
router.delete('/:id', tasksController.deleteTask);

module.exports = router;


