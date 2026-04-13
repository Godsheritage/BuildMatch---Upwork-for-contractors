import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, ChevronDown, ChevronUp, Check, Star, X, BookMarked } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getContractors } from '../services/contractor.service';
import { ContractorCard } from '../components/contractor/ContractorCard';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../hooks/useAuth';
import { useSavedContractors } from '../context/SavedContractorsContext';
import type { ContractorProfile } from '../types/contractor.types';
import styles from './ContractorsPage.module.css';

// ── Constants ──────────────────────────────────────────────────────────────

const SPECIALTY_KEYS = [
  'GENERAL', 'ELECTRICAL', 'PLUMBING', 'HVAC', 'ROOFING',
  'FLOORING', 'PAINTING', 'LANDSCAPING', 'DEMOLITION', 'OTHER',
] as const;

const US_STATES = [
  { value: 'AL', label: 'Alabama' },      { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },      { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },   { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },  { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'D.C.' },         { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },      { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },        { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },      { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },       { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },    { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },     { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },     { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },      { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },       { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },   { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },     { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' }, { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },     { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' }, { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina'},{ value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },    { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },         { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },     { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia'}, { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

// ── Types ───────────────────────────────────────────────────────────────────

interface Filters {
  search: string;
  specialties: string[];
  state: string;
  city: string;
  minRating: number | null;
  available: boolean;
}

type SortKey = 'rating' | 'experience' | 'newest';

const EMPTY_FILTERS: Filters = {
  search: '', specialties: [], state: '', city: '',
  minRating: null, available: false,
};

// ── Debounce hook ───────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Skeleton card ───────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className={styles.skeletonCard}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        <div className={styles.skeletonBlock} style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className={styles.skeletonBlock} style={{ height: 14, width: '55%', marginBottom: 8 }} />
          <div className={styles.skeletonBlock} style={{ height: 11, width: '38%' }} />
        </div>
      </div>
      <div className={styles.skeletonBlock} style={{ height: 11, width: '100%', marginBottom: 6 }} />
      <div className={styles.skeletonBlock} style={{ height: 11, width: '75%', marginBottom: 14 }} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[72, 60, 80].map((w, i) => (
          <div key={i} className={styles.skeletonBlock} style={{ height: 20, width: w, borderRadius: 20 }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, paddingTop: 12, borderTop: '1px solid #F0F0EE' }}>
        <div className={styles.skeletonBlock} style={{ height: 11, width: 50 }} />
        <div className={styles.skeletonBlock} style={{ height: 11, width: 40 }} />
        <div className={styles.skeletonBlock} style={{ height: 11, width: 64, marginLeft: 'auto' }} />
      </div>
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>
        <Search size={24} color="var(--color-text-muted)" strokeWidth={1.5} />
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6, letterSpacing: '-0.01em' }}>
        {title}
      </p>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', maxWidth: 280, lineHeight: 1.6 }}>
        {desc}
      </p>
    </div>
  );
}

// ── Star rating filter ──────────────────────────────────────────────────────

