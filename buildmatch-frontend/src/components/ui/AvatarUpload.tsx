import React, { useRef, useState, useCallback, useEffect } from 'react';
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

// Stage size of the crop UI in pixels (square). The visible circle uses
// the same diameter so the user is always cropping a perfect square.
const CROP_STAGE = 320;
// Output square size of the saved JPEG.
const CROP_OUTPUT = 512;

interface CropState {
  nw:    number; // natural image width
  nh:    number; // natural image height
  scale: number; // user zoom multiplier (1 = "cover")
  tx:    number; // image-centre offset from stage centre, X
  ty:    number; // image-centre offset from stage centre, Y
}

function baseCoverScale(nw: number, nh: number): number {
  // Scale that makes the smaller dimension exactly fill the stage.
  return CROP_STAGE / Math.min(nw, nh);
}

function clampOffset(state: CropState): { tx: number; ty: number } {
  const es = baseCoverScale(state.nw, state.nh) * state.scale;
  const dw = state.nw * es;
  const dh = state.nh * es;
  const maxX = Math.max(0, (dw - CROP_STAGE) / 2);
  const maxY = Math.max(0, (dh - CROP_STAGE) / 2);
  return {
    tx: Math.max(-maxX, Math.min(maxX, state.tx)),
    ty: Math.max(-maxY, Math.min(maxY, state.ty)),
  };
}

/**
 * Render the visible circular crop region to a square JPEG Blob.
 * The circle is masked via canvas clip so transparent corners don't show
 * dark fill — JPEG has no alpha so we paint a white background first.
 */
function cropFromState(imgEl: HTMLImageElement, state: CropState): Promise<Blob> {
  const es = baseCoverScale(state.nw, state.nh) * state.scale;
  const sWidth  = CROP_STAGE / es;
  const sHeight = CROP_STAGE / es;
  const sx = state.nw / 2 - (CROP_STAGE / 2 + state.tx) / es;
  const sy = state.nh / 2 - (CROP_STAGE / 2 + state.ty) / es;

  const canvas = document.createElement('canvas');
  canvas.width  = CROP_OUTPUT;
  canvas.height = CROP_OUTPUT;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  // Mask to a circle so the saved PNG IS the cropper circle exactly —
  // transparent corners, no extra content beyond what the user selected.
  ctx.save();
  ctx.beginPath();
  ctx.arc(CROP_OUTPUT / 2, CROP_OUTPUT / 2, CROP_OUTPUT / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(imgEl, sx, sy, sWidth, sHeight, 0, 0, CROP_OUTPUT, CROP_OUTPUT);
  ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/png',
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
  const [cropState, setCropState] = useState<CropState>({
    nw: 0, nh: 0, scale: 1, tx: 0, ty: 0,
  });
  const dragRef = useRef<{ startX: number; startY: number; baseTx: number; baseTy: number } | null>(null);

  const handleImgLoad = useCallback(() => {
    const img = cropImgRef.current;
    if (!img) return;
    setCropState({
      nw:    img.naturalWidth,
      nh:    img.naturalHeight,
      scale: 1,
      tx:    0,
      ty:    0,
    });
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseTx: cropState.tx,
      baseTy: cropState.ty,
    };
  }, [cropState.tx, cropState.ty]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const next = {
      ...cropState,
      tx: drag.baseTx + (e.clientX - drag.startX),
      ty: drag.baseTy + (e.clientY - drag.startY),
    };
    setCropState({ ...next, ...clampOffset(next) });
  }, [cropState]);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleZoomChange = useCallback((value: number) => {
    setCropState((prev) => {
      const next = { ...prev, scale: value };
      return { ...next, ...clampOffset(next) };
    });
  }, []);

  // Wheel-to-zoom support inside the stage
  useEffect(() => {
    if (!pendingPreviewUrl) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setCropState((prev) => {
        const delta = -e.deltaY * 0.0015;
        const scale = Math.max(1, Math.min(3, prev.scale + delta));
        const next  = { ...prev, scale };
        return { ...next, ...clampOffset(next) };
      });
    };
    const el = document.getElementById('avatar-crop-stage');
    el?.addEventListener('wheel', handler, { passive: false });
    return () => el?.removeEventListener('wheel', handler);
  }, [pendingPreviewUrl]);

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
      const blob     = await cropFromState(cropImgRef.current, cropState);
      const baseName = pendingFile.name.replace(/\.[^.]+$/, '');
      const cropped  = new File([blob], `${baseName}.png`, { type: 'image/png' });

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
  }, [pendingFile, cropState, closeCropModal, uploadAvatar, onUploadComplete, toast]);

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

            {/* Interactive circular crop stage */}
            <div className={styles.modalPreviewWrap}>
              <div
                id="avatar-crop-stage"
                className={styles.cropStage}
                style={{ width: CROP_STAGE, height: CROP_STAGE }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                <img
                  ref={cropImgRef}
                  src={pendingPreviewUrl}
                  alt="Preview"
                  className={styles.cropImg}
                  draggable={false}
                  onLoad={handleImgLoad}
                  style={{
                    transform: `translate(-50%, -50%) translate(${cropState.tx}px, ${cropState.ty}px) scale(${
                      cropState.nw && cropState.nh
                        ? baseCoverScale(cropState.nw, cropState.nh) * cropState.scale
                        : cropState.scale
                    })`,
                  }}
                />
                {/* Dim mask + circular hole */}
                <svg
                  className={styles.cropMask}
                  viewBox={`0 0 ${CROP_STAGE} ${CROP_STAGE}`}
                  aria-hidden="true"
                >
                  <defs>
                    <mask id="avatar-crop-hole">
                      <rect width={CROP_STAGE} height={CROP_STAGE} fill="white" />
                      <circle cx={CROP_STAGE / 2} cy={CROP_STAGE / 2} r={CROP_STAGE / 2} fill="black" />
                    </mask>
                  </defs>
                  <rect
                    width={CROP_STAGE}
                    height={CROP_STAGE}
                    fill="rgba(0,0,0,0.55)"
                    mask="url(#avatar-crop-hole)"
                  />
                  <circle
                    cx={CROP_STAGE / 2}
                    cy={CROP_STAGE / 2}
                    r={CROP_STAGE / 2 - 1}
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                  />
                </svg>
              </div>

              {/* Zoom slider */}
              <div className={styles.zoomRow}>
                <span className={styles.zoomLabel}>Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={cropState.scale}
                  onChange={(e) => handleZoomChange(Number(e.target.value))}
                  className={styles.zoomSlider}
                  aria-label="Zoom"
                />
              </div>
            </div>

            <p className={styles.modalHint}>
              Drag to reposition. Scroll or use the slider to zoom.
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
