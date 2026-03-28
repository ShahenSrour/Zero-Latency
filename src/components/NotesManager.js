'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import StickyNote from './StickyNote';

const NOTE_COLORS = [
  '#FFE066', // warm yellow
  '#63E6BE', // mint green
  '#74C0FC', // sky blue
  '#E599F7', // lavender
  '#FF8787', // coral
  '#FFA94D', // orange
  '#69DB7C', // green
  '#DA77F2', // purple
];

function randomColor() {
  return NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
}

function randomPosition() {
  // Spawn notes near the center of the 3000x3000px board with a wider spread
  // Must use Math.round to pass valid integers to the Supabase integer columns
  return {
    x: Math.round(1500 - 130 + (Math.random() * 800 - 400)),
    y: Math.round(1500 - 80 + (Math.random() * 600 - 300)),
  };
}

// Sanitize input — strip HTML tags, limit length
function sanitize(text, maxLen = 500) {
  return String(text || '').replace(/<[^>]*>/g, '').slice(0, maxLen);
}

function NoteFinder({ notes, setClosestNoteId, setFoundNoteId }) {
  const [closest, setClosest] = useState(null);
  const rafRef = useRef(null);
  const persistenceTimeoutRef = useRef(null);
  const lastTargetNoteIdRef = useRef(null);

  useEffect(() => {
    const update = () => {
      if (!notes.length) {
        setClosest(null);
        setClosestNoteId(null);
        lastTargetNoteIdRef.current = null;
      } else {
        const container = document.querySelector('.workspace-canvas-container');
        if (!container) return;

        const scrollX = container.scrollLeft;
        const scrollY = container.scrollTop;
        const viewportW = container.clientWidth;
        const viewportH = container.clientHeight;
        const centerX = scrollX + viewportW / 2;
        const centerY = scrollY + viewportH / 2;

        let minDict = Infinity;
        let nearest = null;
        let anyInView = false;

        notes.forEach(n => {
          const dx = n.x - centerX;
          const dy = n.y - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          const isOffScreen = 
            n.x + 260 < scrollX || 
            n.x > scrollX + viewportW || 
            n.y + 160 < scrollY || 
            n.y > scrollY + viewportH;

          if (!isOffScreen) anyInView = true;

          if (isOffScreen && dist < minDict) {
            minDict = dist;
            nearest = { ...n, dx, dy, dist };
          }
        });

        // Radar visibility logic
        if (anyInView) {
          setClosest(null);
          setClosestNoteId(null); // Radar turns off
          
          if (lastTargetNoteIdRef.current && !persistenceTimeoutRef.current) {
            // Target found! Trigger the visual animation
            setFoundNoteId(lastTargetNoteIdRef.current);
            persistenceTimeoutRef.current = setTimeout(() => {
              setFoundNoteId(null);
              lastTargetNoteIdRef.current = null;
              persistenceTimeoutRef.current = null;
            }, 1500); // Clear after animation completes
          } else if (!lastTargetNoteIdRef.current) {
            setFoundNoteId(null);
          }
        } else {
          // Radar is active
          if (persistenceTimeoutRef.current) {
            clearTimeout(persistenceTimeoutRef.current);
            persistenceTimeoutRef.current = null;
          }
          setFoundNoteId(null);
          setClosest(nearest);
          setClosestNoteId(nearest?.id || null);
          lastTargetNoteIdRef.current = nearest?.id || null;
        }
      }
      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (persistenceTimeoutRef.current) clearTimeout(persistenceTimeoutRef.current);
    };
  }, [notes, setClosestNoteId]);

  if (!closest) return null;

  // Calculate angle for the arrow
  const angle = Math.atan2(closest.dy, closest.dx) * (180 / Math.PI);

  return (
    <div className="note-finder" onClick={() => {
      const container = document.querySelector('.workspace-canvas-container');
      if (container) {
        container.scrollTo({
          left: closest.x - container.clientWidth / 2 + 130,
          top: closest.y - container.clientHeight / 2 + 80,
          behavior: 'smooth'
        });
      }
    }}>
      <div className="note-finder-label">Click if lost</div>
      <div className="note-finder-arrow" style={{ transform: `rotate(${angle}deg)` }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      </div>
    </div>
  );
}

export default function NotesManager() {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [toastMessage, setToastMessage] = useState('');
  const [closestNoteId, setClosestNoteId] = useState(null);
  const [foundNoteId, setFoundNoteId] = useState(null);
  const channelRef = useRef(null);

  // Fetch initial notes
  useEffect(() => {
    if (!supabase) return;
    const fetchNotes = async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data) {
        setNotes(data);
      }
    };
    fetchNotes();
  }, []);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel('notes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotes((prev) => {
              if (prev.find((n) => n.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          } else if (payload.eventType === 'UPDATE') {
            setNotes((prev) =>
              prev.map((n) => (n.id === payload.new.id ? payload.new : n))
            );
          } else if (payload.eventType === 'DELETE') {
            setNotes((prev) => prev.filter((n) => n.id !== payload.old.id));
          }
        }
      )
      .on(
        'broadcast',
        { event: 'note_content_update' },
        (payload) => {
          // Sanitize incoming broadcast content to prevent XSS
          const safeContent = sanitize(payload.payload?.content);
          const noteId = payload.payload?.id;
          if (!noteId) return;
          setNotes((prev) =>
            prev.map((n) => (n.id === noteId ? { ...n, content: safeContent } : n))
          );
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Realtime channel error:', err);
        }
      });

    // Store channel ref for broadcasting (no window global)
    channelRef.current = channel;

    // Polling fallback — re-fetch notes every 5s in case realtime misses events
    const pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: true });
      if (data) setNotes(data);
    }, 5000);

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      clearInterval(pollInterval);
    };
  }, []);

  // Broadcast helper — uses React ref instead of window global
  const handleBroadcast = useCallback((data) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'note_content_update',
        payload: data
      });
    }
  }, []);

  // Optimistically update a note locally
  const handleUpdate = useCallback((updatedNote) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === updatedNote.id ? { ...n, ...updatedNote } : n))
    );
  }, []);

  // Optimistically delete a note locally
  const handleDelete = useCallback((noteId) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  // Create a new note
  const handleDropNote = async () => {
    if (!user) return; // Only logged-in users can create notes

    const isAdmin = user.email === (process.env.NEXT_PUBLIC_ADMIN_EMAIL || '');
    const myNotesCount = notes.filter((n) => n.created_by === user.id).length;
    
    if (!isAdmin && myNotesCount >= 3) {
      setToastMessage("You have reached the limit of 3 active notes. Please delete an existing note first.");
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }

    const pos = randomPosition();
    const color = randomColor();

    const newNote = {
      content: '',
      x: pos.x,
      y: pos.y,
      color,
      created_by: user.id,
      author_email: user.email || '',
    };

    // Optimistic insert with temp ID
    const tempId = crypto.randomUUID();
    const optimistic = { ...newNote, id: tempId, created_at: new Date().toISOString() };
    setNotes((prev) => [...prev, optimistic]);

    // Visually highlight the newly created note for feedback
    setFoundNoteId(tempId);
    setTimeout(() => setFoundNoteId(null), 1500);

    // Pan the camera gracefully to the new note
    setTimeout(() => {
      const container = document.querySelector('.workspace-canvas-container');
      if (container) {
        container.scrollTo({
          left: pos.x - container.clientWidth / 2 + 130,
          top: pos.y - container.clientHeight / 2 + 80,
          behavior: 'smooth'
        });
      }
    }, 50);

    if (!supabase) return;
    const { data, error } = await supabase
      .from('notes')
      .insert(newNote)
      .select()
      .single();

    if (data) {
      // Replace optimistic with real
      setNotes((prev) =>
        prev.map((n) => (n.id === tempId ? data : n))
      );
      // Transfer the active aura highlight to the real database ID
      setFoundNoteId((current) => current === tempId ? data.id : current);
    } else if (error) {
      // Rollback
      setNotes((prev) => prev.filter((n) => n.id !== tempId));
      console.error('Failed to create note:', error);
    }
  };

  return (
    <>
      {notes.map((note) => (
        <StickyNote
          key={note.id}
          note={note}
          isFound={note.id === foundNoteId}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onBroadcast={handleBroadcast}
        />
      ))}

      {/* Floating Action Button - only for logged in users */}
      {user && (
        <button
          className="fab"
          onClick={handleDropNote}
          title="Drop a Note"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="fab-label">Drop a Note</span>
        </button>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-notification">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}
      {/* Note Finder HUD */}
      <NoteFinder notes={notes} setClosestNoteId={setClosestNoteId} setFoundNoteId={setFoundNoteId} />
    </>
  );
}
