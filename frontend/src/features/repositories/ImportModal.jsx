import React, { useState, useEffect } from 'react';
import { Search, X, GitFork, Check, AlertCircle, RefreshCw } from 'lucide-react';

export default function ImportModal({ onClose, onImported }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState(null);
  const [branchError, setBranchError] = useState(null);
  
  const [githubRepos, setGithubRepos] = useState([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [branches, setBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);

  useEffect(() => {
    setError(null);
    setLoadingRepos(true);
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/repositories/github`, {
      credentials: 'include'
    })
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || 'Failed to fetch repositories from GitHub.');
          setGithubRepos([]);
        } else {
          setGithubRepos(Array.isArray(data) ? data : []);
        }
      })
      .catch(err => {
        console.error(err);
        setError('Network error while connecting to server.');
      })
      .finally(() => setLoadingRepos(false));
  }, []);

  useEffect(() => {
    if (selectedRepo) {
      setLoadingBranches(true);
      setBranchError(null);
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/repositories/github/branches?owner=${selectedRepo.owner.login}&name=${selectedRepo.name}`, {
        credentials: 'include'
      })
        .then(async res => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setBranchError(data.error || 'Failed to fetch branches.');
            setBranches([]);
          } else {
            const branchList = Array.isArray(data) ? data : [];
            setBranches(branchList);
            if (branchList.length > 0) {
              setSelectedBranch(branchList[0].name);
            }
          }
        })
        .catch(err => {
          console.error(err);
          setBranchError('Failed to load branches.');
        })
        .finally(() => setLoadingBranches(false));
    } else {
      setBranches([]);
      setSelectedBranch('');
      setBranchError(null);
    }
  }, [selectedRepo]);

  const filteredRepos = githubRepos.filter(repo => 
    `${repo.owner?.login || ''}/${repo.name || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleImport = async () => {
    if (!selectedRepo || !selectedBranch) return;
    setIsImporting(true);
    setError(null);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/repositories/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          owner: selectedRepo.owner.login,
          name: selectedRepo.name,
          branch: selectedBranch
        })
      });
      if (response.ok) {
        onImported();
        onClose();
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || 'Failed to import repository.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error while requesting import.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-md shadow-modal w-full max-w-2xl flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-lg font-heading font-medium text-text-primary flex items-center gap-2">
            <GitFork size={20} />
            Import Repository
          </h2>
          <button 
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-sm text-yellow-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-yellow-400" />
              <span>{error}</span>
            </div>
            {error.includes('GitHub account not connected') ? (
              <a
                href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/github/connect`}
                className="px-2.5 py-1 bg-primary text-white rounded text-xs font-medium hover:bg-primary/90 transition-colors shrink-0 ml-2"
              >
                Connect GitHub
              </a>
            ) : (
              <button onClick={() => setError(null)} className="text-yellow-400 hover:text-yellow-300 ml-2">
                <X size={14} />
              </button>
            )}
          </div>
        )}

        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input 
              type="text" 
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background border border-border rounded-sm py-2 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary transition-colors font-mono"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[300px]">
          {loadingRepos ? (
            <div className="h-full flex flex-col items-center justify-center text-text-secondary text-sm gap-2 py-16">
              <RefreshCw size={22} className="animate-spin text-primary" />
              <span>Loading repositories from GitHub...</span>
            </div>
          ) : filteredRepos.length > 0 ? (
            filteredRepos.map(repo => (
              <div 
                key={repo.id}
                onClick={() => setSelectedRepo(repo)}
                className={`flex items-center justify-between p-3 border rounded-sm cursor-pointer transition-colors ${
                  selectedRepo?.id === repo.id 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-border-active hover:bg-modal'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-medium text-text-primary text-sm">
                      {repo.owner?.login}/{repo.name}
                    </span>
                    {repo.private && (
                      <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-modal border border-border rounded-sm text-text-secondary">
                        Private
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary mt-1">{repo.description}</p>
                </div>
                {selectedRepo?.id === repo.id && (
                  <Check size={18} className="text-primary" />
                )}
              </div>
            ))
          ) : (
            <div className="h-full flex items-center justify-center text-text-secondary text-sm py-16">
              {searchQuery ? `No repositories found matching "${searchQuery}"` : 'No repositories found.'}
            </div>
          )}
        </div>

        {selectedRepo && (
          <div className="p-4 border-t border-border bg-modal">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-text-primary">
                Select Branch
              </label>
              {loadingBranches && (
                <span className="text-xs text-text-secondary flex items-center gap-1">
                  <RefreshCw size={12} className="animate-spin" /> Loading branches...
                </span>
              )}
            </div>
            {branchError ? (
              <p className="text-xs text-red-400 mb-2">{branchError}</p>
            ) : null}
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              disabled={loadingBranches}
              className="w-full bg-background border border-border rounded-sm py-2 px-3 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors font-mono mb-4 disabled:opacity-50"
            >
              <option value="">-- Choose a branch --</option>
              {(branches || []).map(branch => (
                <option key={branch.name} value={branch.name}>{branch.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="p-4 border-t border-border flex justify-end gap-3 bg-surface rounded-b-md">
          <button
            onClick={onClose}
            disabled={isImporting}
            className="px-4 py-2 border border-border text-text-primary rounded-sm hover:bg-modal text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!selectedRepo || !selectedBranch || isImporting || loadingBranches}
            className="px-4 py-2 bg-primary text-text-primary rounded-sm hover:bg-primary/90 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isImporting ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Importing...
              </>
            ) : (
              'Import Repository'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
