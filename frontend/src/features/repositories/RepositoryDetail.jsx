import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, GitFork, Layout, FileCode2, BookOpen, CheckSquare, Search, Box, Layers, RefreshCw, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '../../components/ui';
import CodebaseExplorer from './CodebaseExplorer';
import TaskPanel from '../tasks/TaskPanel';

export default function RepositoryDetail() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const [repoData, setRepoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isReindexing, setIsReindexing] = useState(false);
  const [reindexMessage, setReindexMessage] = useState(null);
  const [readmeContent, setReadmeContent] = useState(null);
  const [symbolFilter, setSymbolFilter] = useState('');

  const fetchRepo = () => {
    return fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/repositories/${id}`, {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => setRepoData(data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchRepo().finally(() => setLoading(false));
  }, [id]);

  const repo = repoData?.repository;
  const branch = repoData?.branches && repoData.branches[0];
  const fileTree = branch?.fileIndex?.fileTree || branch?.fileIndex?.files || [];
  const symbols = branch?.fileIndex?.symbols || [];
  const dependencies = branch?.fileIndex?.dependencies || [];
  const fileCount = branch?.fileIndex?.fileCount !== undefined ? branch.fileIndex.fileCount : fileTree.length;
  const symbolCount = branch?.fileIndex?.symbolCount !== undefined ? branch.fileIndex.symbolCount : symbols.length;

  // Fetch README if available
  useEffect(() => {
    if (repo?._id) {
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/repositories/${repo._id}/file?path=README.md`, {
        credentials: 'include'
      })
        .then(res => res.json())
        .then(data => {
          if (data.content) {
            setReadmeContent(data.content);
          } else {
            setReadmeContent(null);
          }
        })
        .catch(() => setReadmeContent(null));
    }
  }, [repo?._id]);

  const handleReindex = async () => {
    setIsReindexing(true);
    setReindexMessage(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/repositories/${id}/index`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        await fetchRepo();
        setReindexMessage('Indexing complete!');
        setTimeout(() => setReindexMessage(null), 3000);
      } else {
        const err = await res.json().catch(() => ({}));
        setReindexMessage(err.error || 'Re-index failed');
      }
    } catch (e) {
      setReindexMessage('Network error');
    } finally {
      setIsReindexing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] bg-background items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!repoData || !repoData.repository) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] bg-background items-center justify-center text-text-secondary">
        Repository not found.
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Layout },
    { id: 'explorer', label: 'Explorer', icon: FileCode2 },
    { id: 'context', label: 'Context', icon: BookOpen },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  ];

  const filteredSymbols = symbols.filter(s =>
    (s.name || '').toLowerCase().includes(symbolFilter.toLowerCase()) ||
    (s.file || '').toLowerCase().includes(symbolFilter.toLowerCase()) ||
    (s.type || '').toLowerCase().includes(symbolFilter.toLowerCase())
  );

  return (
    <div className="flex flex-col md:flex-row h-auto md:h-[calc(100vh-3.5rem)] bg-background text-text-primary">
      {/* Sidebar */}
      <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-surface flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <Link to="/repositories" className="flex items-center gap-2 text-text-secondary hover:text-text-primary mb-4 text-sm transition-colors">
            <ArrowLeft size={16} /> Back to Repos
          </Link>
          <div className="flex items-center gap-2 mb-2">
            <GitFork size={18} className="text-primary shrink-0" />
            <h2 className="font-heading font-semibold text-base truncate">{repo.name}</h2>
          </div>
          <p className="text-text-secondary text-xs truncate mb-3">{repo.owner}</p>
          <StatusBadge status={repo.status} />
          
          <div className="mt-4 pt-4 border-t border-border flex flex-col gap-2 text-xs font-mono text-text-secondary">
            <div className="flex justify-between">
              <span>Files</span>
              <span className="text-text-primary">{fileCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Symbols</span>
              <span className="text-text-primary">{symbolCount}</span>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-modal border border-border text-primary font-medium' 
                    : 'text-text-secondary hover:bg-modal/50 hover:text-text-primary border border-transparent'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-surface/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-10">
          <h1 className="font-heading font-medium text-lg">
            {tabs.find(t => t.id === activeTab)?.label}
          </h1>

          <div className="flex items-center gap-3">
            {reindexMessage && (
              <span className="text-xs font-mono text-text-secondary flex items-center gap-1">
                <CheckCircle2 size={13} className="text-green-400" />
                {reindexMessage}
              </span>
            )}
            <button
              onClick={handleReindex}
              disabled={isReindexing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-sm border border-border bg-modal hover:bg-modal/80 text-text-primary transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={isReindexing ? 'animate-spin text-primary' : ''} />
              {isReindexing ? 'Indexing...' : 'Re-index'}
            </button>
          </div>
        </header>
        
        <main className="flex-1 overflow-auto relative">
          {activeTab === 'overview' && (
            <div className="p-6 max-w-5xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-surface border border-border p-5 rounded-md shadow-modal">
                  <div className="flex items-center gap-3 text-text-secondary mb-2">
                    <FileCode2 size={18} /> <h3 className="font-medium text-sm text-text-primary">Files Analysed</h3>
                  </div>
                  <p className="text-3xl font-heading font-semibold text-primary">{fileCount}</p>
                </div>
                <div className="bg-surface border border-border p-5 rounded-md shadow-modal">
                  <div className="flex items-center gap-3 text-text-secondary mb-2">
                    <Search size={18} /> <h3 className="font-medium text-sm text-text-primary">Symbols Extracted</h3>
                  </div>
                  <p className="text-3xl font-heading font-semibold text-primary">{symbolCount}</p>
                </div>
                <div className="bg-surface border border-border p-5 rounded-md shadow-modal">
                  <div className="flex items-center gap-3 text-text-secondary mb-2">
                    <Layers size={18} /> <h3 className="font-medium text-sm text-text-primary">Dependencies</h3>
                  </div>
                  <p className="text-3xl font-heading font-semibold text-primary">{dependencies.length}</p>
                </div>
              </div>
              
              <div className="bg-surface border border-border rounded-md overflow-hidden shadow-modal">
                <div className="bg-modal px-4 py-3 border-b border-border flex items-center gap-2">
                  <Box size={16} className="text-text-secondary" />
                  <span className="font-mono text-sm text-text-primary">README.md</span>
                </div>
                <div className="p-6 prose prose-invert max-w-none text-text-secondary font-mono text-sm leading-relaxed">
                  {readmeContent ? (
                    <pre className="whitespace-pre-wrap bg-background p-4 rounded-sm border border-border font-mono text-xs text-text-primary overflow-auto max-h-96">
                      {readmeContent}
                    </pre>
                  ) : (
                    <div>
                      <h2 className="text-text-primary text-xl font-heading font-bold mb-3">{repo.name}</h2>
                      <p className="mb-4">{repo.description || "No description or README.md found in this repository."}</p>
                      <pre className="bg-background border border-border p-3 rounded-sm font-mono text-xs text-text-secondary">
                        <code>git clone https://github.com/{repo.owner}/{repo.name}.git</code>
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'explorer' && <CodebaseExplorer fileTree={fileTree} repositoryId={repo._id} />}

          {activeTab === 'context' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="relative w-72">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="text"
                    placeholder="Filter symbols by name, file..."
                    value={symbolFilter}
                    onChange={(e) => setSymbolFilter(e.target.value)}
                    className="w-full bg-surface border border-border rounded-sm py-1.5 pl-8 pr-3 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary font-mono"
                  />
                </div>
                <span className="text-xs font-mono text-text-secondary">
                  Showing {filteredSymbols.length} of {symbols.length} symbols
                </span>
              </div>

              <div className="bg-surface border border-border rounded-md shadow-modal overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-modal border-b border-border">
                      <th className="py-3 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider">Type</th>
                      <th className="py-3 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider">Name</th>
                      <th className="py-3 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider">File</th>
                      <th className="py-3 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider text-right">Line</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredSymbols.length > 0 ? filteredSymbols.map((symbol, idx) => (
                      <tr key={idx} className="hover:bg-modal/30 transition-colors">
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-0.5 border rounded-sm text-xs font-mono ${
                            symbol.type === 'class'
                              ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                              : 'bg-primary/10 border-primary/30 text-primary'
                          }`}>
                            {symbol.type || 'function'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-sm text-text-primary">{symbol.name}</td>
                        <td className="py-3 px-4 font-mono text-xs text-text-secondary">{symbol.file}</td>
                        <td className="py-3 px-4 font-mono text-xs text-text-secondary text-right">{symbol.line || 1}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="4" className="py-8 text-center text-text-secondary text-sm">
                          {symbolFilter ? `No symbols matching "${symbolFilter}"` : 'No symbols found'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'tasks' && <TaskPanel repositoryId={repo._id} />}
        </main>
      </div>
    </div>
  );
}