function StarFilter({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={styles.starBtn}
          onClick={() => onChange(value === n ? null : n)}
          aria-label={`${n} stars and up`}
        >
          <Star
            size={18}
            strokeWidth={1.5}
            fill={value !== null && n <= value ? 'var(--color-star)' : 'none'}
            color={value !== null && n <= value ? 'var(--color-star)' : 'var(--color-border)'}
          />
        </button>
      ))}
      {value !== null && (
        <span className={styles.starLabel}>{value}+ stars</span>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export function ContractorsPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const { totalSaved } = useSavedContractors();
  const [searchParams] = useSearchParams();
  const isInvestor = user?.role === 'INVESTOR';
  const [filters, setFilters] = useState<Filters>({
    ...EMPTY_FILTERS,
    search: searchParams.get('search') ?? '',
  });
  const [sort, setSort] = useState<SortKey>('rating');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const debouncedSearch = useDebounce(filters.search, 400);

  const { data, isLoading } = useQuery({
    queryKey: [
      'contractors',
      debouncedSearch,
      filters.state,
      filters.city,
      filters.minRating,
      filters.available,
    ],
    queryFn: () =>
      getContractors({
        search:    debouncedSearch   || undefined,
        state:     filters.state     || undefined,
        city:      filters.city      || undefined,
        minRating: filters.minRating ?? undefined,
        available: filters.available || undefined,
      }),
    staleTime: 30_000,
  });

  const displayed = useMemo<ContractorProfile[]>(() => {
    let list = data?.contractors ?? [];
    if (filters.specialties.length > 0) {
      list = list.filter((c) =>
        c.specialties.some((s) => filters.specialties.includes(s)),
      );
    }
    return [...list].sort((a, b) => {
      if (sort === 'experience') return b.yearsExperience - a.yearsExperience;
      if (sort === 'newest')
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return b.averageRating - a.averageRating;
    });
  }, [data, filters.specialties, sort]);

  const updateFilters = (patch: Partial<Filters>) =>
    setFilters((prev) => ({ ...prev, ...patch }));

  const toggleSpecialty = (val: string) => {
    const next = filters.specialties.includes(val)
      ? filters.specialties.filter((s) => s !== val)
      : [...filters.specialties, val];
    updateFilters({ specialties: next });
  };

  const activeFilterCount = [
    filters.specialties.length > 0,
    !!filters.state,
    !!filters.city,
    filters.minRating !== null,
    filters.available,
  ].filter(Boolean).length;

  return (
    <div className={styles.page}>

      {/* ── Sticky filter toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarTop}>

          {/* Search */}
          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="search"
              className={styles.searchInput}
              placeholder={t.contractors.search}
              value={filters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
            />
          </div>

          {/* Filters toggle */}
          <button
            type="button"
            className={`${styles.filtersBtn} ${filterPanelOpen ? styles.filtersBtnActive : ''}`}
            onClick={() => setFilterPanelOpen((o) => !o)}
          >
            <SlidersHorizontal size={14} strokeWidth={2} />
            {t.contractors.filters}
            {activeFilterCount > 0 && (
              <span className={styles.filterCount}>{activeFilterCount}</span>
            )}
            {filterPanelOpen
              ? <ChevronUp size={13} strokeWidth={2} />
              : <ChevronDown size={13} strokeWidth={2} />
            }
          </button>

          {/* Sort */}
          <select
            className={styles.sortSelect}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="rating">{t.contractors.sort.topRated}</option>
            <option value="experience">{t.contractors.sort.mostExperienced}</option>
            <option value="newest">{t.contractors.sort.newest}</option>
          </select>

          {/* Count */}
          <span className={styles.resultCount}>
            {isLoading
              ? 'Loading…'
              : `${displayed.length} ${displayed.length !== 1 ? t.contractors.foundPlural : t.contractors.found}`
            }
          </span>
        </div>

        {/* Expanded filter panel */}
        {filterPanelOpen && (
          <div className={styles.filterPanel}>

            {/* Specialty */}
            <div className={styles.filterGroup}>
              <p className={styles.filterGroupTitle}>{t.contractors.filterGroups.specialty}</p>
              <div className={styles.specialtyGrid}>
                {SPECIALTY_KEYS.map((key) => {
                  const checked = filters.specialties.includes(key);
                  const label = t.specialties[key as keyof typeof t.specialties] ?? key;
                  return (
                    <label key={key} className={styles.checkItem} onClick={() => toggleSpecialty(key)}>
                      <div className={`${styles.checkBox} ${checked ? styles.checkBoxChecked : ''}`}>
                        {checked && <Check size={9} strokeWidth={3} color="#fff" />}
                      </div>
                      <span className={`${styles.checkLabel} ${checked ? styles.checkLabelChecked : ''}`}>
                        {label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Location */}
            <div className={styles.filterGroup}>
              <p className={styles.filterGroupTitle}>{t.contractors.filterGroups.location}</p>
              <select
                className={styles.stateSelect}
                value={filters.state}
                onChange={(e) => updateFilters({ state: e.target.value })}
                style={{ color: filters.state ? 'var(--color-text-primary)' : '#bbb' }}
              >
                <option value="">{t.contractors.allStates}</option>
                {US_STATES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <input
                type="text"
                className={styles.cityInput}
                placeholder={t.contractors.city}
                value={filters.city}
                onChange={(e) => updateFilters({ city: e.target.value })}
              />
            </div>

            {/* Rating */}
            <div className={styles.filterGroup}>
              <p className={styles.filterGroupTitle}>{t.contractors.filterGroups.minRating}</p>
              <StarFilter value={filters.minRating} onChange={(v) => updateFilters({ minRating: v })} />
            </div>

            {/* Availability */}
            <div className={styles.filterGroup}>
              <p className={styles.filterGroupTitle}>{t.contractors.filterGroups.availability}</p>
              <div
                className={styles.toggleRow}
                onClick={() => updateFilters({ available: !filters.available })}
                role="switch"
                aria-checked={filters.available}
              >
                <span className={styles.toggleLabel}>{t.contractors.available}</span>
                <div
                  className={styles.toggle}
                  style={{ background: filters.available ? 'var(--color-primary)' : 'var(--color-border)' }}
                >
                  <div className={styles.toggleThumb} style={{ left: filters.available ? 21 : 3 }} />
                </div>
              </div>
            </div>

            {/* Clear */}
            {activeFilterCount > 0 && (
              <div className={styles.filterGroupClear}>
                <button
                  type="button"
                  className={styles.clearBtn}
                  onClick={() => { setFilters(EMPTY_FILTERS); setFilterPanelOpen(false); }}
                >
                  <X size={12} strokeWidth={2} />
                  {t.contractors.clearAll}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Saved contractors banner (investor only) ── */}
      {isInvestor && totalSaved > 0 && (
        <div className={styles.savedBanner}>
          <div className={styles.savedBannerLeft}>
            <BookMarked size={14} className={styles.savedBannerIcon} />
            You have {totalSaved} saved contractor{totalSaved !== 1 ? 's' : ''}
          </div>
          <Link to="/dashboard/saved" className={styles.savedBannerLink}>
            View Saved List
          </Link>
        </div>
      )}

      {/* ── Results grid ── */}
      <main className={styles.results}>
        <div className={styles.grid}>
          {isLoading ? (
            Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)
          ) : displayed.length === 0 ? (
            <EmptyState title={t.contractors.noMatch} desc={t.contractors.noMatchDesc} />
          ) : (
            displayed.map((c) => <ContractorCard key={c.id} contractor={c} />)
          )}
        </div>
      </main>
    </div>
  );
}
