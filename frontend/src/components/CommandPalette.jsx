import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Code, Zap, GitFork, Settings, ArrowRight, Loader2 } from 'lucide-react';

const staticPages = [
  { id: 'dash', label: 'Dashboard', detail: '', path: '/dashboard' },
  { id: 'hist', label: 'Engineering History', detail: '', path: '/history' },
  { id: 'anal', label: 'Engineering Analytics', detail: '', path: '/analytics' },
  { id: 'sett', label: 'Settings', detail: '', path: '/settings' },
];

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSearchResults(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/search?q=${encodeURIComponent(query.trim())}`, {
        credentials: 'include'
      })
        .then(res => res.json())
        .then(data => setSearchResults(data))
        .catch(() => setSearchResults(null))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  // Build categories from live search or static pages
  const categories = [];

  if (searchResults) {
    if (searchResults.repositories?.length > 0) {
      categories.push({
        label: 'Repositories',
        icon: GitFork,
        items: searchResults.repositories.map(r => ({
          id: r._id,
          label: `${r.owner}/${r.name}`,
          detail: r.status,
          path: `/repositories/${r._id}`,
        })),
      });
    }
    if (searchResults.tasks?.length > 0) {
      categories.push({
        label: 'Tasks',
        icon: Zap,
        items: searchResults.tasks.map(t => ({
          id: t._id,
          label: t.title,
          detail: t.status,
          path: t.repositoryId ? `/repositories/${t.repositoryId._id || t.repositoryId}` : '/history',
        })),
      });
    }
    if (searchResults.symbols?.length > 0) {
      categories.push({
        label: 'Symbols',
        icon: Code,
        items: searchResults.symbols.map((s, i) => ({
          id: `sym-${i}`,
          label: s.name,
          detail: s.type,
          path: '/search?q=' + encodeURIComponent(s.name),
        })),
      });
    }
  }

  // Always show matching pages
  const matchingPages = staticPages.filter(p =>
    p.label.toLowerCase().includes(query.toLowerCase())
  );
  if (matchingPages.length > 0) {
    categories.push({
      label: 'Pages',
      icon: FileText,
      items: matchingPages,
    });
  }

  const handleSelect = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-modal border border-border rounded-md shadow-modal overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-text-secondary flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tasks, repositories, symbols..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-text-secondary" />}
          <kbd className="text-[10px] bg-[#21262D] px-1.5 py-0.5 rounded text-text-secondary border border-border">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {categories.length === 0 && query.length >= 2 && !loading ? (
            <div className="px-4 py-8 text-center text-text-secondary text-sm">
              No results found for "{query}"
            </div>
          ) : categories.length === 0 && query.length < 2 ? (
            <div className="px-4 py-6 text-center text-text-secondary text-sm">
              Type to search...
            </div>
          ) : (
            categories.map(cat => {
              const CatIcon = cat.icon;
              return (
                <div key={cat.label} className="mb-2">
                  <div className="px-4 py-1.5 text-[11px] uppercase tracking-wider text-text-secondary font-medium flex items-center gap-2">
                    <CatIcon className="w-3 h-3" />
                    {cat.label}
                  </div>
                  {cat.items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.path)}
                      className="w-full flex items-center justify-between px-4 py-2 text-sm text-text-primary hover:bg-[#21262D] transition-colors"
                    >
                      <span>{item.label}</span>
                      <div className="flex items-center gap-2">
                        {item.detail && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-text-secondary border border-border">
                            {item.detail}
                          </span>
                        )}
                        <ArrowRight className="w-3 h-3 text-text-secondary" />
                      </div>
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
