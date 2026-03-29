import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bookmarks,
  MoreVertical,
  MessageSquare,
  ArrowUpRight,
  FolderInput,
  Trash2,
  Edit3,
  X,
  Check,
  AlertTriangle,
  Star,
  MapPin,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import {
  useSavedLists,
  useListContractors,
  useCreateList,
  useDeleteList,
  useRenameList,
  useRemoveFromList,
} from '../hooks/useSavedContractors';
import { useToast } from '../context/ToastContext';
import { getMyJobs } from '../services/job.service';
import { getOrCreateConversation } from '../services/message.service';
import type { JobPost } from '../types/job.types';
import styles from './SavedContractorsPage.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SavedListFE {
  id: string;
  name: string;
  isDefault: boolean;
  contractorCount: number;
}

interface SavedContractorFE {
  id: string;
  listId: string;
  contractorProfileId: string;
  note: string | null;
  savedAt: string;
  contractor: {
    id: string;
    userId: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    bio: string | null;
    specialties: string[];
    averageRating: number;
    totalReviews: number;
    yearsExperience: number;
    completedJobs: number;
    city: string | null;
    state: string | null;
    isAvailable: boolean;
  };
}

type SortKey = 'recent' | 'rating' | 'experience' | 'alpha';

// ── Helpers ───────────────────────────────────────────────────────────────────

function sortContractors(items: SavedContractorFE[], sort: SortKey): SavedContractorFE[] {
  const copy = [...items];
  if (sort === 'rating')     return copy.sort((a, b) => b.contractor.averageRating - a.contractor.averageRating);
  if (sort === 'experience') return copy.sort((a, b) => b.contractor.yearsExperience - a.contractor.yearsExperience);
  if (sort === 'alpha')      return copy.sort((a, b) =>
    `${a.contractor.firstName} ${a.contractor.lastName}`.localeCompare(`${b.contractor.firstName} ${b.contractor.lastName}`)
  );
  return copy.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
}

function initials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className={styles.skeletonCard}>
      <div className={styles.skeletonRow}>
        <div className={styles.skeletonAvatar} />
        <div style={{ flex: 1 }}>
          <div className={styles.skeletonLine} style={{ width: '55%', height: 13, marginBottom: 6 }} />
          <div className={styles.skeletonLine} style={{ width: '35%', height: 11, marginBottom: 8 }} />
          <div className={styles.skeletonLine} style={{ width: '50%', height: 10 }} />
        </div>
      </div>
      <div className={styles.skeletonLine} style={{ width: '80%', height: 10, marginTop: 12 }} />
      <div className={styles.skeletonLine} style={{ width: '65%', height: 10, marginTop: 5 }} />
    </div>
  );
}

// ── Confirm delete modal ──────────────────────────────────────────────────────

