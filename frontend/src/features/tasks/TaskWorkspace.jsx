import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import LiveExecution from './LiveExecution';

export default function TaskWorkspace() {
  const { id } = useParams();
  const [repo, setRepo] = useState(null);
  const [branches, setBranches] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('CODEBASE'); // 'CODEBASE' | 'TASKS'
  
  // Create Task form state
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);

  useEffect(() => {
    fetchRepoData();
    fetchTasks();
  }, [id]);

  const fetchRepoData = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/repositories/${id}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setRepo(data.repository);
        setBranches(data.branches);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/tasks?repositoryId=${id}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskTitle) return;
    setCreatingTask(true);
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          repositoryId: id,
          title: taskTitle,
          description: taskDesc
        })
      });
      
      if (res.ok) {
        setTaskTitle('');
        setTaskDesc('');
        setShowCreateTask(false);
        fetchTasks();
        setActiveTab('TASKS');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingTask(false);
    }
  };

  if (loading) return <div className="p-8 text-text-secondary">Loading workspace...</div>;
  if (!repo) return <div className="p-8 text-red-400">Repository not found.</div>;

  const defaultBranch = branches.find(b => b.isDefault);
  const files = defaultBranch?.fileIndex?.files || [];
  const symbols = defaultBranch?.fileIndex?.symbols || [];

  return (
    <div className="flex h-screen bg-background text-text-primary overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-surface border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <Link to="/repositories" className="text-text-secondary hover:text-white text-sm mb-4 inline-block">
            ← Back to Repositories
          </Link>
          <h2 className="font-heading font-semibold text-lg truncate" title={`${repo.owner}/${repo.name}`}>
            {repo.name}
          </h2>
          <p className="text-xs text-text-secondary mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Indexed ({files.length} files)
          </p>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            <button 
              onClick={() => setActiveTab('CODEBASE')}
              className={`w-full text-left px-3 py-2 rounded text-sm mb-1 transition-colors ${activeTab === 'CODEBASE' ? 'bg-primary/10 text-primary font-medium' : 'text-text-secondary hover:bg-gray-800/50'}`}
            >
              Codebase Explorer
            </button>
            <button 
              onClick={() => setActiveTab('TASKS')}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex justify-between items-center ${activeTab === 'TASKS' ? 'bg-primary/10 text-primary font-medium' : 'text-text-secondary hover:bg-gray-800/50'}`}
            >
              <span>Tasks</span>
              {tasks.length > 0 && (
                <span className="bg-gray-800 text-xs px-2 py-0.5 rounded-full">{tasks.length}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 border-b border-border bg-surface/50 backdrop-blur-md flex items-center px-6 flex-shrink-0">
          <h3 className="font-medium text-text-primary">
            {selectedTask ? 'Task Details' : activeTab === 'CODEBASE' ? 'Codebase Context' : 'Engineering Tasks'}
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {selectedTask ? (
            ['IMPLEMENTING', 'TESTING', 'VALIDATING', 'DIAGNOSING', 'VERIFYING', 'VERIFIED', 'FAILED'].includes(selectedTask.status) ? (
              <LiveExecution 
                task={selectedTask}
                onStatusChange={(newStatus) => {
                  setSelectedTask({ ...selectedTask, status: newStatus });
                  fetchTasks();
                }}
              />
            ) : (
              <ImplementationPlan 
                task={selectedTask} 
                onBack={() => { setSelectedTask(null); fetchTasks(); }} 
                onStatusChange={(newStatus) => {
                  setSelectedTask({ ...selectedTask, status: newStatus });
                  fetchTasks();
                }}
              />
            )
          ) : activeTab === 'CODEBASE' ? (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-surface border border-border p-4 rounded-md">
                  <h4 className="text-xs text-text-secondary uppercase mb-1">Total Files</h4>
                  <p className="text-2xl font-mono">{files.length}</p>
                </div>
                <div className="bg-surface border border-border p-4 rounded-md">
                  <h4 className="text-xs text-text-secondary uppercase mb-1">Semantic Symbols Extracted</h4>
                  <p className="text-2xl font-mono">{symbols.length}</p>
                </div>
              </div>

              <div className="bg-surface border border-border rounded-md overflow-hidden">
                <div className="p-3 border-b border-border bg-gray-900/30">
                  <h4 className="text-sm font-medium">Semantic Index</h4>
                </div>
                <div className="p-0">
                  {symbols.length === 0 ? (
                    <div className="p-6 text-center text-text-secondary text-sm">No supported code files (JS/JSX) found or parsed.</div>
                  ) : (
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-border text-text-secondary">
                          <th className="p-3 font-medium">File</th>
                          <th className="p-3 font-medium">Classes</th>
                          <th className="p-3 font-medium">Functions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {symbols.map((sym, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-gray-800/30 transition-colors">
                            <td className="p-3 font-mono text-xs text-primary">{sym.file}</td>
                            <td className="p-3">
                              {sym.classes.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {sym.classes.map(c => (
                                    <span key={c} className="px-1.5 py-0.5 bg-blue-900/30 text-blue-400 border border-blue-800 rounded text-[10px]">{c}</span>
                                  ))}
                                </div>
                              ) : <span className="text-text-secondary">-</span>}
                            </td>
                            <td className="p-3">
                              {sym.functions.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {sym.functions.map(f => (
                                    <span key={f} className="px-1.5 py-0.5 bg-purple-900/30 text-purple-400 border border-purple-800 rounded text-[10px]">{f}</span>
                                  ))}
                                </div>
                              ) : <span className="text-text-secondary">-</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-heading text-lg font-medium">Active Tasks</h3>
                <button 
                  onClick={() => setShowCreateTask(!showCreateTask)}
                  className="bg-primary hover:bg-opacity-90 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
                >
                  {showCreateTask ? 'Cancel' : 'New Task'}
                </button>
              </div>

              {showCreateTask && (
                <div className="bg-surface border border-border rounded-md p-5 mb-6">
                  <h4 className="font-medium mb-4">Create New Task</h4>
                  <form onSubmit={handleCreateTask}>
                    <div className="mb-4">
                      <label className="block text-sm text-text-secondary mb-1">Title</label>
                      <input 
                        type="text" 
                        value={taskTitle}
                        onChange={e => setTaskTitle(e.target.value)}
                        placeholder="e.g. Refactor API endpoints"
                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
                        required
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm text-text-secondary mb-1">Description (Optional)</label>
                      <textarea 
                        value={taskDesc}
                        onChange={e => setTaskDesc(e.target.value)}
                        placeholder="Detailed requirements..."
                        className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary min-h-[100px]"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button 
                        type="button"
                        onClick={() => setShowCreateTask(false)}
                        className="px-4 py-2 text-sm text-text-secondary hover:text-white"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        disabled={creatingTask || !taskTitle}
                        className="px-4 py-2 bg-primary hover:bg-opacity-90 text-white rounded text-sm font-medium disabled:opacity-50"
                      >
                        {creatingTask ? 'Creating...' : 'Create Task'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="space-y-3">
                {tasks.length === 0 && !showCreateTask ? (
                  <div className="text-center py-12 bg-surface border border-border rounded-md text-text-secondary text-sm">
                    No tasks created yet.
                  </div>
                ) : (
                  tasks.map(task => (
                    <div 
                      key={task._id} 
                      onClick={() => setSelectedTask(task)}
                      className="bg-surface border border-border rounded-md p-4 hover:border-gray-600 transition-colors cursor-pointer"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-text-primary">{task.title}</h4>
                          <p className="text-xs text-text-secondary mt-1">Created {new Date(task.createdAt).toLocaleDateString()}</p>
                        </div>
                        <span className="px-2 py-0.5 bg-gray-800 text-xs rounded border border-border text-text-secondary">
                          {task.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

