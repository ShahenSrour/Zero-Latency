'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || '';

// Sanitize input — strip HTML tags, limit length
function sanitize(text, maxLen = 500) {
  return text.replace(/<[^>]*>/g, '').slice(0, maxLen);
}

export default function StickyNote({ note, onUpdate, onDelete, onBroadcast }) {
  const { user } = useAuth();
  const [content, setContent] = useState(note.content);
  const lastBroadcast = useRef(note.content);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const noteRef = useRef(null);
  const textareaRef = useRef(null);

  // Sync content when note prop changes from remote
  useEffect(() => {
    if (!isEditing) {
      setContent(note.content);
    }
  }, [note.content, isEditing]);

  // Broadcast typing changes (throttled)
  useEffect(() => {
    if (!isEditing || content === lastBroadcast.current) return;

    const timeout = setTimeout(() => {
      onBroadcast({ id: note.id, content });
      lastBroadcast.current = content;
    }, 100);

    return () => clearTimeout(timeout);
  }, [content, isEditing, note.id, onBroadcast]);

  const isAdmin = user?.email === ADMIN_EMAIL;
  const isOwner = user?.id === note.created_by || isAdmin;

  // Auto-focus textarea when editing
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  }, [isEditing]);

  // Drag start (Mouse)
  const handleMouseDown = useCallback(
    (e) => {
      if (!isOwner || isEditing) return;
      if (e.target.closest('.note-delete-btn') || e.target.closest('textarea')) return;

      e.preventDefault();
      setIsDragging(true);

      const rect = noteRef.current.getBoundingClientRect();
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    [isOwner, isEditing]
  );

  // Drag start (Touch)
  const handleTouchStart = useCallback(
    (e) => {
      if (!isOwner || isEditing) return;
      if (e.target.closest('.note-delete-btn') || e.target.closest('textarea')) return;

      // Don't preventDefault here as it might block scrolling if not dragging
      const touch = e.touches[0];
      setIsDragging(true);

      const rect = noteRef.current.getBoundingClientRect();
      dragOffset.current = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    },
    [isOwner, isEditing]
  );

  // Drag move & end (window-level listeners)
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (x, y) => {
      const canvas = noteRef.current?.closest('.cursor-canvas');
      if (!canvas) return;

      const canvasRect = canvas.getBoundingClientRect();
      const newX = Math.max(0, x - canvasRect.left - dragOffset.current.x);
      const newY = Math.max(0, y - canvasRect.top - dragOffset.current.y);

      noteRef.current.style.left = `${newX}px`;
      noteRef.current.style.top = `${newY}px`;
    };

    const handleMouseMove = (e) => handleMove(e.clientX, e.clientY);
    const handleTouchMove = (e) => {
      if (e.cancelable) e.preventDefault();
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    };

    const handleEnd = async () => {
      setIsDragging(false);

      // Persist new position
      const left = parseInt(noteRef.current.style.left) || note.x;
      const top = parseInt(noteRef.current.style.top) || note.y;

      onUpdate({ ...note, x: left, y: top });

      if (supabase) {
        await supabase
          .from('notes')
          .update({ x: left, y: top })
          .eq('id', note.id);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, note, onUpdate]);

  // Save content on blur
  const handleBlur = async () => {
    setIsEditing(false);
    const sanitized = sanitize(content);
    setContent(sanitized);

    if (sanitized !== note.content) {
      onUpdate({ ...note, content: sanitized });
      if (supabase) {
        await supabase
          .from('notes')
          .update({ content: sanitized })
          .eq('id', note.id);
      }
    }
  };

  // Delete note
  const handleDelete = async () => {
    onDelete(note.id);
    if (supabase) {
      await supabase.from('notes').delete().eq('id', note.id);
    }
  };

  // Format timestamp
  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div
      ref={noteRef}
      className={`sticky-note ${isDragging ? 'dragging' : ''} ${isOwner ? 'is-owner' : ''}`}
      style={{
        left: `${note.x}px`,
        top: `${note.y}px`,
        '--note-color': note.color,
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onDoubleClick={() => {
        if (isOwner) setIsEditing(true);
      }}
    >
      {/* Note header */}
      <div className="note-header">
        <div className="note-author">
          <span className="note-avatar" style={{ background: note.color }}>
            {(note.author_email || '?').charAt(0).toUpperCase()}
          </span>
          <span className="note-author-name">
            {note.author_email?.split('@')[0] || 'User'}
          </span>
        </div>
        <div className="note-actions">
          <span className="note-time">{timeAgo(note.created_at)}</span>
          {isOwner && (
            <button
              className="note-delete-btn"
              onClick={handleDelete}
              title="Delete note"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Note content */}
      <div className="note-content">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleBlur();
            }}
            maxLength={500}
            placeholder="Type your note..."
          />
        ) : (
          <p>{content || (isOwner ? 'Double-click to edit...' : 'Empty note')}</p>
        )}
      </div>
    </div>
  );
}