function ConfirmDeleteModal({
  list,
  onConfirm,
  onClose,
  isPending,
}: {
  list: SavedListFE;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}) {
  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalIconDanger}><Trash2 size={18} /></span>
          <h3 className={styles.modalTitle}>Delete list?</h3>
        </div>
        <p className={styles.modalBody}>
          Delete <strong>"{list.name}"</strong>?{' '}
          {list.contractorCount > 0
            ? `The ${list.contractorCount} saved contractor${list.contractorCount !== 1 ? 's' : ''} will be unsaved.`
            : 'This list is empty.'}
        </p>
        <div className={styles.modalFooter}>
          <button className={styles.modalBtnSecondary} onClick={onClose} disabled={isPending} type="button">
            Cancel
          </button>
          <button className={styles.modalBtnDanger} onClick={onConfirm} disabled={isPending} type="button">
            {isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Job picker modal ──────────────────────────────────────────────────────────

function JobPickerModal({
  contractorName,
  contractorUserId,
  onClose,
}: {
  contractorName: string;
  contractorUserId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['investor-jobs-for-message'],
    queryFn: () =>
      getMyJobs().then((all: JobPost[]) =>
        all.filter((j) => ['OPEN', 'AWARDED', 'IN_PROGRESS'].includes(j.status))
      ),
    staleTime: 5 * 60 * 1000,
  });

  async function handleStart() {
    if (!selectedJobId) return;
    setIsStarting(true);
    try {
      const conv = await getOrCreateConversation(selectedJobId, contractorUserId);
      navigate(`/dashboard/messages/${conv.id}`);
    } catch {
      toast('Could not start conversation. Please try again.', 'error');
      setIsStarting(false);
    }
  }

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalIconPrimary}><MessageSquare size={18} /></span>
          <h3 className={styles.modalTitle}>Message {contractorName}</h3>
        </div>
        <p className={styles.modalBody}>Select a job to start this conversation:</p>
        {isLoading && <p className={styles.modalMuted}>Loading jobs…</p>}
        {!isLoading && jobs.length === 0 && (
          <p className={styles.modalMuted}>
            No active jobs.{' '}
            <Link to="/dashboard/post-job" className={styles.modalLink} onClick={onClose}>
              Post a job
            </Link>{' '}
            first.
          </p>
        )}
        {!isLoading && jobs.length > 0 && (
          <div className={styles.jobPickerList}>
            {jobs.map((j) => (
              <button
                key={j.id}
                type="button"
                className={`${styles.jobPickerItem} ${selectedJobId === j.id ? styles.jobPickerItemActive : ''}`}
                onClick={() => setSelectedJobId(j.id)}
              >
                <span className={styles.jobPickerTitle}>{j.title}</span>
                <span className={styles.jobPickerStatus}>{j.status.replace('_', ' ')}</span>
              </button>
            ))}
          </div>
        )}
        <div className={styles.modalFooter}>
          <button className={styles.modalBtnSecondary} onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className={styles.modalBtnPrimary}
            onClick={handleStart}
            disabled={!selectedJobId || isStarting}
            type="button"
          >
            {isStarting ? 'Starting…' : 'Start Conversation'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Note section ──────────────────────────────────────────────────────────────

function NoteSection({ savedId, initialNote }: { savedId: string; initialNote: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialNote ?? '');
  const [showSaved, setShowSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function saveNote(text: string) {
    try {
      await api.put(`/saved/contractors/${savedId}/note`, { note: text || null });
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 1000);
    } catch {
      // silent — note is low-stakes
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value.slice(0, 300);
    setValue(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveNote(text), 500);
  }

  function handleBlur() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    saveNote(value);
  }

  if (!editing) {
    return (
      <div className={styles.noteSection}>
        {value && <p className={styles.noteText}>{value}</p>}
        <button type="button" className={styles.noteLink} onClick={() => setEditing(true)}>
          {value ? 'Edit note' : 'Add note'}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.noteSection}>
      <textarea
        className={styles.noteInput}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        rows={2}
        maxLength={300}
        placeholder="Private note about this contractor…"
        autoFocus
      />
      <div className={styles.noteFooter}>
        <span className={styles.noteCharCount}>{value.length}/300</span>
        {showSaved && <span className={styles.noteSavedFlash}>Saved</span>}
        <button type="button" className={styles.noteCloseBtn} onClick={() => setEditing(false)}>
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Saved contractor item ─────────────────────────────────────────────────────

function SavedContractorItem({
  saved,
  activeList,
  allLists,
  onRemove,
  onMove,
}: {
  saved: SavedContractorFE;
  activeList: SavedListFE;
  allLists: SavedListFE[];
  onRemove: () => void;
  onMove: (targetListId: string) => void;
}) {
  const c = saved.contractor;
  const fullName = `${c.firstName} ${c.lastName}`;
  const location = [c.city, c.state].filter(Boolean).join(', ');
  const otherLists = allLists.filter((l) => l.id !== activeList.id);
  const [moveOpen, setMoveOpen] = useState(false);
  const [jobPickerOpen, setJobPickerOpen] = useState(false);
  const moveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moveRef.current && !moveRef.current.contains(e.target as Node)) {
        setMoveOpen(false);
      }
    }
    if (moveOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [moveOpen]);

  return (
    <>
      <div className={styles.contractorItem}>
        {/* Card */}
        <div className={styles.savedCard}>
          <div className={styles.cardRow}>
            {c.avatarUrl ? (
              <img src={c.avatarUrl} alt={fullName} className={styles.cardAvatar} />
            ) : (
              <div className={styles.cardAvatarFallback}>{initials(c.firstName, c.lastName)}</div>
            )}
            <div className={styles.cardInfo}>
              <p className={styles.cardName}>{fullName}</p>
              {location && (
                <p className={styles.cardLocation}>
                  <MapPin size={10} strokeWidth={2} />
                  {location}
                </p>
              )}
              <div className={styles.cardRating}>
                <Star size={11} fill="#F59E0B" color="#F59E0B" />
                <span>{c.averageRating.toFixed(1)}</span>
                {c.totalReviews > 0 && (
                  <span className={styles.cardRatingCount}>({c.totalReviews})</span>
                )}
                <span className={styles.cardDot}>·</span>
                <span>{c.yearsExperience}y exp</span>
              </div>
            </div>
            <span className={styles.cardSavedDate}>{formatDate(saved.savedAt)}</span>
          </div>

          {c.specialties.length > 0 && (
            <div className={styles.cardPills}>
              {c.specialties.slice(0, 3).map((s) => (
                <span key={s} className={styles.cardPill}>{s}</span>
              ))}
            </div>
          )}

          {c.bio && <p className={styles.cardBio}>{c.bio}</p>}
        </div>

        {/* Quick actions */}
        <div className={styles.quickActions}>
          <button
            type="button"
            className={styles.quickBtn}
            onClick={() => setJobPickerOpen(true)}
          >
            <MessageSquare size={12} />
            Message
          </button>
          <Link to={`/contractors/${c.id}`} className={styles.quickBtn}>
            <ArrowUpRight size={12} />
            View Profile
          </Link>
          <div className={styles.moveWrap} ref={moveRef}>
            <button
              type="button"
              className={styles.quickBtn}
              onClick={() => setMoveOpen((v) => !v)}
              disabled={otherLists.length === 0}
            >
              <FolderInput size={12} />
              Move to List
            </button>
            {moveOpen && otherLists.length > 0 && (
              <div className={styles.moveDropdown}>
                {otherLists.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={styles.moveDropdownItem}
                    onClick={() => { onMove(l.id); setMoveOpen(false); }}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className={`${styles.quickBtn} ${styles.quickBtnDanger}`}
            onClick={onRemove}
          >
            <Trash2 size={12} />
            Remove
          </button>
        </div>

        {/* Note */}
        <NoteSection savedId={saved.id} initialNote={saved.note} />
      </div>

      {jobPickerOpen && (
        <JobPickerModal
          contractorName={c.firstName}
          contractorUserId={c.userId}
          onClose={() => setJobPickerOpen(false)}
        />
      )}
    </>
  );
}

// ── Contractor grid (right panel) ─────────────────────────────────────────────

function ContractorGrid({
  activeList,
  allLists,
}: {
  activeList: SavedListFE;
  allLists: SavedListFE[];
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [sort, setSort] = useState<SortKey>('recent');

  const { data: listData, isLoading } = useListContractors(activeList.id);
  const savedItems: SavedContractorFE[] = Array.isArray(listData) ? (listData as SavedContractorFE[]) : [];

  const removeMutation = useRemoveFromList();

  async function handleRemove(saved: SavedContractorFE) {
    try {
      await removeMutation.mutateAsync({ listId: saved.listId, savedId: saved.id });
      qc.invalidateQueries({ queryKey: ['saved-lists'] });
      toast(`Removed ${saved.contractor.firstName} from ${activeList.name}`, 'info');
    } catch {
      toast('Could not remove contractor. Please try again.', 'error');
    }
  }

  async function handleMove(saved: SavedContractorFE, targetListId: string) {
    try {
      await api.put(`/saved/contractors/${saved.id}/move`, { targetListId });
      qc.invalidateQueries({ queryKey: ['saved-list-contractors', activeList.id] });
      qc.invalidateQueries({ queryKey: ['saved-lists'] });
      const target = allLists.find((l) => l.id === targetListId);
      toast(`Moved ${saved.contractor.firstName} to ${target?.name ?? 'list'}`, 'success');
    } catch {
      toast('Could not move contractor. Please try again.', 'error');
    }
  }

  const sorted = sortContractors(savedItems, sort);

  return (
    <div className={styles.main}>
      <div className={styles.mainHeader}>
        <div>
          <h2 className={styles.mainTitle}>{activeList.name}</h2>
          <p className={styles.mainSubtitle}>{savedItems.length} saved</p>
        </div>
        <select
          className={styles.sortSelect}
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
        >
          <option value="recent">Recently Saved</option>
          <option value="rating">Highest Rated</option>
          <option value="experience">Most Experienced</option>
          <option value="alpha">Alphabetical</option>
        </select>
      </div>

      {isLoading && (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {!isLoading && sorted.length === 0 && (
        <div className={styles.emptyState}>
          <Bookmarks size={48} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>This list is empty</p>
          <p className={styles.emptySubtitle}>
            Browse contractors and click the bookmark icon to save them here.
          </p>
          <Link to="/contractors" className={styles.emptyBtn}>Browse Contractors</Link>
        </div>
      )}

      {!isLoading && sorted.length > 0 && (
        <div className={styles.grid}>
          {sorted.map((saved) => (
            <SavedContractorItem
              key={saved.id}
              saved={saved}
              activeList={activeList}
              allLists={allLists}
              onRemove={() => handleRemove(saved)}
              onMove={(targetListId) => handleMove(saved, targetListId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── List sidebar row ──────────────────────────────────────────────────────────

function ListRow({
  list,
  isActive,
  onActivate,
  onRename,
  onDelete,
}: {
  list: SavedListFE;
  isActive: boolean;
  onActivate: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [kebabOpen, setKebabOpen] = useState(false);
  const kebabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) {
        setKebabOpen(false);
      }
    }
    if (kebabOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [kebabOpen]);

  return (
    <div
      className={`${styles.listRow} ${isActive ? styles.listRowActive : ''}`}
      onClick={onActivate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onActivate()}
    >
      <div className={styles.listRowLeft}>
        <Bookmarks size={14} className={styles.listRowIcon} />
        <span className={styles.listName}>{list.name}</span>
        {list.isDefault && <span className={styles.defaultPill}>Default</span>}
      </div>
      <div className={styles.listRowRight} onClick={(e) => e.stopPropagation()}>
        <span className={styles.listCount}>{list.contractorCount}</span>
        <div className={styles.kebabWrap} ref={kebabRef}>
          <button
            type="button"
            className={styles.kebabBtn}
            onClick={(e) => { e.stopPropagation(); setKebabOpen((v) => !v); }}
          >
            <MoreVertical size={14} />
          </button>
          {kebabOpen && (
            <div className={styles.kebabMenu}>
              <button
                type="button"
                className={styles.kebabItem}
                onClick={() => { setKebabOpen(false); onRename(); }}
              >
                <Edit3 size={12} /> Rename
              </button>
              {!list.isDefault && (
                <button
                  type="button"
                  className={`${styles.kebabItem} ${styles.kebabItemDanger}`}
                  onClick={() => { setKebabOpen(false); onDelete(); }}
                >
                  <Trash2 size={12} /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function SavedContractorsPage() {
  const { toast } = useToast();

  const { data: listsData, isLoading: listsLoading } = useSavedLists();
  const lists: SavedListFE[] = Array.isArray(listsData) ? (listsData as SavedListFE[]) : [];

  const [activeListId, setActiveListId] = useState<string | null>(null);

  // Auto-activate default list on first load
  useEffect(() => {
    if (!activeListId && lists.length > 0) {
      const def = lists.find((l) => l.isDefault) ?? lists[0];
      setActiveListId(def.id);
    }
  }, [lists, activeListId]);

  const activeList = lists.find((l) => l.id === activeListId) ?? null;

  // ── New list form ──────────────────────────────────────────────────────────
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const createMutation = useCreateList();

  async function handleCreateList() {
    const name = newListName.trim();
    if (!name) return;
    try {
      const created = await createMutation.mutateAsync(name) as SavedListFE;
      setNewListName('');
      setShowNewListForm(false);
      setActiveListId(created.id);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(msg ?? 'Could not create list. Please try again.', 'error');
    }
  }

  // ── Rename ─────────────────────────────────────────────────────────────────
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameMutation = useRenameList();

  function startRename(list: SavedListFE) {
    setRenamingId(list.id);
    setRenameValue(list.name);
  }

  async function handleRename() {
    if (!renamingId) return;
    const name = renameValue.trim();
    if (!name) { setRenamingId(null); return; }
    try {
      await renameMutation.mutateAsync({ listId: renamingId, name });
      setRenamingId(null);
    } catch {
      toast('Could not rename list. Please try again.', 'error');
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  const [deletingList, setDeletingList] = useState<SavedListFE | null>(null);
  const deleteMutation = useDeleteList();

  async function handleDelete() {
    if (!deletingList) return;
    try {
      await deleteMutation.mutateAsync(deletingList.id);
      if (activeListId === deletingList.id) {
        const fallback = lists.find((l) => l.isDefault && l.id !== deletingList.id) ?? lists[0];
        setActiveListId(fallback?.id ?? null);
      }
      setDeletingList(null);
    } catch {
      toast('Could not delete list. Please try again.', 'error');
    }
  }

  const totalSaved = lists.reduce((sum, l) => sum + l.contractorCount, 0);
  const atListLimit = lists.length >= 10;

  return (
    <div className={styles.page}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Saved Contractors</h1>
        <p className={styles.pageSubtitle}>Manage your saved contractor lists and leave private notes.</p>
      </div>

      {/* Mobile tab bar (hidden on desktop) */}
      {lists.length > 0 && (
        <div className={styles.mobileTabs}>
          {lists.map((list) => (
            <button
              key={list.id}
              type="button"
              className={`${styles.mobileTab} ${activeListId === list.id ? styles.mobileTabActive : ''}`}
              onClick={() => setActiveListId(list.id)}
            >
              {list.name}
              <span className={styles.mobileTabCount}>{list.contractorCount}</span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.layout}>
        {/* ── Left sidebar (hidden on mobile) ───────────────────────────── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarTitle}>My Lists</span>
            {!atListLimit && (
              <button
                type="button"
                className={styles.newListBtn}
                onClick={() => setShowNewListForm(true)}
              >
                + New List
              </button>
            )}
          </div>

          {atListLimit && (
            <div className={styles.limitCallout}>
              <AlertTriangle size={13} />
              Maximum 10 lists reached
            </div>
          )}

          {showNewListForm && (
            <div className={styles.newListForm}>
              <input
                className={styles.newListInput}
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="List name"
                maxLength={50}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateList();
                  if (e.key === 'Escape') { setShowNewListForm(false); setNewListName(''); }
                }}
              />
              <div className={styles.newListActions}>
                <button
                  type="button"
                  className={styles.newListConfirm}
                  onClick={handleCreateList}
                  disabled={!newListName.trim() || createMutation.isPending}
                >
                  <Check size={12} />
                </button>
                <button
                  type="button"
                  className={styles.newListCancel}
                  onClick={() => { setShowNewListForm(false); setNewListName(''); }}
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          )}

          <div className={styles.listRows}>
            {listsLoading ? (
              <>
                <div className={styles.listRowSkeleton} />
                <div className={styles.listRowSkeleton} />
              </>
            ) : (
              lists.map((list) =>
                renamingId === list.id ? (
                  <div key={list.id} className={`${styles.listRow} ${styles.listRowActive}`}>
                    <input
                      className={styles.renameInput}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      maxLength={50}
                      autoFocus
                      onBlur={handleRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename();
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                    />
                    <div className={styles.listRowRight}>
                      <button type="button" className={styles.newListConfirm} onClick={handleRename}>
                        <Check size={12} />
                      </button>
                      <button type="button" className={styles.newListCancel} onClick={() => setRenamingId(null)}>
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <ListRow
                    key={list.id}
                    list={list}
                    isActive={activeListId === list.id}
                    onActivate={() => setActiveListId(list.id)}
                    onRename={() => startRename(list)}
                    onDelete={() => setDeletingList(list)}
                  />
                )
              )
            )}
          </div>

          <p className={styles.sidebarFooter}>
            {totalSaved} contractor{totalSaved !== 1 ? 's' : ''} saved across {lists.length} list{lists.length !== 1 ? 's' : ''}
          </p>
        </aside>

        {/* ── Right: contractor grid ──────────────────────────────────────── */}
        {activeList ? (
          <ContractorGrid activeList={activeList} allLists={lists} />
        ) : (
          !listsLoading && (
            <div className={styles.main}>
              <div className={styles.emptyState}>
                <Bookmarks size={48} className={styles.emptyIcon} />
                <p className={styles.emptyTitle}>No lists yet</p>
                <p className={styles.emptySubtitle}>
                  Create a list to start saving contractors.
                </p>
              </div>
            </div>
          )
        )}
      </div>

      {deletingList && (
        <ConfirmDeleteModal
          list={deletingList}
          onConfirm={handleDelete}
          onClose={() => setDeletingList(null)}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
