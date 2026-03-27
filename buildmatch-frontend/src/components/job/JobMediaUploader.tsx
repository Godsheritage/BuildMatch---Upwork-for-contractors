import { useEffect, useRef, useCallback, useState } from 'react';
import useJobMediaUpload from '../../hooks/useJobMediaUpload';
import { getSupabaseClient } from '../../lib/supabase';
import { Lightbox } from '../ui/Lightbox';
import styles from './JobMediaUploader.module.css';
import { getOptimizedUrl, JOB_PHOTO_FALLBACK } from '../../utils/media';

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_PHOTOS = 20;
const PHOTO_BUCKET = 'job-photos';

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractStoragePath(url: string): string {
  const base = `${import.meta.env.VITE_SUPABASE_URL as string}/storage/v1/object/public/${PHOTO_BUCKET}/`;
  return url.replace(base, '');
}

// ── Icons (inline SVG to avoid extra deps) ────────────────────────────────────

function UploadIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CloseIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

// ── CellImage (isolates per-image error state) ────────────────────────────────

function CellImage({ url, idx }: { url: string; idx: number }) {
  const [error, setError] = useState(false);
  return (
    <img
      src={error ? JOB_PHOTO_FALLBACK : getOptimizedUrl(url, 400)}
      alt={`Photo ${idx + 1}`}
      className={styles.cellImg}
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  onMediaChange: (photos: string[]) => void;
  initialPhotos?: string[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function JobMediaUploader({ onMediaChange, initialPhotos = [] }: Props) {
  const {
    pendingPhotoUrls,
    uploadingPhotos,
    photoUploadError,
    addPhotos,
    removePhoto,
    clearAll,
  } = useJobMediaUpload();

  // Combine existing + pending for display
  const allPhotos = [...initialPhotos, ...pendingPhotoUrls];
  const isFull = allPhotos.length >= MAX_PHOTOS;

  // ── Drag-and-drop state ─────────────────────────────────────────────────────

  const [dragging, setDragging] = useState(false);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // ── Lightbox state ──────────────────────────────────────────────────────────

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  // ── Confirm delete state ────────────────────────────────────────────────────

  const [confirmUrl, setConfirmUrl] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Unmount cleanup (orphaned drafts) ───────────────────────────────────────

  const wasSubmittedRef = useRef(false);
  const pendingPhotoUrlsRef = useRef<string[]>([]);

  // Keep ref in sync so unmount cleanup reads latest value
  useEffect(() => {
    pendingPhotoUrlsRef.current = pendingPhotoUrls;
  }, [pendingPhotoUrls]);

  // Allow parent to signal that the form was submitted
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__jobUploaderMarkSubmitted = () => {
      wasSubmittedRef.current = true;
    };
    return () => {
      delete (window as unknown as Record<string, unknown>).__jobUploaderMarkSubmitted;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (!wasSubmittedRef.current && pendingPhotoUrlsRef.current.length > 0) {
        const supabase = getSupabaseClient();
        const paths = pendingPhotoUrlsRef.current.map((url) => extractStoragePath(url));
        // Fire-and-forget cleanup — component is unmounting
        supabase.storage.from(PHOTO_BUCKET).remove(paths).catch(() => {
          // Non-critical: storage will be cleaned up by periodic lifecycle rules
        });
      }
    };
  }, []);

  // ── Notify parent of photo changes ─────────────────────────────────────────

  const onMediaChangeRef = useRef(onMediaChange);
  useEffect(() => { onMediaChangeRef.current = onMediaChange; }, [onMediaChange]);

  // Capture initialPhotos once at mount — it's an initial value, not reactive state.
  // Using it directly in the dep array causes an infinite loop when the parent passes
  // a new array literal (e.g. initialPhotos={[]}) on every render.
  const initialPhotosRef = useRef(initialPhotos);

  useEffect(() => {
    onMediaChangeRef.current([...initialPhotosRef.current, ...pendingPhotoUrls]);
  }, [pendingPhotoUrls]);

  // ── File handling ───────────────────────────────────────────────────────────

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Pre-check combined cap before calling hook
    const available = MAX_PHOTOS - allPhotos.length;
    if (available <= 0) return;

    const capped = Array.from(files).slice(0, available);
    const dt = new DataTransfer();
    capped.forEach((f) => dt.items.add(f));

    try {
      await addPhotos(dt.files);
    } catch {
      // error surfaces via photoUploadError state
    }
  }, [addPhotos, allPhotos.length]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!isFull) handleFiles(e.dataTransfer.files);
  }, [handleFiles, isFull]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset so the same file can be re-selected if needed
    e.target.value = '';
  };

  // ── Delete confirm ──────────────────────────────────────────────────────────

  const handleDeleteConfirm = async () => {
    if (!confirmUrl) return;
    setDeleting(true);
    try {
      await removePhoto(confirmUrl);
    } catch {
      // error shown via photoUploadError
    } finally {
      setDeleting(false);
      setConfirmUrl(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.section}>
      <p className={styles.label}>Photos</p>
      <p className={styles.sublabel}>
        Add up to 20 photos to showcase the project site or work needed. JPG, PNG, WebP, or HEIC — max 15 MB each.
      </p>

      {/* Drop zone — only shown when not at cap */}
      {!isFull && (
        <div
          className={[
            styles.dropZone,
            dragging ? styles.dropZoneDragging : '',
          ].join(' ')}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          aria-label="Upload photos"
        >
          <div className={styles.dropZoneContent}>
            <UploadIcon />
            <p className={styles.dropZoneText}>
              {dragging ? 'Drop photos here' : 'Click or drag photos here'}
            </p>
            <p className={styles.dropZoneHint}>Up to {MAX_PHOTOS - allPhotos.length} more photo{MAX_PHOTOS - allPhotos.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        multiple
        className={styles.fileInput}
        onChange={handleInputChange}
      />
      {/* Camera capture — rear camera, shown as separate button on touch devices */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        capture="environment"
        className={styles.fileInput}
        onChange={handleInputChange}
      />

      {/* Mobile camera / library buttons (touch devices only) */}
      {!isFull && (
        <div className={styles.mobileActions}>
          <button
            type="button"
            className={styles.mobileBtn}
            onClick={() => cameraInputRef.current?.click()}
          >
            Take photo
          </button>
          <button
            type="button"
            className={styles.mobileBtn}
            onClick={() => fileInputRef.current?.click()}
          >
            Choose from library
          </button>
        </div>
      )}

      {/* Photo grid */}
      {allPhotos.length > 0 && (
        <div className={styles.grid}>
          {allPhotos.map((url, idx) => (
            <div key={url} className={styles.cell}>
              <CellImage url={url} idx={idx} />
              <div className={styles.cellOverlay}>
                <button
                  type="button"
                  className={styles.cellExpandBtn}
                  onClick={() => openLightbox(idx)}
                  aria-label="View full size"
                >
                  <ExpandIcon />
                </button>
              </div>
              {/* Delete button — only for pending (not initialPhotos) */}
              {idx >= initialPhotos.length && (
                <button
                  type="button"
                  className={styles.cellDeleteBtn}
                  onClick={() => setConfirmUrl(url)}
                  aria-label="Remove photo"
                >
                  <CloseIcon size={12} />
                </button>
              )}
            </div>
          ))}

          {/* Upload skeletons */}
          {uploadingPhotos && (
            <>
              <div className={styles.skeleton}>
                <div className={styles.skeletonSpinner}>
                  <div className={styles.spinner} />
                </div>
              </div>
              <div className={styles.skeleton} />
            </>
          )}
        </div>
      )}

      {/* Uploading without any existing photos yet */}
      {uploadingPhotos && allPhotos.length === 0 && (
        <div className={styles.grid}>
          <div className={styles.skeleton}>
            <div className={styles.skeletonSpinner}>
              <div className={styles.spinner} />
            </div>
          </div>
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      )}

      {/* Count indicator */}
      {allPhotos.length > 0 && (
        <p className={[styles.countIndicator, isFull ? styles.countIndicatorFull : ''].join(' ')}>
          {allPhotos.length} / {MAX_PHOTOS} photos added
          {isFull && ' — Maximum reached'}
        </p>
      )}

      {/* Error */}
      {photoUploadError && (
        <p className={styles.error}>{photoUploadError}</p>
      )}

      {/* ── Confirm delete dialog ────────────────────────────────────────────── */}
      {confirmUrl && (
        <div className={styles.confirmBackdrop} role="dialog" aria-modal="true">
          <div className={styles.confirmDialog}>
            <p className={styles.confirmText}>Remove this photo?</p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmCancelBtn}
                onClick={() => setConfirmUrl(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmRemoveBtn}
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox ─────────────────────────────────────────────────────────── */}
      {lightboxIndex !== null && (
        <Lightbox
          images={allPhotos}
          initialIndex={lightboxIndex}
          onClose={closeLightbox}
        />
      )}
    </div>
  );
}
