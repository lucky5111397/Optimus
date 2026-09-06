import React, { useState, useEffect, useCallback } from 'react';
import { Search as SearchIcon, FileText, Box, ArrowRight, GitFork, Zap, Loader2 } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import { SectionHeader } from '../components/ui';

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const performSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/search?q=${encodeURIComponent(q.trim())}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const totalResults = results 
    ? (results.repositories?.length || 0) + (results.tasks?.length || 0) + (results.symbols?.length || 0)
    : 0;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <SectionHeader title="Global Search" />
      
      <div className="mb-8 relative">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search repositories, tasks, symbols..."
          className="w-full bg-surface border border-border rounded-md py-4 pl-12 pr-4 text-text-primary focus:outline-none focus:border-primary shadow-modal text-lg"
        />
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <div className="py-8 text-center text-sm text-red-400 border border-red-500/20 rounded-md bg-red-500/5">
          {error}
        </div>
      )}

      {!loading && !error && results && (
        <div className="space-y-8">
          <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
            {totalResults} result{totalResults !== 1 ? 's' : ''} for "{query}"
          </h3>

          {totalResults === 0 && (
            <div className="py-12 text-center border border-border bg-surface rounded-md text-text-secondary">
              No matching repositories, tasks, or symbols found.
            </div>
          )}

          {/* Repositories */}
          {results.repositories?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3 text-xs uppercase tracking-wider text-text-secondary font-medium">
                <GitFork className="w-3 h-3" /> Repositories
              </div>
              <div className="bg-surface border border-border rounded-md shadow-modal divide-y divide-border">
                {results.repositories.map(repo => (
                  <Link key={repo._id} to={`/repositories/${repo._id}`} className="p-4 hover:bg-[#161B22] transition-colors flex items-center justify-between cursor-pointer block">
                    <div>
                      <h4 className="font-mono text-sm text-text-primary">{repo.owner}/{repo.name}</h4>
                      <span className="text-xs text-text-secondary">{repo.status}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-text-secondary" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tasks */}
          {results.tasks?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3 text-xs uppercase tracking-wider text-text-secondary font-medium">
                <Zap className="w-3 h-3" /> Tasks
              </div>
              <div className="bg-surface border border-border rounded-md shadow-modal divide-y divide-border">
                {results.tasks.map(task => {
                  const repoId = task.repositoryId?._id || task.repositoryId;
                  const targetUrl = repoId ? `/repositories/${repoId}` : '/dashboard';
                  return (
                    <Link
                      key={task._id}
                      to={targetUrl}
                      className="p-4 hover:bg-[#161B22] transition-colors flex items-center justify-between cursor-pointer block"
                    >
                      <div>
                        <h4 className="text-sm text-text-primary font-medium">{task.title}</h4>
                        <span className="text-xs text-text-secondary">
                          {task.repositoryId?.name ? `${task.repositoryId.owner}/${task.repositoryId.name}` : ''} • {task.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-text-secondary border border-border">{task.status}</span>
                        <ArrowRight className="w-4 h-4 text-text-secondary" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Symbols */}
          {results.symbols?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3 text-xs uppercase tracking-wider text-text-secondary font-medium">
                <Box className="w-3 h-3" /> Symbols
              </div>
              <div className="bg-surface border border-border rounded-md shadow-modal divide-y divide-border">
                {results.symbols.map((sym, idx) => {
                  const targetUrl = sym.repoId ? `/repositories/${sym.repoId}` : null;
                  const Wrapper = targetUrl ? Link : 'div';
                  const wrapperProps = targetUrl ? { to: targetUrl } : {};
                  return (
                    <Wrapper
                      key={idx}
                      {...wrapperProps}
                      className={`p-4 hover:bg-[#161B22] transition-colors flex items-center justify-between ${targetUrl ? 'cursor-pointer block' : ''}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="mt-1 p-2 bg-[#21262D] rounded border border-border text-primary">
                          <Box className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-mono text-sm text-text-primary mb-1">{sym.name}</h4>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="text-text-secondary px-2 py-0.5 bg-background border border-border rounded-sm">
                              {sym.type}
                            </span>
                            <span className="text-text-secondary px-2 py-0.5 bg-background border border-border rounded-sm">
                              {sym.file}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-secondary">{sym.repo}</span>
                        {targetUrl && <ArrowRight className="w-4 h-4 text-text-secondary" />}
                      </div>
                    </Wrapper>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && !error && !results && query.length < 2 && (
        <div className="py-12 text-center text-text-secondary text-sm">
          Type at least 2 characters to search.
        </div>
      )}
    </div>
  );
}
