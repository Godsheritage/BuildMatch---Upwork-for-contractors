import { useState } from 'react';
import { X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import { completeJob, createReview } from '../../services/review.service';
import { Button } from '../ui/Button';
import styles from './ReviewModal.module.css';

// ── Star selector ─────────────────────────────────────────────────────────────

function StarSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  return (
    <div className={styles.starRow}>
      <div className={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={styles.starBtn}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                fill={star <= active ? '#F59E0B' : 'none'}
                stroke={star <= active ? '#F59E0B' : 'var(--color-border)'}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ))}
      </div>
      <p className={styles.starHint}>
        {active === 0 && 'Select a rating'}
        {active === 1 && '1 — Poor'}
        {active === 2 && '2 — Below average'}
        {active === 3 && '3 — Good'}
        {active === 4 && '4 — Very good'}
        {active === 5 && '5 — Excellent'}
      </p>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export interface ReviewModalProps {
  open:             boolean;
  onClose:          () => void;
  jobId:            string;
  revieweeName:     string;
  reviewerRole:     'INVESTOR' | 'CONTRACTOR';
  alreadyCompleted: boolean;
  onSuccess:        () => void;
}

export function ReviewModal({
  open, onClose, jobId, revieweeName, reviewerRole, alreadyCompleted, onSuccess,
}: ReviewModalProps) {
  const qc           = useQueryClient();
  const { toast }    = useToast();
  const [rating, setRating] = useState(0);
  const [title,  setTitle]  = useState('');
  const [body,   setBody]   = useState('');
  const [errors, setErrors] = useState<{ rating?: string; title?: string; body?: string }>({});

  const mutation = useMutation({
    mutationFn: async () => {
      if (!alreadyCompleted) {
        await completeJob(jobId);
      }
      return createReview(jobId, { rating, title: title.trim(), body: body.trim() });
    },
    onSuccess: () => {
      toast('Your review has been posted');
      qc.invalidateQueries({ queryKey: ['jobs', jobId] });
      qc.invalidateQueries({ queryKey: ['jobs', jobId, 'reviews'] });
      onSuccess();
      handleClose();
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to submit review', 'error');
    },
  });

  function validate() {
    const e: typeof errors = {};
    if (!rating)                  e.rating = 'Please select a star rating';
    if (title.trim().length < 5)  e.title  = 'Title must be at least 5 characters';
    if (title.trim().length > 100) e.title  = 'Title must be 100 characters or fewer';
    if (body.trim().length < 20)  e.body   = 'Review must be at least 20 characters';
    if (body.trim().length > 1000) e.body   = 'Review must be 1000 characters or fewer';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) mutation.mutate();
  }

  function handleClose() {
    if (mutation.isPending) return;
    setRating(0);
    setTitle('');
    setBody('');
    setErrors({});
    onClose();
  }

  if (!open) return null;

  const heading = reviewerRole === 'INVESTOR'
    ? `How was ${revieweeName} as a contractor?`
    : `How was ${revieweeName} as a client?`;

  const submitLabel = alreadyCompleted
    ? 'Post Review'
    : 'Mark Complete & Post Review';

  return (
    <div className={styles.backdrop} onClick={handleClose} aria-modal role="dialog">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.heading}>{heading}</h2>
          <button className={styles.closeBtn} onClick={handleClose} aria-label="Close" disabled={mutation.isPending}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>

          {/* Star rating */}
          <div className={styles.field}>
            <StarSelector value={rating} onChange={(v) => { setRating(v); setErrors((p) => ({ ...p, rating: undefined })); }} />
            {errors.rating && <p className={styles.error}>{errors.rating}</p>}
          </div>

          {/* Title */}
          <div className={styles.field}>
            <label className={styles.label}>Summarize your experience in one line</label>
            <input
              type="text"
              className={`${styles.input} ${errors.title ? styles.inputError : ''}`}
              placeholder="e.g. Professional, on-time, and great quality work"
              value={title}
              maxLength={100}
              onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: undefined })); }}
            />
            {errors.title && <p className={styles.error}>{errors.title}</p>}
          </div>

          {/* Body */}
          <div className={styles.field}>
            <label className={styles.label}>Your review</label>
            <textarea
              className={`${styles.textarea} ${errors.body ? styles.inputError : ''}`}
              rows={5}
              placeholder="Describe the quality of work, communication, timeliness, and anything else future clients should know..."
              value={body}
              maxLength={1000}
              onChange={(e) => { setBody(e.target.value); setErrors((p) => ({ ...p, body: undefined })); }}
            />
            <div className={styles.textareaFooter}>
              {errors.body
                ? <p className={styles.error}>{errors.body}</p>
                : <span />
              }
              <span className={`${styles.charCount} ${body.length > 950 ? styles.charCountWarn : ''}`}>
                {body.length}/1000
              </span>
            </div>
          </div>

          {/* Submit */}
          <div className={styles.actions}>
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Posting…' : submitLabel}
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
}
