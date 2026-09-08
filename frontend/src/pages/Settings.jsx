import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings as SettingsIcon, Code, Cpu, Plus, Trash2, Loader2, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';

export default function Settings() {
  const { user, fetchUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [envVars, setEnvVars] = useState([{ key: '', value: '' }]);
  const [envLoading, setEnvLoading] = useState(false);
  const [envSuccess, setEnvSuccess] = useState(false);
  const [envError, setEnvError] = useState(null);

  // AI Preferences state
  const [defaultModel, setDefaultModel] = useState('openrouter/free');
  const [maxTurns, setMaxTurns] = useState(25);
  const [autonomyLevel, setAutonomyLevel] = useState('supervised');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuccess, setAiSuccess] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Profile state
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('Software Engineer');
  const [primaryLanguage, setPrimaryLanguage] = useState('JavaScript / TypeScript');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Danger Zone / Account deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setUsername(user.username || '');
      if (user.role) setRole(user.role);
      if (user.primaryLanguage) setPrimaryLanguage(user.primaryLanguage);
    }
  }, [user]);

  // Load user settings on mount
  useEffect(() => {
    let isMounted = true;
    const loadSettings = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/settings`, {
          credentials: 'include'
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;
        if (data.envVars && data.envVars.length > 0) {
          setEnvVars(data.envVars);
        }
        if (data.aiPreferences) {
          if (data.aiPreferences.defaultModel) setDefaultModel(data.aiPreferences.defaultModel);
          if (data.aiPreferences.maxTurns) setMaxTurns(data.aiPreferences.maxTurns);
          if (data.aiPreferences.autonomyLevel) setAutonomyLevel(data.aiPreferences.autonomyLevel);
        }
      } catch (err) {
        console.warn('Failed to load user settings:', err.message);
      }
    };

    loadSettings();
    return () => { isMounted = false; };
  }, []);

  const addEnvVar = () => setEnvVars([...envVars, { key: '', value: '' }]);
  const removeEnvVar = (index) => {
    const updated = envVars.filter((_, i) => i !== index);
    setEnvVars(updated.length > 0 ? updated : [{ key: '', value: '' }]);
  };
  const updateEnvVar = (index, field, val) => {
    const newVars = [...envVars];
    newVars[index][field] = val;
    setEnvVars(newVars);
  };

  const saveEnvironment = async () => {
    setEnvLoading(true);
    setEnvError(null);
    setEnvSuccess(false);
    try {
      // Basic check for empty keys
      for (const item of envVars) {
        if (!item.key.trim() && item.value.trim()) {
          throw new Error('Environment variable key cannot be empty');
        }
      }
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/settings/environment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ envVars })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update environment variables');
      }
      if (data.envVars) {
        setEnvVars(data.envVars.length > 0 ? data.envVars : [{ key: '', value: '' }]);
      }
      setEnvSuccess(true);
      setTimeout(() => setEnvSuccess(false), 3000);
    } catch (err) {
      setEnvError(err.message);
    } finally {
      setEnvLoading(false);
    }
  };

  const saveAiPreferences = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiSuccess(false);
    try {
      const turns = parseInt(maxTurns, 10);
      if (isNaN(turns) || turns < 1 || turns > 100) {
        throw new Error('Max turns must be an integer between 1 and 100');
      }
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/settings/ai`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          defaultModel,
          maxTurns: turns,
          autonomyLevel
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update AI preferences');
      }
      setAiSuccess(true);
      setTimeout(() => setAiSuccess(false), 3000);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const saveProfile = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, username, role, primaryLanguage })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update profile');
      }
      await fetchUser(); // refresh user context
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmInput.trim() !== user?.username) {
      setDeleteError('Confirmation username does not match');
      return;
    }
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/account`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirmUsername: deleteConfirmInput.trim() })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete account');
      }
      if (logout) {
        await logout();
      }
      window.location.href = '/login';
    } catch (err) {
      setDeleteError(err.message);
      setDeleteLoading(false);
    }
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const [disconnecting, setDisconnecting] = useState(false);
  const [githubMsg, setGithubMsg] = useState(null);
  const [githubErr, setGithubErr] = useState(null);

  useEffect(() => {
    const githubParam = searchParams.get('github');
    const errParam = searchParams.get('error');

    if (githubParam === 'connected') {
      setGithubMsg('GitHub account connected successfully! You can now import repositories and deliver pull requests.');
      fetchUser();
      searchParams.delete('github');
      setSearchParams(searchParams, { replace: true });
    } else if (errParam === 'github_already_linked') {
      setGithubErr('This GitHub account is already linked to another Optimus account.');
      searchParams.delete('error');
      setSearchParams(searchParams, { replace: true });
    } else if (errParam === 'oauth_cancelled') {
      setGithubErr('GitHub account linking was cancelled.');
      searchParams.delete('error');
      setSearchParams(searchParams, { replace: true });
    } else if (errParam === 'invalid_state') {
      setGithubErr('Security verification failed (invalid OAuth state). Please try again.');
      searchParams.delete('error');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

  const handleConnectGithub = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/github/connect`;
  };

  const handleDisconnectGithub = async () => {
    if (!confirm('Are you sure you want to disconnect your GitHub account? You will not be able to import repositories or deliver pull requests.')) return;
    setDisconnecting(true);
    setGithubErr(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/github/disconnect`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect GitHub');
      await fetchUser();
      setGithubMsg('GitHub account disconnected.');
      setTimeout(() => setGithubMsg(null), 4000);
    } catch (err) {
      setGithubErr(err.message);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="p-6 bg-surface min-h-screen text-text-primary font-sans">
      <h1 className="text-2xl font-heading font-semibold text-text-primary mb-6">Settings</h1>
      
      {githubMsg && (
        <div className="max-w-4xl mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded text-sm text-green-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{githubMsg}</span>
          </div>
          <button onClick={() => setGithubMsg(null)} className="text-green-400 hover:text-green-300">×</button>
        </div>
      )}
      {githubErr && (
        <div className="max-w-4xl mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{githubErr}</span>
          </div>
          <button onClick={() => setGithubErr(null)} className="text-red-400 hover:text-red-300">×</button>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-64 flex flex-col space-y-1 shrink-0">
          <button 
            onClick={() => setActiveTab('general')}
            className={`flex items-center px-4 py-2 rounded-sm text-sm transition-colors ${activeTab === 'general' ? 'bg-primary text-white' : 'text-text-secondary hover:bg-background hover:text-text-primary'}`}
          >
            <SettingsIcon className="w-4 h-4 mr-3" />
            Profile & Accounts
          </button>
          <button 
            onClick={() => setActiveTab('environment')}
            className={`flex items-center px-4 py-2 rounded-sm text-sm transition-colors ${activeTab === 'environment' ? 'bg-primary text-white' : 'text-text-secondary hover:bg-background hover:text-text-primary'}`}
          >
            <Code className="w-4 h-4 mr-3" />
            Environment
          </button>
          <button 
            onClick={() => setActiveTab('ai')}
            className={`flex items-center px-4 py-2 rounded-sm text-sm transition-colors ${activeTab === 'ai' ? 'bg-primary text-white' : 'text-text-secondary hover:bg-background hover:text-text-primary'}`}
          >
            <Cpu className="w-4 h-4 mr-3" />
            AI & Execution
          </button>
        </div>

        <div className="flex-1 bg-background border border-border rounded-md p-6">
          {activeTab === 'general' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h2 className="text-lg font-medium text-text-primary mb-1">Full Name</h2>
                <p className="text-sm text-text-secondary mb-3">Your display name across the platform.</p>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <h2 className="text-lg font-medium text-text-primary mb-1">Username</h2>
                <p className="text-sm text-text-secondary mb-3">Unique identifier for mentions and assignments.</p>
                <input 
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
              
              <div>
                <h2 className="text-lg font-medium text-text-primary mb-1">Role</h2>
                <p className="text-sm text-text-secondary mb-3">Your primary role on engineering teams.</p>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary appearance-none"
                >
                  <option value="Software Engineer">Software Engineer</option>
                  <option value="Engineering Manager">Engineering Manager</option>
                  <option value="CTO / Founder">CTO / Founder</option>
                  <option value="Product Manager">Product Manager</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <h2 className="text-lg font-medium text-text-primary mb-1">Primary Language</h2>
                <p className="text-sm text-text-secondary mb-3">Your preferred programming language.</p>
                <select
                  value={primaryLanguage}
                  onChange={(e) => setPrimaryLanguage(e.target.value)}
                  className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary appearance-none"
                >
                  <option value="JavaScript / TypeScript">JavaScript / TypeScript</option>
                  <option value="Python">Python</option>
                  <option value="Go">Go</option>
                  <option value="Rust">Rust</option>
                  <option value="Java / Kotlin">Java / Kotlin</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {error && <div className="text-sm text-red-400">{error}</div>}
              {success && <div className="flex items-center text-sm text-green-400"><CheckCircle2 className="w-4 h-4 mr-1" /> Profile updated successfully</div>}
              
              <button 
                onClick={saveProfile}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-primary text-white rounded-sm text-sm hover:bg-opacity-90 transition-colors disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Profile
              </button>

              {/* Connected Accounts Section */}
              <div className="pt-6 border-t border-border space-y-4">
                <div>
                  <h2 className="text-lg font-medium text-text-primary mb-1">Connected Accounts</h2>
                  <p className="text-sm text-text-secondary">
                    Manage identities required for repository access, code indexing, and opening Pull Requests.
                  </p>
                </div>

                <div className="bg-modal border border-border rounded-md p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-text-primary">
                      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3-.3 6-1.5 6-6.5a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 5 3 6.2 6 6.5a4.8 4.8 0 0 0-1 3.2v4"></path>
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary">GitHub</span>
                        {user?.githubConnected ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 font-mono">
                            Connected
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-mono">
                            Not Connected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {user?.githubConnected
                          ? `Linked to GitHub ${user?.githubUsername ? `@${user.githubUsername}` : ''}`
                          : 'Required for repository import and delivering pull requests'}
                      </p>
                    </div>
                  </div>

                  {user?.githubConnected ? (
                    <button
                      onClick={handleDisconnectGithub}
                      disabled={disconnecting}
                      className="px-3 py-1.5 bg-surface hover:bg-surface-hover text-red-400 border border-border rounded text-xs transition-colors disabled:opacity-50"
                    >
                      {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  ) : (
                    <button
                      onClick={handleConnectGithub}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white hover:bg-primary/90 rounded text-xs font-medium transition-colors"
                    >
                      Connect GitHub
                    </button>
                  )}
                </div>
              </div>

              {/* Danger Zone Section */}
              <div className="pt-6 border-t border-red-500/30 space-y-4">
                <div>
                  <h2 className="text-lg font-medium text-red-400 mb-1 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    Danger Zone
                  </h2>
                  <p className="text-sm text-text-secondary">
                    Irreversible actions that permanently delete your data and engineering history.
                  </p>
                </div>

                <div className="bg-red-500/5 border border-red-500/30 rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-sm font-medium text-text-primary">Delete Account</span>
                    <p className="text-xs text-text-secondary mt-1">
                      Permanently delete your Optimus account, all imported repositories, indexed workspaces, tasks, and audit logs.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setDeleteConfirmInput('');
                      setDeleteError(null);
                      setShowDeleteModal(true);
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-sm text-xs font-semibold shrink-0 transition-colors"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'environment' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h2 className="text-lg font-medium text-text-primary mb-1">Environment Variables</h2>
                <p className="text-sm text-text-secondary mb-4">Set environment variables accessible during task execution.</p>
                
                <div className="space-y-3">
                  {envVars.map((env, idx) => (
                    <div key={idx} className="flex space-x-3 items-center">
                      <input 
                        type="text" 
                        placeholder="KEY"
                        value={env.key}
                        onChange={(e) => updateEnvVar(idx, 'key', e.target.value)}
                        className="flex-1 font-mono bg-background border border-border rounded-sm px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
                      />
                      <span className="text-text-secondary">=</span>
                      <input 
                        type="text" 
                        placeholder="VALUE"
                        value={env.value}
                        onChange={(e) => updateEnvVar(idx, 'value', e.target.value)}
                        className="flex-1 font-mono bg-background border border-border rounded-sm px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
                      />
                      <button 
                        onClick={() => removeEnvVar(idx)}
                        className="p-2 text-text-secondary hover:text-red-500 hover:bg-modal rounded-sm transition-colors"
                        title="Remove variable"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  
                  <button 
                    onClick={addEnvVar}
                    className="flex items-center text-sm text-primary hover:underline mt-2"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Variable
                  </button>
                </div>
              </div>

              {envError && <div className="text-sm text-red-400">{envError}</div>}
              {envSuccess && (
                <div className="flex items-center text-sm text-green-400">
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Environment variables saved successfully
                </div>
              )}

              <button
                onClick={saveEnvironment}
                disabled={envLoading}
                className="flex items-center px-4 py-2 bg-primary text-white rounded-sm text-sm hover:bg-opacity-90 transition-colors disabled:opacity-50 mt-6"
              >
                {envLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Environment
              </button>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h2 className="text-lg font-medium text-text-primary mb-1">Default Model</h2>
                <p className="text-sm text-text-secondary mb-3">Select the default LLM used for engineering tasks.</p>
                <select
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary appearance-none"
                >
                  <option value="openrouter/free">OpenRouter Free (Dynamic Auto-Routing)</option>
                  <option value="openai/gpt-oss-20b:free">GPT-OSS 20B (Free Agent & Coding)</option>
                  <option value="z-ai/glm-5.2:free">GLM 5.2 (Free Planning & Reasoning)</option>
                  <option value="google/gemma-4-31b-it:free">Gemma 4 31B (Free Multi-Turn)</option>
                  <option value="minimax/minimax-m3:free">MiniMax M3 (Free Long-Context)</option>
                  <option value="nvidia/nemotron-3-ultra:free">Nemotron 3 Ultra (Free)</option>
                </select>
              </div>
              
              <div>
                <h2 className="text-lg font-medium text-text-primary mb-1">Max Execution Turns</h2>
                <p className="text-sm text-text-secondary mb-3">Maximum number of tool iterations per task before pausing for review (1-100).</p>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={maxTurns}
                  onChange={(e) => setMaxTurns(e.target.value)}
                  className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <h2 className="text-lg font-medium text-text-primary mb-3">Autonomy Level</h2>
                <div className="space-y-3">
                  <label className={`flex items-start space-x-3 p-3 border rounded-sm cursor-pointer transition-colors ${autonomyLevel === 'supervised' ? 'border-primary bg-primary/5' : 'border-border hover:border-border/80'}`}>
                    <input
                      type="radio"
                      name="autonomy"
                      checked={autonomyLevel === 'supervised'}
                      onChange={() => setAutonomyLevel('supervised')}
                      className="mt-1"
                    />
                    <div>
                      <div className="text-sm font-medium text-text-primary">Supervised (Default)</div>
                      <div className="text-xs text-text-secondary mt-1">Requires manual approval before running git push or complex commands.</div>
                    </div>
                  </label>
                  <label className={`flex items-start space-x-3 p-3 border rounded-sm cursor-pointer transition-colors ${autonomyLevel === 'autonomous' ? 'border-primary bg-primary/5' : 'border-border hover:border-border/80'}`}>
                    <input
                      type="radio"
                      name="autonomy"
                      checked={autonomyLevel === 'autonomous'}
                      onChange={() => setAutonomyLevel('autonomous')}
                      className="mt-1"
                    />
                    <div>
                      <div className="text-sm font-medium text-text-primary">Autonomous</div>
                      <div className="text-xs text-text-secondary mt-1">Full autonomy to execute tasks end-to-end without supervision.</div>
                    </div>
                  </label>
                </div>
              </div>

              {aiError && <div className="text-sm text-red-400">{aiError}</div>}
              {aiSuccess && (
                <div className="flex items-center text-sm text-green-400">
                  <CheckCircle2 className="w-4 h-4 mr-1" /> AI preferences saved successfully
                </div>
              )}
              
              <button
                onClick={saveAiPreferences}
                disabled={aiLoading}
                className="flex items-center px-4 py-2 bg-primary text-white rounded-sm text-sm hover:bg-opacity-90 transition-colors disabled:opacity-50"
              >
                {aiLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Preferences
              </button>
            </div>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-modal border border-red-500/40 rounded-lg max-w-md w-full p-6 shadow-modal space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-heading font-semibold text-lg text-text-primary">Delete Account</h3>
            </div>

            <p className="text-sm text-text-secondary">
              This action <strong className="text-red-400">cannot</strong> be undone. All repositories, workspaces on disk, engineering tasks, and plan reviews associated with this account will be immediately and permanently deleted.
            </p>

            <div className="space-y-2">
              <label className="block text-xs text-text-secondary">
                To confirm, please type your username <code className="bg-background px-1.5 py-0.5 rounded text-text-primary font-mono font-bold">{user?.username}</code>:
              </label>
              <input
                type="text"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder={user?.username || ''}
                className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-red-500"
              />
            </div>

            {deleteError && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
                className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading || deleteConfirmInput.trim() !== user?.username}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-sm text-xs font-semibold transition-colors"
              >
                {deleteLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Permanently Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
