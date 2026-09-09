import React, { useState, useEffect } from 'react';
import { Clock, Search } from 'lucide-react';
import { StatusBadge, TabBar, EmptyState } from '../components/ui';

export default function History() {
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const tabs = [
    { id: 'All', label: 'All' },
    { id: 'Completed', label: 'Completed' },
    { id: 'Failed', label: 'Failed' },
    { id: 'Cancelled', label: 'Cancelled' }
  ];

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/tasks`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => setTasks(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filteredTasks = tasks.filter(task => {
    let matchesTab = false;
    if (activeTab === 'All') {
      matchesTab = true;
    } else if (activeTab === 'Completed') {
      matchesTab = ['completed', 'verified', 'delivered', 'merged'].includes(task.status?.toLowerCase());
    } else if (activeTab === 'Cancelled') {
      matchesTab = ['cancelled', 'closed'].includes(task.status?.toLowerCase());
    } else {
      matchesTab = task.status?.toLowerCase() === activeTab.toLowerCase();
    }
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (task.repositoryId?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="p-6 space-y-6 bg-surface min-h-screen text-text-primary font-sans">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-semibold text-text-primary">Engineering History</h1>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-text-secondary" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..." 
            className="pl-9 pr-4 py-2 bg-background border border-border rounded-sm text-sm text-text-primary focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

      <div className="bg-background border border-border rounded-md overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-secondary">Loading history...</div>
        ) : filteredTasks.length > 0 ? (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-modal">
                <th className="p-4 text-sm font-medium text-text-secondary">Task</th>
                <th className="p-4 text-sm font-medium text-text-secondary">Repository</th>
                <th className="p-4 text-sm font-medium text-text-secondary">Status</th>
                <th className="p-4 text-sm font-medium text-text-secondary">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map(task => (
                <tr key={task._id} className="border-b border-border hover:bg-modal/50 transition-colors">
                  <td className="p-4 text-sm font-medium text-text-primary">{task.title}</td>
                  <td className="p-4 text-sm text-text-secondary">{task.repositoryId?.name || 'Unknown'}</td>
                  <td className="p-4">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="p-4 text-sm text-text-secondary">{new Date(task.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8">
            <EmptyState title="No tasks found" description={`No tasks match the "${activeTab}" filter.`} />
          </div>
        )}
      </div>
    </div>
  );
}
