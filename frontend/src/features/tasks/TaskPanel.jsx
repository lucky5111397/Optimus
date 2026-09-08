import React, { useState, useEffect } from 'react';
import { Zap, Plus, ArrowLeft, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { StatusBadge, EmptyState, SectionHeader } from '../../components/ui';
import TaskDetail from './TaskDetail';

export default function TaskPanel({ repositoryId }) {
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [deletingTask, setDeletingTask] = useState(false);

  const fetchTasks = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/tasks?repositoryId=${repositoryId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        setTasks(await response.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (repositoryId) fetchTasks();
  }, [repositoryId]);

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    setDeletingTask(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/tasks/${taskToDelete._id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setTaskToDelete(null);
        fetchTasks();
      }
    } catch (err) {
      console.error('Failed to delete task', err);
    } finally {
      setDeletingTask(false);
    }
  };

  if (selectedTask) {
    return <TaskDetail task={selectedTask} onBack={() => { setSelectedTask(null); fetchTasks(); }} />;
  }

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ repositoryId, title, description })
      });
      if (response.ok) {
        setShowCreate(false);
        setTitle('');
        setDescription('');
        fetchTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <SectionHeader 
        title="Engineering Tasks" 
        icon={<Zap className="w-5 h-5 text-primary" />}
        action={
          !showCreate && (
            <button 
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-text-primary rounded-sm hover:bg-opacity-90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Task
            </button>
          )
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {showCreate && (
          <div className="p-4 bg-background border border-border rounded-md shadow-modal mb-6">
            <h3 className="text-text-primary font-heading font-medium mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              Create New Task
            </h3>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Task Title</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-surface border border-border rounded-sm px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
                  placeholder="e.g. Implement authentication flow"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Description / Requirements</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-surface border border-border rounded-sm px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none h-24 resize-none"
                  placeholder="Describe the engineering task..."
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button 
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-sm bg-primary text-text-primary rounded-sm hover:bg-opacity-90 transition-colors"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex justify-center text-text-secondary">
            <Zap className="w-6 h-6 animate-pulse" />
          </div>
        ) : !tasks || tasks.length === 0 ? (
          <EmptyState 
            icon={<Zap className="w-8 h-8" />}
            title="No Tasks Yet"
            description="Create your first engineering task to get started."
          />
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div 
                key={task._id} 
                onClick={() => setSelectedTask(task)}
                className="p-4 bg-background border border-border rounded-md hover:border-primary cursor-pointer transition-colors group flex flex-col gap-3"
              >
                <div className="flex justify-between items-start">
                  <h4 className="text-text-primary font-medium group-hover:text-primary transition-colors">
                    {task.title}
                  </h4>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={task.status} />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTaskToDelete(task);
                      }}
                      title="Delete Task"
                      className="p-1 text-text-secondary hover:text-red-400 hover:bg-surface rounded transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-text-secondary line-clamp-2">
                  {task.description}
                </p>
                <div className="flex items-center justify-between mt-1 text-xs text-text-secondary font-mono">
                  <span>{new Date(task.createdAt || Date.now()).toLocaleDateString()}</span>
                  <span className={`px-1.5 py-0.5 rounded-sm ${task.priority === 'HIGH' ? 'bg-red-500/10 text-red-400' : 'bg-surface border border-border'}`}>
                    {task.priority || 'NORMAL'} priority
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {taskToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-modal border border-border rounded-lg max-w-md w-full p-6 shadow-modal space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-heading font-semibold text-lg text-text-primary">Delete Task</h3>
            </div>

            <p className="text-sm text-text-secondary">
              Are you sure you want to delete <strong className="text-text-primary">"{taskToDelete.title}"</strong>?
            </p>
            <p className="text-xs text-text-secondary bg-surface border border-border p-3 rounded">
              This will permanently remove the task context, implementation plan, execution records, logs, and audit trails.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setTaskToDelete(null)}
                disabled={deletingTask}
                className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTask}
                disabled={deletingTask}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-sm text-xs font-semibold transition-colors"
              >
                {deletingTask && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
