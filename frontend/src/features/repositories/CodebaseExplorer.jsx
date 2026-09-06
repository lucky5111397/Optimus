import React, { useState, useEffect } from 'react';
import { Folder, ChevronRight, ChevronDown, Code, File, RefreshCw, AlertCircle } from 'lucide-react';

export default function CodebaseExplorer({ fileTree, repositoryId }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [expandedDirs, setExpandedDirs] = useState(new Set(['src']));
  const [fileContent, setFileContent] = useState('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [contentError, setContentError] = useState(null);

  // Auto-expand the top-level directories on initial load
  useEffect(() => {
    if (fileTree && fileTree.length > 0) {
      const topDirs = fileTree
        .filter(n => n.type === 'directory')
        .map(n => n.path || n.name);
      if (topDirs.length > 0) {
        setExpandedDirs(new Set(topDirs));
      }
    }
  }, [fileTree]);

  // Fetch real file content when a file is selected
  useEffect(() => {
    if (!selectedFile) {
      setFileContent('');
      setContentError(null);
      return;
    }

    if (selectedFile.content !== undefined && selectedFile.content !== null) {
      setFileContent(selectedFile.content);
      setContentError(null);
      return;
    }

    if (!repositoryId || !selectedFile.path) {
      return;
    }

    setLoadingContent(true);
    setContentError(null);

    const targetUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/repositories/${repositoryId}/file?path=${encodeURIComponent(selectedFile.path)}`;

    fetch(targetUrl, {
      credentials: 'include'
    })
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load file content.');
        }
        setFileContent(data.content || '');
      })
      .catch(err => {
        setContentError(err.message || 'Error loading file.');
        setFileContent('');
      })
      .finally(() => {
        setLoadingContent(false);
      });
  }, [selectedFile, repositoryId]);

  const toggleDir = (path) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedDirs(newExpanded);
  };

  const renderTree = (nodes, currentPath = '', level = 0) => {
    return nodes.map((node) => {
      const fullPath = node.path || (currentPath ? `${currentPath}/${node.name}` : node.name);
      const isDir = node.type === 'directory';
      const isExpanded = expandedDirs.has(fullPath);
      const isSelected = selectedFile?.path === fullPath;

      return (
        <div key={fullPath}>
          <div 
            className={`flex items-center py-1.5 px-2 hover:bg-modal cursor-pointer transition-colors ${isSelected ? 'bg-modal border-l-2 border-primary text-primary' : 'text-text-secondary hover:text-text-primary border-l-2 border-transparent'}`}
            style={{ paddingLeft: `${level * 12 + 8}px` }}
            onClick={() => {
              if (isDir) {
                toggleDir(fullPath);
              } else {
                setSelectedFile({ ...node, path: fullPath });
              }
            }}
          >
            <div className="w-4 h-4 mr-1 flex items-center justify-center shrink-0">
              {isDir ? (
                isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
              ) : null}
            </div>
            {isDir ? (
              <Folder size={14} className="mr-2 text-primary shrink-0" />
            ) : (
              <File size={14} className="mr-2 shrink-0" />
            )}
            <span className="font-mono text-[13px] truncate">{node.name}</span>
          </div>
          {isDir && isExpanded && node.children && (
            <div>
              {renderTree(node.children, fullPath, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="flex h-full bg-background">
      {/* File Tree Panel */}
      <div className="w-72 border-r border-border bg-surface flex flex-col h-full overflow-hidden">
        <div className="p-3 border-b border-border bg-modal flex items-center justify-between">
          <h3 className="font-heading font-medium text-sm text-text-primary">Explorer</h3>
          {fileTree && fileTree.length > 0 && (
            <span className="text-[11px] font-mono text-text-secondary">
              {fileTree.length} items
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {fileTree && fileTree.length > 0 ? renderTree(fileTree) : (
            <div className="p-4 text-sm text-text-secondary text-center">No files indexed</div>
          )}
        </div>
      </div>

      {/* File Preview Panel */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {selectedFile ? (
          <>
            <div className="h-10 border-b border-border bg-modal flex items-center px-4 justify-between shrink-0">
              <div className="flex items-center gap-2 text-text-secondary font-mono text-xs overflow-hidden">
                <Code size={14} className="text-primary shrink-0" />
                <span className="truncate">{selectedFile.path}</span>
              </div>
              {selectedFile.size !== undefined && (
                <div className="text-text-secondary font-mono text-xs shrink-0 pl-4">
                  {selectedFile.size < 1024
                    ? `${selectedFile.size} B`
                    : `${Math.round(selectedFile.size / 1024)} KB`}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-auto bg-surface p-4">
              {loadingContent ? (
                <div className="flex h-full items-center justify-center text-text-secondary gap-2">
                  <RefreshCw size={18} className="animate-spin text-primary" />
                  <span className="text-sm font-mono">Loading file...</span>
                </div>
              ) : contentError ? (
                <div className="flex h-full items-center justify-center text-red-400 gap-2 p-6 text-center">
                  <AlertCircle size={18} />
                  <span className="text-sm font-mono">{contentError}</span>
                </div>
              ) : (
                <pre className="font-mono text-[13px] leading-relaxed text-text-primary">
                  <code>{fileContent}</code>
                </pre>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-secondary flex-col gap-4">
            <File size={48} className="opacity-20" />
            <p className="font-medium text-sm">Select a file to view its contents</p>
          </div>
        )}
      </div>
    </div>
  );
}
