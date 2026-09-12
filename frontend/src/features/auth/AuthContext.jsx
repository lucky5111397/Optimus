import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/me`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Failed to fetch user', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/github`;
  };

  const loginWithGoogle = async (idToken) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ idToken })
      });
      
      if (response.ok) {
        const data = await response.json();
        await fetchUser();
        return { success: true, isNew: data.isNew };
      }
      const errData = await response.json().catch(() => ({}));
      return { 
        success: false, 
        error: response.status === 401 
          ? 'Authentication rejected by server' 
          : (errData.error || `Server error (${response.status})`)
      };
    } catch (err) {
      console.error('Failed to login with Google via backend', err);
      const isNetwork = err.name === 'TypeError' || (err.message && err.message.toLowerCase().includes('fetch'));
      return { 
        success: false, 
        error: isNetwork 
          ? 'Backend server unreachable. Please verify that the backend is running.' 
          : (err.message || 'Network error during Google login')
      };
    }
  };

  const logout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
    } catch (err) {
      console.error('Failed to logout', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, logout, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

