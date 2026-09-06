import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GitFork, Star, FileText, ArrowRight, RefreshCw, Plus } from 'lucide-react';
import { StatusBadge, EmptyState, SectionHeader } from '../../components/ui';
import ImportModal from './ImportModal';

export default function Repository() {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);

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
                  <StatusBadge status={repo.status} />
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
                  <button className="flex items-center gap-1 text-red-400 text-sm hover:underline font-medium">
                    <RefreshCw size={14} /> Retry
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
    </div>
  );
}
