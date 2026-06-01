import { useEffect, useRef, useState } from 'react';
import { MoreVertical, Reply, Edit2, Trash2, Flag } from 'lucide-react';

interface MessageActionsMenuProps {
  isOwn:    boolean;
  canEdit:  boolean;
  onReply:  () => void;
  onEdit:   () => void;
  onDelete: () => void;
  onReport: () => void;
}

export function MessageActionsMenu({
  isOwn, canEdit, onReply, onEdit, onDelete, onReport,
}: MessageActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown',   handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown',   handleKey);
    };
  }, [open]);

  function pick(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={triggerStyle}
        aria-label="Message actions"
      >
        <MoreVertical size={14} strokeWidth={2} />
      </button>

      {open && (
        <div style={{ ...menuStyle, [isOwn ? 'right' : 'left']: 0 }}>
          <Item icon={<Reply size={14} strokeWidth={2} />} onClick={() => pick(onReply)}>
            Reply
          </Item>
          {isOwn && canEdit && (
            <Item icon={<Edit2 size={14} strokeWidth={2} />} onClick={() => pick(onEdit)}>
              Edit
            </Item>
          )}
          {isOwn && (
            <Item
              icon={<Trash2 size={14} strokeWidth={2} />}
              onClick={() => pick(onDelete)}
              danger
            >
              Delete
            </Item>
          )}
          {!isOwn && (
            <Item
              icon={<Flag size={14} strokeWidth={2} />}
              onClick={() => pick(onReport)}
              danger
            >
              Report
            </Item>
          )}
        </div>
      )}
    </div>
  );
}

function Item({
  icon, children, onClick, danger,
}: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '9px 14px',
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 13, fontWeight: 500,
        color: danger ? 'var(--color-danger)' : 'var(--color-text-primary)',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#F8F7F5')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {icon}
      {children}
    </button>
  );
}

const triggerStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 24, height: 24, borderRadius: 6,
  background: '#fff', border: '1px solid var(--color-border)',
  cursor: 'pointer', color: 'var(--color-text-muted)',
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
};

const menuStyle: React.CSSProperties = {
  position: 'absolute',
  top: 30,
  minWidth: 180,
  background: '#fff',
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
  padding: '6px 0',
  zIndex: 50,
};
