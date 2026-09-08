import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Briefcase, Code, Loader2 } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { user, fetchUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Software Engineer');
  const [primaryLanguage, setPrimaryLanguage] = useState('JavaScript / TypeScript');
  const [error, setError] = useState('');
  
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      if (user.role) setRole(user.role);
      if (user.primaryLanguage) setPrimaryLanguage(user.primaryLanguage);
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, role, primaryLanguage })
      });
      if (res.ok) {
        await fetchUser();
        navigate('/dashboard');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to update profile');
      }
    } catch (err) {
      setError(err.message || 'Network error while updating profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src="/optimus-logo.png" alt="OPTIMUS" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="font-heading text-3xl font-bold text-text-primary mb-2">Set up your profile</h1>
          <p className="text-text-secondary text-sm">Tell us a bit about yourself to personalize your experience.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-lg p-6 shadow-modal">
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-gray-500" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Chen"
                  className="block w-full pl-10 pr-3 py-2 bg-background border border-border rounded-md text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-gray-500" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled
                  placeholder="alex.chen@example.com"
                  className="block w-full pl-10 pr-3 py-2 bg-background border border-border rounded-md text-sm text-text-primary focus:outline-none focus:border-primary transition-colors opacity-70 cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Role
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Briefcase className="h-4 w-4 text-gray-500" />
                </div>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 bg-background border border-border rounded-md text-sm text-text-primary focus:outline-none focus:border-primary transition-colors appearance-none"
                >
                  <option value="Software Engineer">Software Engineer</option>
                  <option value="Engineering Manager">Engineering Manager</option>
                  <option value="CTO / Founder">CTO / Founder</option>
                  <option value="Product Manager">Product Manager</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Primary Language
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Code className="h-4 w-4 text-gray-500" />
                </div>
                <select
                  value={primaryLanguage}
                  onChange={(e) => setPrimaryLanguage(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 bg-background border border-border rounded-md text-sm text-text-primary focus:outline-none focus:border-primary transition-colors appearance-none"
                >
                  <option value="JavaScript / TypeScript">JavaScript / TypeScript</option>
                  <option value="Python">Python</option>
                  <option value="Go">Go</option>
                  <option value="Rust">Rust</option>
                  <option value="Java / Kotlin">Java / Kotlin</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving Profile...
                </>
              ) : (
                'Complete Setup'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

