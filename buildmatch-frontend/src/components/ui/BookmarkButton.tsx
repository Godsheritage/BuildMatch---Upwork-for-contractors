import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useSavedContractors } from '../../context/SavedContractorsContext';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import styles from './BookmarkButton.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BookmarkButtonProps {
  contractorProfileId: string;
  size?:               'sm' | 'md' | 'lg';
  variant?:            'icon' | 'icon-label';
  className?:          string;
  onSaveSuccess?:      () => void;
  onRemoveSuccess?:    () => void;
}

// ── Icon pixel sizes ──────────────────────────────────────────────────────────

const ICON_SIZE: Record<'sm' | 'md' | 'lg', number> = {
  sm: 16,
  md: 20,
  lg: 24,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function BookmarkButton({
  contractorProfileId,
  size      = 'md',
  variant   = 'icon',
  className,
  onSaveSuccess,
  onRemoveSuccess,
}: BookmarkButtonProps) {
  const { user }              = useAuth();
  const { isSaved, toggle }   = useSavedContractors();
  const { toast }             = useToast();
  const navigate              = useNavigate();

  const [isToggling, setIsToggling] = useState(false);
  const [justSaved,  setJustSaved]  = useState(false);

  const saved      = isSaved(contractorProfileId);
  const px         = ICON_SIZE[size];
  const isInvestor = user?.role === 'INVESTOR';

  // Contractors see nothing — bookmark is an investor-only feature
  if (user?.role === 'CONTRACTOR') return null;

  // ── Save animation pulse ────────────────────────────────────────────────────
  useEffect(() => {
    if (justSaved) {
      const t = setTimeout(() => setJustSaved(false), 220);
      return () => clearTimeout(t);
    }
  }, [justSaved]);

  // ── Click handler ───────────────────────────────────────────────────────────
  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();

    if (!isInvestor) {
      navigate('/login');
      return;
    }

    if (isToggling) return;

    const wasSaved = saved;
    setIsToggling(true);

    try {
      await toggle(contractorProfileId);

      if (!wasSaved) {
        // Just saved
        setJustSaved(true);
        toast('Saved to My Contractors', 'success');
        onSaveSuccess?.();
      } else {
        // Just removed
        toast('Removed from saved list', 'info');
        onRemoveSuccess?.();
      }
    } finally {
      setIsToggling(false);
    }
  }

  // ── Tooltip text ─────────────────────────────────────────────────────────────
  const tooltip = !isInvestor
    ? 'Sign in to save contractors'
    : saved
      ? 'Remove from saved list'
      : 'Save contractor';

  // ── Class composition ────────────────────────────────────────────────────────
  const btnCls = [
    styles.btn,
    styles[size],
    saved        ? styles.btnSaved    : '',
    justSaved    ? styles.btnPulse    : '',
    !isInvestor  ? styles.btnGuest    : '',
    isToggling   ? styles.btnToggling : '',
    className    ?? '',
  ].filter(Boolean).join(' ');

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <button
      type="button"
      className={btnCls}
      onClick={handleClick}
      title={tooltip}
      aria-label={tooltip}
      aria-pressed={saved}
      disabled={isToggling}
    >
      {isToggling ? (
        <span
          className={styles.spinner}
          style={{ width: px, height: px }}
          aria-hidden
        />
      ) : saved ? (
        <BookmarkCheck
          size={px}
          strokeWidth={1.75}
          className={styles.iconSaved}
          aria-hidden
        />
      ) : (
        <Bookmark
          size={px}
          strokeWidth={1.75}
          className={styles.iconUnsaved}
          aria-hidden
        />
      )}

      {variant === 'icon-label' && !isToggling && (
        <span className={styles.label}>
          {saved ? 'Saved' : 'Save'}
        </span>
      )}
    </button>
  );
}
