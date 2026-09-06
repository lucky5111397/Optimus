const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
const Repository = require('../models/Repository');
const RepositoryBranch = require('../models/RepositoryBranch');
const User = require('../models/User');
const { cloneAndIndexRepository } = require('../services/repositoryService');
const { indexRepository } = require('../context/indexer');

const WORKSPACES_DIR = path.resolve(__dirname, '..', '..', 'workspaces');

exports.listGithubRepos = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || !user.accessToken) {
      return res.status(403).json({ error: 'GitHub account not connected.' });
    }

    const response = await axios.get('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Failed to list GitHub repos:', error.message);
    res.status(500).json({ error: 'Failed to fetch repositories from GitHub.' });
  }
};

const OWNER_REGEX = /^[a-zA-Z0-9_-]{1,100}$/;
const NAME_REGEX = /^(?!\.{1,2}$)[a-zA-Z0-9_.-]{1,100}$/;
const BRANCH_REGEX = /^(?!-)(?!.*\.\.)[a-zA-Z0-9_.-]+(\/[a-zA-Z0-9_.-]+)*$/;

exports.getGithubBranches = async (req, res) => {
  const { owner, name } = req.query;
  if (!owner || !name) {
    return res.status(400).json({ error: 'Missing owner or name' });
  }

  if (!OWNER_REGEX.test(owner) || !NAME_REGEX.test(name)) {
    return res.status(400).json({ error: 'Invalid repository owner or name format' });
  }

  try {
    const user = await User.findById(req.userId);
    if (!user || !user.accessToken) {
      return res.status(403).json({ error: 'GitHub account not connected.' });
    }

    const response = await axios.get(`https://api.github.com/repos/${owner}/${name}/branches`, {
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    res.json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    const message = status === 404 ? 'Repository or branches not found on GitHub.' : 'Failed to fetch branches from GitHub.';
    console.error('Failed to list GitHub branches:', error.message);
    res.status(status === 404 ? 404 : 500).json({ error: message });
  }
};

exports.listImportedRepos = async (req, res) => {
  try {
    const repos = await Repository.find({ userId: req.userId }).sort({ updatedAt: -1 });
    res.json(repos);
  } catch (error) {
    console.error('List imported repos error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getImportedRepo = async (req, res) => {
  try {
    const repo = await Repository.findOne({ _id: req.params.id, userId: req.userId });
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    
    // Also fetch branches
    const branches = await RepositoryBranch.find({ repositoryId: repo._id });
    
    res.json({ repository: repo, branches });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.importRepo = async (req, res) => {
  const { owner, name, branch } = req.body;
  if (!owner || !name || !branch) {
    return res.status(400).json({ error: 'Missing owner, name, or branch' });
  }

  if (!OWNER_REGEX.test(owner)) {
    return res.status(400).json({ error: 'Invalid repository owner format' });
  }

  if (!NAME_REGEX.test(name)) {
    return res.status(400).json({ error: 'Invalid repository name format' });
  }

  if (typeof branch !== 'string' || branch.length > 250 || !BRANCH_REGEX.test(branch)) {
    return res.status(400).json({ error: 'Invalid repository branch format' });
  }

  try {
    const user = await User.findById(req.userId);
    if (!user || !user.accessToken) {
      return res.status(403).json({ error: 'GitHub account not connected.' });
    }

    // Check if repo already exists for this user (strictly scoped to req.userId)
    let repo = await Repository.findOne({ userId: req.userId, owner, name });
    
    if (!repo) {
      repo = new Repository({
        userId: req.userId,
        provider: 'github',
        owner,
        name,
        status: 'IMPORTING',
        defaultBranch: branch
      });
      await repo.save();
    } else {
      // Reset status if re-importing
      repo.status = 'IMPORTING';
      repo.errorMessage = '';
      repo.defaultBranch = branch;
      await repo.save();
    }

    let repoBranch = await RepositoryBranch.findOne({ repositoryId: repo._id, name: branch });
    if (!repoBranch) {
      repoBranch = new RepositoryBranch({
        repositoryId: repo._id,
        name: branch,
        commitSha: 'HEAD',
        isDefault: true
      });
      await repoBranch.save();
    } else {
      repoBranch.indexStatus = 'PENDING';
      await repoBranch.save();
    }

    // Kick off async clone & index (don't await)
    cloneAndIndexRepository(repo, repoBranch, user.accessToken).catch(err => {
      console.error('Background clone error:', err.message || err);
    });

    res.status(202).json({ message: 'Import started', repository: repo });
  } catch (error) {
    console.error('Import repo error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/repositories/:id/file?path=<relativePath>
// Securely retrieves file contents from the repository workspace
exports.getFileContent = async (req, res) => {
  const { id } = req.params;
  const { path: reqPath } = req.query;

  if (!reqPath || typeof reqPath !== 'string') {
    return res.status(400).json({ error: 'Missing path query parameter' });
  }

  // Reject traversal characters, null bytes, or absolute paths
  if (reqPath.includes('\0') || reqPath.includes('..') || path.isAbsolute(reqPath)) {
    return res.status(400).json({ error: 'Invalid file path' });
  }

  try {
    const repo = await Repository.findOne({ _id: id, userId: req.userId });
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const workspacePath = path.resolve(WORKSPACES_DIR, repo._id.toString());
    const filePath = path.resolve(workspacePath, reqPath);

    // Enforce workspace directory containment
    const wsWithSep = workspacePath.endsWith(path.sep) ? workspacePath : workspacePath + path.sep;
    if (!filePath.startsWith(wsWithSep)) {
      return res.status(400).json({ error: 'File path outside repository workspace' });
    }

    // Exclude sensitive files
    const baseName = path.basename(filePath);
    if (
      baseName.startsWith('.env') ||
      baseName.endsWith('.pem') ||
      baseName.endsWith('.key') ||
      baseName.endsWith('.cert') ||
      baseName.includes('token') ||
      baseName.includes('credential')
    ) {
      return res.status(403).json({ error: 'Access to sensitive file denied' });
    }

    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return res.status(400).json({ error: 'Target is not a regular file' });
    }

    if (stat.size > 1024 * 1024) {
      return res.status(400).json({ error: 'File is too large to preview' });
    }

    const content = await fs.readFile(filePath, 'utf8');
    res.json({
      path: reqPath,
      name: baseName,
      size: stat.size,
      content
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    console.error('Get file content error:', error.message);
    res.status(500).json({ error: 'Failed to read file' });
  }
};

// POST /api/repositories/:id/index
// Triggers indexing of the cloned workspace and updates repository/branch metadata
exports.reindexRepo = async (req, res) => {
  const { id } = req.params;
  try {
    const repo = await Repository.findOne({ _id: id, userId: req.userId });
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const workspacePath = path.resolve(WORKSPACES_DIR, repo._id.toString());
    try {
      await fs.access(workspacePath);
    } catch (e) {
      return res.status(400).json({ error: 'Repository workspace does not exist on disk. Please import the repository first.' });
    }

    let branch = await RepositoryBranch.findOne({ repositoryId: repo._id, isDefault: true });
    if (!branch) {
      branch = await RepositoryBranch.findOne({ repositoryId: repo._id });
    }
    if (!branch) {
      return res.status(404).json({ error: 'Repository branch not found' });
    }

    branch.indexStatus = 'INDEXING';
    await branch.save();

    const indexData = await indexRepository(workspacePath);

    branch.fileIndex = indexData;
    branch.indexStatus = 'READY';
    branch.lastIndexed = new Date();
    await branch.save();

    repo.status = 'READY';
    repo.metadata = {
      ...(repo.metadata || {}),
      fileCount: indexData.fileCount,
      symbolCount: indexData.symbolCount
    };
    await repo.save();

    res.json({
      message: 'Repository re-indexed successfully',
      fileIndex: {
        fileCount: indexData.fileCount,
        symbolCount: indexData.symbolCount,
        fileTree: indexData.fileTree,
        dependencies: indexData.dependencies,
        symbols: indexData.symbols
      }
    });
  } catch (error) {
    console.error('Re-index repo error:', error.message);
    res.status(500).json({ error: 'Failed to re-index repository' });
  }
};

