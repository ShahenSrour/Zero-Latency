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
  return {
    x: 80 + Math.floor(Math.random() * 600),
    y: 80 + Math.floor(Math.random() * 400),
  };
}

// Sanitize input — strip HTML tags, limit length
function sanitize(text, maxLen = 500) {
  return String(text || '').replace(/<[^>]*>/g, '').slice(0, maxLen);
}

export default function NotesManager() {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
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
    </>
  );
}
