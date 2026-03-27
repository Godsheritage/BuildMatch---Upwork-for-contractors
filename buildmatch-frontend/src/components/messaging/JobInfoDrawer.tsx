import { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { JobContextPanel } from './JobContextPanel';
import type { Conversation } from '../../types/message.types';
import styles from './JobInfoDrawer.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const DRAG_CLOSE_THRESHOLD = 80; // px dragged down before auto-close

// ── Component ─────────────────────────────────────────────────────────────────

interface JobInfoDrawerProps {
  open:         boolean;
  onClose:      () => void;
  conversation: Conversation;
}

export function JobInfoDrawer({ open, onClose, conversation }: JobInfoDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [dragY,   setDragY]   = useState(0);

  const startYRef  = useRef(0);
  const draggingRef = useRef(false);

  // ── Mount / unmount with CSS transition ──────────────────────────────────

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Double rAF so initial translateY(100%) is painted before transitioning to 0
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true))
      );
      return () => cancelAnimationFrame(id);
    } else {
      setVisible(false);
      const t = setTimeout(() => {
        setMounted(false);
        setDragY(0);
      }, 320);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ── Prevent body scroll while drawer is open ─────────────────────────────

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mounted]);

  // ── Touch drag to close ───────────────────────────────────────────────────

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startYRef.current  = e.touches[0].clientY;
    draggingRef.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!draggingRef.current) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0) setDragY(delta); // only drag downward
  }, []);

  const handleTouchEnd = useCallback(() => {
    draggingRef.current = false;
    if (dragY >= DRAG_CLOSE_THRESHOLD) {
      onClose();
    } else {
      setDragY(0); // snap back
    }
  }, [dragY, onClose]);

  if (!mounted) return null;

  return (
    <div
      className={styles.overlay}
      style={{ opacity: visible ? 1 : 0 }}
      onClick={onClose}
    >
      <div
        className={styles.sheet}
        style={{
          transform:  visible ? `translateY(${dragY}px)` : 'translateY(100%)',
          transition: dragY > 0 ? 'none' : 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className={styles.handle} />

        {/* Sheet header */}
        <div className={styles.sheetHeader}>
          <h3 className={styles.sheetTitle}>Job Info</h3>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            type="button"
            aria-label="Close job info"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Scrollable body with JobContextPanel content */}
        <div className={styles.body}>
          <JobContextPanel
            conversation={conversation}
            className={styles.panelInner}
            showHeader={false}
          />
        </div>
      </div>
    </div>
  );
}
