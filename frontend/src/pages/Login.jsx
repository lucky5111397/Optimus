import React, { useState } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { Navigate } from 'react-router-dom';
import { auth, googleProvider, signInWithPopup } from '../lib/firebase';

export default function Login() {
  const { user, loading, login, loginWithGoogle } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      setErrorMsg('');
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      const res = await loginWithGoogle(idToken);
      if (!res || !res.success) {
        setErrorMsg('Failed to complete Google login');
        setErrorMsg(res?.error || 'Failed to complete Google login');
      } else if (res.isNew) {
        setIsNewUser(true);
      }
    } catch (error) {
      console.error('Firebase sign in error:', error);
      setErrorMsg(error.message || 'Popup closed or failed');
      if (error.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Sign-in popup was closed before completing');
      } else if (error.code === 'auth/cancelled-popup-request') {
        setErrorMsg('Sign-in request cancelled');
      } else if (error.code === 'auth/network-request-failed') {
        setErrorMsg('Firebase network error. Please check your internet connection.');
      } else {
        setErrorMsg(error.message || 'Firebase authentication failure');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <img src="/optimus-logo.png" alt="OPTIMUS" className="w-10 h-10 object-contain animate-pulse" />
        <div className="text-text-secondary text-sm">Loading OPTIMUS...</div>
      </div>
    );
  }

  if (user) {
    if (isNewUser) {
      return <Navigate to="/setup" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full p-8 bg-surface rounded-md border border-border shadow-modal text-center">
        <div className="flex justify-center mb-4">
          <img src="/optimus-logo.png" alt="" className="w-14 h-14 object-contain" />
        </div>
        <h1 className="font-heading text-3xl font-semibold text-text-primary mb-2">
          OPTIMUS
        </h1>
        <p className="text-text-secondary mb-8">
          Autonomous Software Engineer
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">
            {errorMsg}
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={login}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-primary hover:bg-opacity-90 text-white rounded-sm font-medium transition-colors"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3-.3 6-1.5 6-6.5a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 5 3 6.2 6 6.5a4.8 4.8 0 0 0-1 3.2v4"></path>
            </svg>
            Continue with GitHub
          </button>

          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-gray-100 text-gray-900 rounded-sm font-medium transition-colors disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {googleLoading ? 'Connecting...' : 'Continue with Google'}
          </button>
        </div>
        
        <p className="mt-6 text-xs text-text-secondary">
          By connecting your account, you agree to allow OPTIMUS access to repositories you select.
        </p>
      </div>
    </div>
  );
}

