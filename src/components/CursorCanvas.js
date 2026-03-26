'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';

// Deterministic color from user ID
function userColor(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 75%, 65%)`;
}

function userInitials(email) {
  if (!email) return '?';
  return email.charAt(0).toUpperCase();
}

export default function CursorCanvas({ children }) {
  const { user } = useAuth();
  const canvasRef = useRef(null);
  const channelRef = useRef(null);
  const [cursors, setCursors] = useState({});
  const [guestId] = useState(() => crypto.randomUUID());
  const lastBroadcast = useRef(0);

  const myId = user?.id || guestId;
  const myEmail = user?.email || 'Guest';

  // Setup Presence channel
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase.channel('room:canvas', {
      config: { presence: { key: myId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const newCursors = {};
        Object.entries(state).forEach(([key, presences]) => {
          if (key !== myId && presences.length > 0) {
            const p = presences[0];
            newCursors[key] = {
              x: p.x,
              y: p.y,
              email: p.email,
              color: p.color,
            };
          }
        });
        setCursors(newCursors);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            x: 0,
            y: 0,
            email: myEmail,
            color: userColor(myId),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [myId, myEmail]);

  // Throttled mouse move handler
  const handleMouseMove = useCallback(
    (e) => {
      if (!channelRef.current) return;

      const now = Date.now();
      if (now - lastBroadcast.current < 50) return; // ~20fps throttle
      lastBroadcast.current = now;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      channelRef.current.track({
        x,
        y,
        email: myEmail,
        color: userColor(myId),
      });
    },
    [myId, myEmail]
  );

  const onlineCount = Object.keys(cursors).length + 1; // +1 for self

  return (
    <div
      ref={canvasRef}
      className="cursor-canvas"
      onMouseMove={handleMouseMove}
    >
      {/* Remote cursors */}
      {Object.entries(cursors).map(([userId, cursor]) => (
        <div
          key={userId}
          className="remote-cursor"
          style={{
            transform: `translate(${cursor.x}px, ${cursor.y}px)`,
            '--cursor-color': cursor.color,
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill={cursor.color}
            className="cursor-pointer-svg"
          >
            <path d="M5.65 3.15l13.2 9.15-6.15 1.3-3.2 5.8-3.85-16.25z" />
          </svg>
          <span className="cursor-label" style={{ background: cursor.color }}>
            {cursor.email?.split('@')[0] || 'Guest'}
          </span>
        </div>
      ))}

      {/* Online indicator */}
      <div className="online-indicator">
        <span className="online-dot" />
        {onlineCount} online
      </div>

      {children}
    </div>
  );
}
