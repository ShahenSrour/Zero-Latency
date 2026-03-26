'use client';

import { useState } from 'react';
import AuthProvider, { useAuth } from '@/components/AuthProvider';
import LoginPage from '@/components/LoginPage';
import CursorCanvas from '@/components/CursorCanvas';
import NotesManager from '@/components/NotesManager';

function userColor(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 75%, 65%)`;
}

function WorkspaceContent() {
  const { user, loading, signOut } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-dots">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  // If user wants to see login modal or they aren't logged in, handle toggle
  if (showLogin && !user) {
    return (
      <div className="workspace">
        <button className="btn-close-login" onClick={() => setShowLogin(false)}>
          &times; Back to Workspace
        </button>
        <LoginPage />
      </div>
    );
  }

  return (
    <div className="workspace">
      {/* Top Bar */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="topbar-logo">
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
              <rect x="4" y="4" width="40" height="40" rx="12" fill="url(#topbar-grad)" />
              <path d="M16 20L24 14L32 20V32L24 38L16 32V20Z" fill="white" fillOpacity="0.9" />
              <defs>
                <linearGradient id="topbar-grad" x1="4" y1="4" x2="44" y2="44">
                  <stop stopColor="#667eea" />
                  <stop offset="1" stopColor="#764ba2" />
                </linearGradient>
              </defs>
            </svg>
            <span className="topbar-title">Zero-Latency</span>
          </div>
          <div className="topbar-divider" />
          <div className="topbar-room">
            <span className="topbar-room-dot" />
            Brainstorm Room
          </div>
        </div>

        <div className="topbar-right">
          {user ? (
            <>
              <div className="topbar-user">
                <span
                  className="topbar-avatar"
                  style={{ background: userColor(user.id) }}
                >
                  {user.email?.charAt(0).toUpperCase() || '?'}
                </span>
                <span>{user.email?.split('@')[0]}</span>
              </div>
              <button className="btn-signout" onClick={signOut}>
                Sign Out
              </button>
            </>
          ) : (
            <button className="btn-primary" style={{ padding: '8px 20px', fontSize: '12px' }} onClick={() => setShowLogin(true)}>
              Login / Sign Up
            </button>
          )}
        </div>
      </header>

      {/* Canvas with cursors and notes */}
      <CursorCanvas>
        <NotesManager />
      </CursorCanvas>
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <WorkspaceContent />
    </AuthProvider>
  );
}
