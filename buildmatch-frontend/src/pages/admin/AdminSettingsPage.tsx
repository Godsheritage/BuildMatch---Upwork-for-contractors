/**
 * src/pages/admin/AdminSettingsPage.tsx
 *
 * Section 1: Platform Configuration — targeted rows for known settings keys
 * Section 2: Feature Flags — table with live toggle + rollout-% editing
 * Section 3: Contact Filter Patterns — table + Add-Pattern modal (with regex live test)
 */

import { useState, useId } from 'react';
import { AdminPageHeader } from '../../components/admin/shared/AdminPageHeader';
import { ConfirmModal }    from '../../components/admin/shared/ConfirmModal';
import {
  useAdminSettingsAll,
  useUpdateSettingWithNote,
  useUpdateFeatureFlagViaSettings,
  useFilterPatterns,
  useAddFilterPattern,
  useDeleteFilterPattern,
} from '../../hooks/useAdmin';
import type { FilterPattern } from '../../services/admin.service';
import sh from './admin-shared.module.css';
import s  from './AdminSettingsPage.module.css';

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Toggle ─────────────────────────────────────────────────────────────────────

function Toggle({
  checked, onChange, danger = false, disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={`${s.toggle} ${checked ? (danger ? s.toggleDanger : s.toggleOn) : s.toggleOff}`}
      disabled={disabled}
    >
      <span className={s.toggleThumb} />
    </button>
  );
}

// ── Section 1: Platform Configuration ─────────────────────────────────────────

const KNOWN_SETTING_KEYS = [
  {
    key:   'transaction_fee_pct',
    label: 'Transaction Fee %',
    type:  'number' as const,
    desc:  'Platform fee charged on each completed job (percentage)',
  },
  {
    key:   'max_free_tier_bids',
    label: 'Max Free Tier Bids',
    type:  'number' as const,
    desc:  'Maximum bids allowed per contractor per month on the free plan',
  },
  {
    key:    'allow_new_registrations',
    label:  'Allow New Registrations',
    type:   'boolean' as const,
    desc:   'When off, the register form shows a "coming soon" message',
  },
  {
    key:     'maintenance_mode',
    label:   'Maintenance Mode',
    type:    'boolean' as const,
    desc:    'Displays a maintenance banner to all users across the platform',
    dangerous: true,
  },
] as const;

function NumberSettingRow({
  label, desc, value, onSave, isPending,
}: {
  label: string;
  desc: string;
  value: number;
  onSave: (v: number) => void;
  isPending: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  const [dirty, setDirty] = useState(false);

  function handleChange(raw: string) {
    setDraft(raw);
    setDirty(raw !== String(value));
  }

  function save() {
    const n = parseFloat(draft);
    if (isNaN(n)) return;
    onSave(n);
    setDirty(false);
  }

  return (
    <div className={s.configRow}>
      <div className={s.configLabel}>
        <span className={s.configLabelMain}>{label}</span>
        <span className={s.configLabelDesc}>{desc}</span>
      </div>
      <div className={s.configControl}>
        <input
          type="number"
          className={s.numberInput}
          value={draft}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setDraft(String(value)); setDirty(false); } }}
          min={0}
          step={0.01}
        />
        <button
          className={`${sh.actionBtn} ${sh.actionBtnNavy} ${s.saveBtn}`}
          disabled={!dirty || isPending}
          onClick={save}
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function BooleanSettingRow({
  label, desc, value, onToggle, isPending, dangerous,
}: {
  label: string;
  desc: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  isPending: boolean;
  dangerous?: boolean;
}) {
  return (
    <div className={s.configRow}>
      <div className={s.configLabel}>
        <span className={s.configLabelMain}>{label}</span>
        <span className={s.configLabelDesc}>{desc}</span>
      </div>
      <div className={s.configControl}>
        <Toggle
          checked={value}
          onChange={onToggle}
          danger={dangerous}
          disabled={isPending}
        />
        {dangerous && value && (
          <span className={s.dangerBadge}>ON</span>
        )}
      </div>
    </div>
  );
}

