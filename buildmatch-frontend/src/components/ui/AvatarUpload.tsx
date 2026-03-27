import React, { useRef, useState, useCallback } from 'react';
import { Camera, Trash2, X } from 'lucide-react';
import useAvatarUpload from '../../hooks/useAvatarUpload';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import styles from './AvatarUpload.module.css';
import { getOptimizedUrl } from '../../utils/media';

// ── Constants ─────────────────────────────────────────────────────────────────

const RING_R      = 44;
const RING_CIRC   = 2 * Math.PI * RING_R; // ≈ 276.46

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

const AVATAR_COLORS = [
  { bg: '#DBEAFE', text: '#1E40AF' },
  { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#EDE9FE', text: '#5B21B6' },
  { bg: '#FEE2E2', text: '#991B1B' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#E0F2FE', text: '#0369A1' },
];

function getAvatarColor(name: string): { bg: string; text: string } {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

/**
 * Crop the centre square from an <img> element and return a Blob.
 * Output is JPEG at 0.92 quality.
 */
function cropCenterSquare(imgEl: HTMLImageElement): Promise<Blob> {
  const { naturalWidth: nw, naturalHeight: nh } = imgEl;
  const side = Math.min(nw, nh);
  const sx = Math.floor((nw - side) / 2);
  const sy = Math.floor((nh - side) / 2);

  const canvas = document.createElement('canvas');
  canvas.width  = side;
  canvas.height = side;
  canvas.getContext('2d')!.drawImage(imgEl, sx, sy, side, side, 0, 0, side, side);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      0.92,
    );
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AvatarUploadProps {
  /** Display name used for initials + colour when no photo is set. */
  name: string;
  /** Currently stored avatar URL (null means "no photo"). */
  currentAvatarUrl: string | null;
  /** Called with the new public URL after a successful upload + API save. */
  onUploadComplete: (newUrl: string) => void;
  /** Called after a successful delete. */
  onDelete?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AvatarUpload({
  name,
  currentAvatarUrl,
  onUploadComplete,
  onDelete,
  size = 'md',
}: AvatarUploadProps) {
  const { uploadAvatar, deleteAvatar, isUploading, uploadProgress } = useAvatarUpload();
  const { toast } = useToast();

  // File input refs — standard + camera (selfie)
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const cameraInputRef  = useRef<HTMLInputElement>(null);

  const [imgError, setImgError] = useState(false);

  // Crop-modal state
  const [pendingFile,       setPendingFile]       = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const cropImgRef = useRef<HTMLImageElement>(null);

  // Delete-confirm state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting,        setIsDeleting]        = useState(false);

  // ── File selection ─────────────────────────────────────────────────────────

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so the same file can be re-selected after cancelling
    e.target.value = '';

    const url = URL.createObjectURL(file);
    setPendingFile(file);
    setPendingPreviewUrl(url);
  }, []);

  const handleOverlayClick = useCallback(() => {
    if (!isUploading) fileInputRef.current?.click();
  }, [isUploading]);

  const handleCameraClick = useCallback(() => {
    if (!isUploading) cameraInputRef.current?.click();
  }, [isUploading]);

  // ── Crop-modal actions ─────────────────────────────────────────────────────

  const closeCropModal = useCallback(() => {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(null);
    setPendingPreviewUrl(null);
  }, [pendingPreviewUrl]);

  const handleConfirmCrop = useCallback(async () => {
    if (!pendingFile || !cropImgRef.current) return;

    try {
      const blob     = await cropCenterSquare(cropImgRef.current);
      const cropped  = new File([blob], pendingFile.name, { type: 'image/jpeg' });

      // Close modal before uploading so the ring appears on the avatar
      closeCropModal();

      const publicUrl = await uploadAvatar(cropped);

      // Persist to backend
      await api.put('/users/me/avatar', { avatarUrl: publicUrl });

      onUploadComplete(publicUrl);
      toast('Profile photo updated');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    }
  }, [pendingFile, closeCropModal, uploadAvatar, onUploadComplete, toast]);

  // ── Delete actions ─────────────────────────────────────────────────────────

  const handleDeleteConfirm = useCallback(async () => {
    if (!currentAvatarUrl) return;
    setIsDeleting(true);
    try {
      await deleteAvatar(currentAvatarUrl);
      onDelete?.();
      toast('Profile photo removed');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove photo', 'error');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [currentAvatarUrl, deleteAvatar, onDelete, toast]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const color          = getAvatarColor(name);
  const initials       = getInitials(name);
  const strokeOffset   = RING_CIRC * (1 - uploadProgress / 100);
  const showRing       = isUploading;
  const SIZE_PX: Record<string, number> = { sm: 64, md: 192, lg: 240 };
  const optimizedSrc   = currentAvatarUrl && !imgError
    ? getOptimizedUrl(currentAvatarUrl, SIZE_PX[size] ?? 192)
    : undefined;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className={[styles.wrapper, styles[size]].join(' ')}>

        {/* ── Avatar circle ──────────────────────────────────────────────── */}
        <div
          className={styles.circle}
          style={currentAvatarUrl ? undefined : { backgroundColor: color.bg, color: color.text }}
        >
          {currentAvatarUrl && !imgError ? (
            <img
              src={optimizedSrc}
              alt={name}
              className={styles.img}
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className={styles.initials}>{initials}</span>
          )}
        </div>

        {/* ── SVG progress ring ──────────────────────────────────────────── */}
        {showRing && (
          <svg
            className={styles.ring}
            viewBox="0 0 100 100"
            aria-hidden="true"
          >
            {/* Track */}
            <circle
              cx="50" cy="50" r={RING_R}
              fill="none"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="6"
            />
            {/* Progress arc — rotated so 0% starts at the top */}
            <circle
              cx="50" cy="50" r={RING_R}
              fill="none"
              stroke="white"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={RING_CIRC}
              strokeDashoffset={strokeOffset}
              style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
            />
          </svg>
        )}

        {/* ── Upload overlay (camera icon) ───────────────────────────────── */}
        {!isUploading && (
          <button
            type="button"
            className={styles.overlay}
            onClick={handleOverlayClick}
            aria-label="Change profile photo"
            title="Change profile photo"
          >
            <Camera className={styles.overlayIcon} />
          </button>
        )}

        {/* ── Delete button (top-right, only when photo exists) ─────────── */}
        {currentAvatarUrl && !isUploading && !showDeleteConfirm && (
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={() => setShowDeleteConfirm(true)}
            aria-label="Remove profile photo"
            title="Remove photo"
          >
            <Trash2 className={styles.deleteBtnIcon} />
          </button>
        )}

        {/* ── Hidden file inputs ─────────────────────────────────────────── */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className={styles.fileInput}
          onChange={handleFileChange}
          aria-hidden="true"
          tabIndex={-1}
        />
        {/* Camera capture — selfie (front camera), shown as separate trigger on touch devices */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="user"
          className={styles.fileInput}
          onChange={handleFileChange}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {/* ── Mobile camera buttons (only on touch/pointer:coarse devices) ──── */}
      {!isUploading && (
        <div className={styles.mobileActions}>
          <button type="button" className={styles.mobileBtn} onClick={handleCameraClick}>
            Take selfie
          </button>
          <button type="button" className={styles.mobileBtn} onClick={handleOverlayClick}>
            Choose from library
          </button>
        </div>
      )}

      {/* ── Inline delete confirm (appears below the avatar) ──────────────── */}
      {showDeleteConfirm && (
        <div className={styles.deleteConfirm}>
          <p className={styles.deleteConfirmText}>Remove your photo?</p>
          <div className={styles.deleteConfirmActions}>
            <button
              type="button"
              className={styles.deleteConfirmYes}
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? 'Removing…' : 'Remove'}
            </button>
            <button
              type="button"
              className={styles.deleteConfirmNo}
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Crop modal ────────────────────────────────────────────────────── */}
      {pendingPreviewUrl && (
        <div className={styles.modalBackdrop} onClick={closeCropModal}>
          <div
            className={styles.modal}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="crop-modal-title"
          >
            {/* Header */}
            <div className={styles.modalHeader}>
              <span id="crop-modal-title" className={styles.modalTitle}>
                Adjust your photo
              </span>
              <button
                type="button"
                className={styles.modalClose}
                onClick={closeCropModal}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Preview — centre square will be used */}
            <div className={styles.modalPreviewWrap}>
              <img
                ref={cropImgRef}
                src={pendingPreviewUrl}
                alt="Preview"
                className={styles.modalPreviewImg}
                draggable={false}
              />
              {/* Crosshair overlay to show the crop area */}
              <div className={styles.modalCropOverlay} aria-hidden="true" />
            </div>

            <p className={styles.modalHint}>
              The centre square of your image will be used.
            </p>

            {/* Actions */}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                onClick={closeCropModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalConfirm}
                onClick={handleConfirmCrop}
              >
                Save photo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
