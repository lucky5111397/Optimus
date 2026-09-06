const express = require('express');
const repositoriesController = require('../controllers/repositories');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// All repository endpoints require authentication
router.use(requireAuth);

router.get('/github', repositoriesController.listGithubRepos);
router.get('/github/branches', repositoriesController.getGithubBranches);

router.get('/', repositoriesController.listImportedRepos);
router.post('/import', repositoriesController.importRepo);
router.get('/:id', repositoriesController.getImportedRepo);
router.get('/:id/file', repositoriesController.getFileContent);
router.post('/:id/index', repositoriesController.reindexRepo);

module.exports = router;