function PlatformConfigSection() {
  const { data: allData, isLoading } = useAdminSettingsAll();
  const { mutate: save, isPending }  = useUpdateSettingWithNote();
  const [confirmMaint, setConfirmMaint] = useState(false);

  const settings = allData?.settings ?? [];

  function getVal(key: string): unknown {
    return settings.find(s => s.key === key)?.value ?? null;
  }

  function handleToggle(key: string, val: boolean, dangerous: boolean) {
    if (dangerous && val) {
      // Show confirm before enabling maintenance mode
      setConfirmMaint(true);
      return;
    }
    save({ key, value: val, note: dangerous ? 'Maintenance mode toggled' : undefined });
  }

  function doEnableMaintenance() {
    save({ key: 'maintenance_mode', value: true, note: 'Maintenance mode enabled by admin' });
    setConfirmMaint(false);
  }

  if (isLoading) {
    return (
      <div className={s.card}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={s.configRow}>
            <div className={s.configLabel}>
              <div className={sh.skeletonLine} style={{ width: 160, marginBottom: 6 }} />
              <div className={sh.skeletonLine} style={{ width: 280 }} />
            </div>
            <div className={sh.skeletonLine} style={{ width: 80 }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className={s.card}>
        {KNOWN_SETTING_KEYS.map(def => {
          const raw = getVal(def.key);
          if (def.type === 'number') {
            return (
              <NumberSettingRow
                key={def.key}
                label={def.label}
                desc={def.desc}
                value={typeof raw === 'number' ? raw : 0}
                onSave={v => save({ key: def.key, value: v })}
                isPending={isPending}
              />
            );
          }
          return (
            <BooleanSettingRow
              key={def.key}
              label={def.label}
              desc={def.desc}
              value={raw === true}
              onToggle={v => handleToggle(def.key, v, !!('dangerous' in def && def.dangerous))}
              isPending={isPending}
              dangerous={'dangerous' in def && !!def.dangerous}
            />
          );
        })}
      </div>

      <ConfirmModal
        isOpen={confirmMaint}
        onClose={() => setConfirmMaint(false)}
        onConfirm={doEnableMaintenance}
        title="Enable Maintenance Mode"
        message="This will show a maintenance banner to all users. Active sessions will not be interrupted, but new actions may be blocked depending on your middleware configuration."
        confirmLabel="Enable Maintenance Mode"
        variant="warning"
      />
    </>
  );
}

// ── Section 2: Feature Flags ───────────────────────────────────────────────────

function RolloutInput({
  value, enabled, onSave, isPending,
}: {
  value: number;
  enabled: boolean;
  onSave: (v: number) => void;
  isPending: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  const [dirty, setDirty] = useState(false);

  function handleSave() {
    const n = parseInt(draft, 10);
    if (isNaN(n) || n < 0 || n > 100) return;
    onSave(n);
    setDirty(false);
  }

  if (!enabled) {
    return <span className={sh.mutedCell}>—</span>;
  }

  return (
    <div className={s.rolloutCell}>
      <input
        type="number"
        className={s.rolloutInput}
        value={draft}
        min={0}
        max={100}
        onChange={e => { setDraft(e.target.value); setDirty(e.target.value !== String(value)); }}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
        disabled={isPending}
      />
      <span className={s.rolloutPct}>%</span>
      {dirty && (
        <button
          className={`${sh.actionBtn} ${sh.actionBtnNavy}`}
          style={{ padding: '2px 8px', fontSize: 11 }}
          onClick={handleSave}
          disabled={isPending}
        >
          Save
        </button>
      )}
    </div>
  );
}

function FeatureFlagsSection() {
  const { data: allData, isLoading }       = useAdminSettingsAll();
  const { mutate: updateFlag, isPending }  = useUpdateFeatureFlagViaSettings();

  const flags = allData?.flags ?? [];

  if (isLoading) {
    return (
      <div className={sh.tableWrap}>
        <table className={sh.table}>
          <thead><tr><th>Feature</th><th>Description</th><th>Enabled</th><th>Rollout %</th><th>Last Updated</th></tr></thead>
          <tbody>
            {[1, 2, 3].map(i => (
              <tr key={i} className={sh.skeletonRow}>
                {[160, 240, 60, 60, 100].map((w, j) => (
                  <td key={j}><div className={sh.skeletonLine} style={{ width: w }} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={sh.tableWrap}>
      <table className={sh.table}>
        <thead>
          <tr>
            <th>Feature</th>
            <th>Description</th>
            <th>Enabled</th>
            <th>Rollout %</th>
            <th>Last Updated</th>
          </tr>
        </thead>
        <tbody>
          {flags.length === 0 ? (
            <tr className={sh.emptyRow}><td colSpan={5}>No feature flags configured</td></tr>
          ) : flags.map(flag => (
            <tr key={flag.key}>
              <td>
                <code className={s.flagKey}>{flag.key}</code>
              </td>
              <td className={sh.mutedCell}>{flag.description ?? '—'}</td>
              <td>
                <Toggle
                  checked={flag.enabled}
                  onChange={enabled => updateFlag({ key: flag.key, enabled })}
                  disabled={isPending}
                />
              </td>
              <td>
                <RolloutInput
                  value={flag.rolloutPct}
                  enabled={flag.enabled}
                  onSave={pct => updateFlag({ key: flag.key, enabled: flag.enabled, rolloutPct: pct })}
                  isPending={isPending}
                />
              </td>
              <td className={sh.mutedCell} style={{ whiteSpace: 'nowrap' }}>
                {flag.updatedAt ? fmtDate(flag.updatedAt) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Section 3: Contact Filter Patterns ────────────────────────────────────────

const PATTERN_TYPES = ['phone', 'email', 'social', 'payment', 'url'] as const;
type PatternType = (typeof PATTERN_TYPES)[number];

function AddPatternModal({ onClose }: { onClose: () => void }) {
  const [pattern,     setPattern]     = useState('');
  const [type,        setType]        = useState<PatternType>('phone');
  const [description, setDescription] = useState('');
  const [testInput,   setTestInput]   = useState('');
  const [testResult,  setTestResult]  = useState<boolean | null>(null);
  const [regexError,  setRegexError]  = useState('');

  const { mutate: add, isPending } = useAddFilterPattern();
  const labelId = useId();

  function validateRegex(raw: string): boolean {
    setRegexError('');
    if (!raw) return false;
    try {
      new RegExp(raw);
      return true;
    } catch (e) {
      setRegexError(e instanceof Error ? e.message : 'Invalid regex');
      return false;
    }
  }

  function handlePatternChange(raw: string) {
    setPattern(raw);
    setTestResult(null);
    validateRegex(raw);
  }

  function runTest() {
    if (!validateRegex(pattern) || !testInput) return;
    try {
      setTestResult(new RegExp(pattern).test(testInput));
    } catch {
      setTestResult(false);
    }
  }

  function handleSubmit() {
    if (!validateRegex(pattern) || !pattern.trim()) return;
    add({ pattern: pattern.trim(), type, description: description.trim() }, { onSuccess: onClose });
  }

  return (
    <div className={sh.backdrop} onClick={onClose}>
      <div className={`${sh.modal} ${s.addPatternModal}`} onClick={e => e.stopPropagation()}>
        <h3 className={sh.modalTitle}>Add Filter Pattern</h3>

        {/* Pattern input */}
        <label className={s.fieldLabel} htmlFor={`${labelId}-pattern`}>Regex Pattern</label>
        <input
          id={`${labelId}-pattern`}
          className={`${sh.searchInput} ${s.patternInput} ${regexError ? s.inputError : ''}`}
          placeholder="e.g. \\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b"
          value={pattern}
          onChange={e => handlePatternChange(e.target.value)}
          autoFocus
          style={{ fontFamily: 'monospace', maxWidth: '100%', width: '100%' }}
        />
        {regexError && <p className={s.errorText}>{regexError}</p>}

        {/* Test area */}
        <div className={s.testRow}>
          <input
            className={sh.searchInput}
            style={{ flex: 1, maxWidth: '100%' }}
            placeholder="Paste example text to test…"
            value={testInput}
            onChange={e => { setTestInput(e.target.value); setTestResult(null); }}
          />
          <button
            className={`${sh.actionBtn} ${sh.actionBtnAmber}`}
            onClick={runTest}
            disabled={!pattern || !!regexError || !testInput}
          >
            Test Pattern
          </button>
        </div>
        {testResult !== null && (
          <p className={testResult ? s.testPass : s.testFail}>
            {testResult ? '✓ Pattern matches' : '✗ No match'}
          </p>
        )}

        {/* Type */}
        <label className={s.fieldLabel} htmlFor={`${labelId}-type`}>Type</label>
        <select
          id={`${labelId}-type`}
          className={sh.modalSelect}
          value={type}
          onChange={e => setType(e.target.value as PatternType)}
          style={{ marginBottom: 'var(--space-3)' }}
        >
          {PATTERN_TYPES.map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>

        {/* Description */}
        <label className={s.fieldLabel} htmlFor={`${labelId}-desc`}>Description (optional)</label>
        <input
          id={`${labelId}-desc`}
          className={sh.searchInput}
          style={{ maxWidth: '100%', width: '100%', marginBottom: 'var(--space-5)' }}
          placeholder="What does this pattern catch?"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />

        <div className={sh.modalActions}>
          <button className={`${sh.actionBtn} ${sh.actionBtnGhost}`} onClick={onClose} disabled={isPending}>
            Cancel
          </button>
          <button
            className={`${sh.actionBtn} ${sh.actionBtnNavy}`}
            onClick={handleSubmit}
            disabled={!pattern.trim() || !!regexError || isPending}
          >
            {isPending ? 'Adding…' : 'Add Pattern'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterPatternsSection() {
  const { data, isLoading }              = useFilterPatterns();
  const { mutate: del, isPending: deleting } = useDeleteFilterPattern();
  const [showAdd,     setShowAdd]        = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FilterPattern | null>(null);

  const patterns = data?.patterns ?? [];

  return (
    <>
      {/* Callout */}
      <div className={s.callout}>
        Changes take effect immediately for all new messages
      </div>

      <div className={sh.tableWrap} style={{ marginBottom: 'var(--space-4)' }}>
        <table className={sh.table}>
          <thead>
            <tr>
              <th>Pattern</th>
              <th>Type</th>
              <th>Description</th>
              <th>Added</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className={sh.skeletonRow}>
                  {[200, 60, 180, 80, 60].map((w, j) => (
                    <td key={j}><div className={sh.skeletonLine} style={{ width: w }} /></td>
                  ))}
                </tr>
              ))
            ) : patterns.length === 0 ? (
              <tr className={sh.emptyRow}><td colSpan={5}>No filter patterns configured</td></tr>
            ) : patterns.map(p => (
              <tr key={p.id}>
                <td><code className={s.patternCode}>{p.pattern}</code></td>
                <td>
                  <span className={`${sh.badge} ${s[`typeBadge_${p.type}`] ?? s.typeBadgeDefault}`}>
                    {p.type}
                  </span>
                </td>
                <td className={sh.mutedCell}>{p.description || '—'}</td>
                <td className={sh.mutedCell} style={{ whiteSpace: 'nowrap' }}>{fmtDate(p.addedAt)}</td>
                <td>
                  <button
                    className={`${sh.actionBtn} ${sh.actionBtnRed}`}
                    onClick={() => setDeleteTarget(p)}
                    disabled={deleting}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        className={`${sh.actionBtn} ${sh.actionBtnNavy}`}
        style={{ padding: '6px 16px' }}
        onClick={() => setShowAdd(true)}
      >
        + Add Pattern
      </button>

      {showAdd && <AddPatternModal onClose={() => setShowAdd(false)} />}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          del(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
        title="Delete Filter Pattern"
        message={`Remove the pattern "${deleteTarget?.pattern}"? This will stop filtering this pattern from new messages immediately.`}
        confirmLabel="Delete Pattern"
        variant="danger"
        isLoading={deleting}
      />
    </>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={s.section}>
      <h2 className={s.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminSettingsPage() {
  return (
    <div className={sh.page}>
      <AdminPageHeader title="Platform Settings" />

      <Section title="Platform Configuration">
        <PlatformConfigSection />
      </Section>

      <Section title="Feature Flags">
        <FeatureFlagsSection />
      </Section>

      <Section title="Contact Filter Patterns">
        <FilterPatternsSection />
      </Section>
    </div>
  );
}
