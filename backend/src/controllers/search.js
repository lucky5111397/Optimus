const Repository = require('../models/Repository');
const RepositoryBranch = require('../models/RepositoryBranch');
const Task = require('../models/Task');

// GET /api/search?q=<query>
// Searches user-owned repositories, tasks, and indexed symbols.
// Never exposes filesystem paths or data from other users.
exports.search = async (req, res) => {
  const { q } = req.query;
  
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  const query = q.trim();
  const userId = req.userId;

  try {
    // Search repositories
    const repos = await Repository.find({
      userId,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { owner: { $regex: query, $options: 'i' } }
      ]
    }).limit(10).select('_id owner name status updatedAt');

    // Search tasks
    const tasks = await Task.find({
      userId,
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    }).limit(10).select('_id title status repositoryId updatedAt').populate('repositoryId', 'owner name');

    // Search indexed symbols from user's repositories
    const userRepoIds = await Repository.find({ userId }).distinct('_id');
    const branches = await RepositoryBranch.find({
      repositoryId: { $in: userRepoIds },
      isDefault: true,
      'fileIndex.symbols': { $exists: true }
    }).select('repositoryId fileIndex.symbols fileIndex.files').populate('repositoryId', 'owner name');

    const symbolResults = [];
    for (const branch of branches) {
      const symbols = branch.fileIndex?.symbols || [];
      const matchedSymbols = symbols.filter(s => {
        const name = (s.name || '').toLowerCase();
        const file = (s.file || '').toLowerCase();
        return name.includes(query.toLowerCase()) || file.includes(query.toLowerCase());
      });
      
      for (const sym of matchedSymbols.slice(0, 5)) {
        symbolResults.push({
          type: sym.type || 'symbol',
          name: sym.name,
          file: sym.file,
          repo: branch.repositoryId ? `${branch.repositoryId.owner}/${branch.repositoryId.name}` : 'Unknown',
          repoId: branch.repositoryId?._id || null
        });
      }
      if (symbolResults.length >= 15) break;
    }

    res.json({
      repositories: repos,
      tasks: tasks,
      symbols: symbolResults.slice(0, 15)
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
