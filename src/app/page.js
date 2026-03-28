'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
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

function OnlineCounterWrapper() {
  const { user } = useAuth();
  const [onlineCount, setOnlineCount] = useState(1);
  const [guestId] = useState(() => crypto.randomUUID());
  const myId = user?.id || guestId;

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel('roomPresence', {
      config: { presence: { key: myId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => { channel.unsubscribe(); };
  }, [myId]);

  return (
    <div className="online-indicator">
      <span className="online-dot" />
      {onlineCount} online
    </div>
  );
}

function WorkspaceContent() {
  const { user, loading, signOut } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  // Center the scroll on mount or when notes are first loaded
  useEffect(() => {
    // Only run this if we are not loading and not showing the login page
    if (!loading && (!showLogin || user)) {
      const container = document.querySelector('.workspace-canvas-container');
      if (!container) return;

      const performScroll = (targetX, targetY) => {
        container.scrollLeft = targetX - container.clientWidth / 2;
        container.scrollTop = targetY - container.clientHeight / 2;
      };

      // Try to find the first note to spawn at
      const fetchFirstNote = async () => {
        const { data } = await supabase
          .from('notes')
          .select('x, y')
          .order('created_at', { ascending: true })
          .limit(1);

        if (data && data.length > 0) {
          // Spawn at the first note (offset by half note size)
          performScroll(data[0].x + 130, data[0].y + 80);
        } else {
          // Fallback to center of board
          performScroll(1500, 1500);
        }
      };

      fetchFirstNote();
    }
  }, [loading, showLogin, user]);

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
      <header className="topbar">
        <div className="topbar-left">
          <div className="topbar-logo">
              <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
                <rect x="4" y="4" width="40" height="40" rx="12" fill="url(#topbar-grad)" />
                <path d="M18 16L28 12L34 22L24 26L18 16Z" fill="white" fillOpacity="0.8" />
                <path d="M14 26L24 22L30 32L20 36L14 26Z" fill="white" fillOpacity="0.95" />
                <defs>
                  <linearGradient id="topbar-grad" x1="4" y1="4" x2="44" y2="44">
                    <stop stopColor="#4F46E5" />
                    <stop offset="1" stopColor="#EC4899" />
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

      {/* Scrollable Container for the expanded workspace */}
      <div className="workspace-canvas-container">
        <CursorCanvas>
          <NotesManager />
        </CursorCanvas>
      </div>

      {/* FIXED Overlay UI (Not part of scrollable canvas) */}
      <OnlineCounterWrapper />
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
