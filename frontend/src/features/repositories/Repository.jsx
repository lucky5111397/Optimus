import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GitFork, Star, FileText, ArrowRight, RefreshCw, Plus, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { StatusBadge, EmptyState, SectionHeader } from '../../components/ui';
import ImportModal from './ImportModal';

export default function Repository() {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [repoToDelete, setRepoToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [retryingRepoId, setRetryingRepoId] = useState(null);

  const fetchRepos = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/repositories`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setRepos(data);
      }
    } catch (err) {
      console.error('Failed to fetch repositories', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepos();
  }, []);

  const handleImported = () => {
    fetchRepos();
  };

  const handleRetryImport = async (repo) => {
    const repoId = repo._id || repo.id;
    setRetryingRepoId(repoId);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/repositories/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          owner: repo.owner,
          name: repo.name,
          branch: repo.defaultBranch || 'main'
        })
      });
      if (res.ok) {
        fetchRepos();
      }
    } catch (err) {
      console.error('Failed to retry import', err);
    } finally {
      setRetryingRepoId(null);
    }
  };

  const handleDeleteRepo = async () => {
    if (!repoToDelete) return;
    setDeleting(true);
    try {
      const id = repoToDelete._id || repoToDelete.id;
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/repositories/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setRepoToDelete(null);
        fetchRepos();
      }
    } catch (err) {
      console.error('Failed to delete repository', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-background p-6">
      <SectionHeader 
        title="Repositories" 
        actions={
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-text-primary rounded-sm hover:bg-primary/90 text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Import Repository
          </button>
        }
      />

      {loading ? (
        <div className="py-12 flex justify-center text-text-secondary">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
      ) : repos.length === 0 ? (
        <EmptyState 
          icon={GitFork}
          title="No repositories found"
          description="Import a repository to start analyzing code and generating tasks."
          action={
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="mt-4 px-4 py-2 bg-surface border border-border text-text-primary rounded-sm hover:bg-surface/80 text-sm font-medium transition-colors"
            >
              Import Repository
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {repos.map(repo => {
            const repoId = repo._id || repo.id;
            const updatedDate = repo.updatedAt || repo.lastUpdated;
            return (
              <div key={repoId} className="bg-surface border border-border rounded-md p-5 flex flex-col h-full shadow-modal">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0 pr-3">
                    <h3 className="text-text-primary font-heading font-semibold text-lg truncate">
                      {repo.owner}/{repo.name}
                    </h3>
                    <p className="text-text-secondary text-sm line-clamp-2 mt-1 min-h-[40px]">
                      {repo.description || 'No description provided.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={repo.status} />
                    <button
                      onClick={() => setRepoToDelete(repo)}
                      title="Delete Repository"
                      className="p-1.5 text-text-secondary hover:text-red-400 hover:bg-modal rounded transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-text-secondary text-xs mt-auto mb-4 font-mono">
                  {repo.language && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      {repo.language}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Star size={14} /> {repo.stars || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText size={14} /> {repo.fileCount || 0} files
                  </span>
                </div>

                <div className="pt-4 border-t border-border flex justify-between items-center mt-auto">
                  <span className="text-text-secondary text-xs font-mono">
                    Updated {updatedDate ? new Date(updatedDate).toLocaleDateString() : 'recently'}
                  </span>
                  
                  {repo.status === 'READY' && (
                    <Link 
                      to={`/repositories/${repoId}`}
                      className="flex items-center gap-1 text-primary text-sm hover:underline font-medium"
                    >
                      View <ArrowRight size={14} />
                    </Link>
                  )}
                {repo.status === 'IMPORTING' && (
                  <span className="flex items-center gap-2 text-text-secondary text-sm">
                    <RefreshCw size={14} className="animate-spin" /> Importing...
                  </span>
                )}
                {repo.status === 'FAILED' && (
                  <button
                    onClick={() => handleRetryImport(repo)}
                    disabled={retryingRepoId === repoId}
                    className="flex items-center gap-1 text-red-400 text-sm hover:underline font-medium disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={retryingRepoId === repoId ? 'animate-spin' : ''} />
                    {retryingRepoId === repoId ? 'Retrying...' : 'Retry'}
                  </button>
                )}
              </div>
            </div>
          );
          })}
        </div>
      )}

      {isImportModalOpen && (
        <ImportModal 
          onClose={() => setIsImportModalOpen(false)}
          onImported={handleImported}
        />
      )}

      {repoToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-modal border border-border rounded-lg max-w-md w-full p-6 shadow-modal space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-heading font-semibold text-lg text-text-primary">Delete Repository</h3>
            </div>

            <p className="text-sm text-text-secondary">
              Are you sure you want to delete <strong className="text-text-primary">{repoToDelete.owner}/{repoToDelete.name}</strong>?
            </p>
            <p className="text-xs text-text-secondary bg-surface border border-border p-3 rounded">
              This action will permanently delete all associated engineering tasks, generated plans, execution logs, and indexed repository workspace files on disk.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setRepoToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRepo}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-sm text-xs font-semibold transition-colors"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete Repository
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
