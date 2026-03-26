import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal, X, Check, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getContractors } from '../services/contractor.service';
import { ContractorCard } from '../components/contractor/ContractorCard';
import type { ContractorProfile } from '../types/contractor.types';
import styles from './ContractorsPage.module.css';

// ── Constants ──────────────────────────────────────────────────────────────

const SPECIALTY_OPTIONS = [
  { value: 'GENERAL',     label: 'General Contractor' },
  { value: 'ELECTRICAL',  label: 'Electrician'        },
  { value: 'PLUMBING',    label: 'Plumber'            },
  { value: 'HVAC',        label: 'HVAC'               },
  { value: 'ROOFING',     label: 'Roofer'             },
  { value: 'FLOORING',    label: 'Flooring'           },
  { value: 'PAINTING',    label: 'Painter'            },
  { value: 'LANDSCAPING', label: 'Landscaper'         },
  { value: 'DEMOLITION',  label: 'Demolition'         },
  { value: 'OTHER',       label: 'Other Trade'        },
];

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
  { value: 'WV', label: 'West Virginia'},  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── Debounce hook ──────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Skeleton card ──────────────────────────────────────────────────────────

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

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>
        <Search size={24} color="var(--color-text-muted)" strokeWidth={1.5} />
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6, letterSpacing: '-0.01em' }}>
        No contractors match your filters
      </p>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', maxWidth: 280, lineHeight: 1.6 }}>
        Try adjusting your search terms or broadening your filter criteria.
      </p>
    </div>
  );
}

// ── Star rating filter ─────────────────────────────────────────────────────

function StarFilter({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div>
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
              size={20}
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
    </div>
  );
}

// ── Availability mini toggle ───────────────────────────────────────────────

function AvailabilityToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={styles.toggleRow}>
      <span className={styles.toggleLabel}>Available now only</span>
      <div
        className={styles.toggle}
        style={{ background: checked ? 'var(--color-primary)' : 'var(--color-border)' }}
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
      >
        <div
          className={styles.toggleThumb}
          style={{ left: checked ? 21 : 3 }}
        />
      </div>
    </div>
  );
}

// ── Filter content ─────────────────────────────────────────────────────────

interface FilterContentProps {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
}

function FilterContent({ filters, onChange, onClear }: FilterContentProps) {
  const toggleSpecialty = (val: string) => {
    const next = filters.specialties.includes(val)
      ? filters.specialties.filter((s) => s !== val)
      : [...filters.specialties, val];
    onChange({ specialties: next });
  };

  const hasActiveFilters =
    filters.specialties.length > 0 ||
    filters.state !== '' ||
    filters.city !== '' ||
    filters.minRating !== null ||
    filters.available;

  return (
    <div className={styles.sidebarInner}>
      {/* Search */}
      <div className={styles.filterSection} style={{ paddingTop: 0 }}>
        <div className={styles.searchWrap}>
          <Search size={14} className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search contractors…"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
          />
        </div>
      </div>

      {/* Specialty */}
      <div className={styles.filterSection}>
        <p className={styles.filterTitle}>Specialty</p>
        <div className={styles.checkList}>
          {SPECIALTY_OPTIONS.map(({ value, label }) => {
            const checked = filters.specialties.includes(value);
            return (
              <label
                key={value}
                className={styles.checkItem}
                onClick={() => toggleSpecialty(value)}
              >
                <div className={`${styles.checkBox} ${checked ? styles.checkBoxChecked : ''}`}>
                  {checked && <Check size={10} strokeWidth={3} color="#fff" />}
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
      <div className={styles.filterSection}>
        <p className={styles.filterTitle}>Location</p>
        <select
          className={styles.stateSelect}
          value={filters.state}
          onChange={(e) => onChange({ state: e.target.value })}
          style={{ color: filters.state ? 'var(--color-text-primary)' : '#bbb' }}
        >
          <option value="">All states</option>
          {US_STATES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="City"
          value={filters.city}
          onChange={(e) => onChange({ city: e.target.value })}
          style={{ paddingLeft: 12 }}
        />
      </div>

      {/* Minimum rating */}
      <div className={styles.filterSection}>
        <p className={styles.filterTitle}>Minimum Rating</p>
        <StarFilter
          value={filters.minRating}
          onChange={(v) => onChange({ minRating: v })}
        />
      </div>

      {/* Availability */}
      <div className={styles.filterSection}>
        <AvailabilityToggle
          checked={filters.available}
          onChange={(v) => onChange({ available: v })}
        />
      </div>

      {/* Clear all */}
      {hasActiveFilters && (
        <div style={{ paddingTop: 16 }}>
          <button className={styles.clearBtn} onClick={onClear} type="button">
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function ContractorsPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>('rating');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const debouncedSearch = useDebounce(filters.search, 400);

  // API call — passes all filters except `specialties` (handled client-side)
  // so we can support multi-specialty selection without multiple round trips.
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

  // Client-side: specialty filter + sort
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
      return b.averageRating - a.averageRating; // default: rating
    });
  }, [data, filters.specialties, sort]);

  const updateFilters = (patch: Partial<Filters>) =>
    setFilters((prev) => ({ ...prev, ...patch }));

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-surface)' }}>
      {/* Navbar */}
      <nav className={styles.nav}>
        <Link to="/" className={styles.navWordmark}>BuildMatch</Link>
        <div className={styles.navLinks}>
          <Link to="/contractors" className={styles.navLink} style={{ color: 'var(--color-text-primary)' }}>
            Find Contractors
          </Link>
          <Link to="/login" className={styles.navLink}>Sign in</Link>
          <Link
            to="/register"
            style={{
              fontSize: 14, fontWeight: 500, color: '#fff',
              background: 'var(--color-primary)',
              padding: '7px 16px', borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
            }}
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Two-column layout */}
      <div className={styles.body}>
        {/* Filter sidebar — desktop */}
        <aside className={styles.sidebar}>
          <FilterContent
            filters={filters}
            onChange={updateFilters}
            onClear={clearFilters}
          />
        </aside>

        {/* Results */}
        <main className={styles.results}>
          {/* Meta bar */}
          <div className={styles.metaBar}>
            <span className={styles.resultCount}>
              {isLoading
                ? 'Loading…'
                : `${displayed.length} contractor${displayed.length !== 1 ? 's' : ''} found`}
            </span>

            <select
              className={styles.sortSelect}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="rating">Top Rated</option>
              <option value="experience">Most Experienced</option>
              <option value="newest">Newest</option>
            </select>

            <button
              className={styles.mobileFilterBtn}
              onClick={() => setDrawerOpen(true)}
              type="button"
            >
              <SlidersHorizontal size={14} strokeWidth={2} />
              Filters
              {(filters.specialties.length > 0 ||
                filters.state ||
                filters.city ||
                filters.minRating !== null ||
                filters.available) && (
                <span
                  style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--color-primary)', flexShrink: 0,
                  }}
                />
              )}
            </button>
          </div>

          {/* Grid */}
          <div className={styles.grid}>
            {isLoading ? (
              Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)
            ) : displayed.length === 0 ? (
              <EmptyState />
            ) : (
              displayed.map((c) => <ContractorCard key={c.id} contractor={c} />)
            )}
          </div>
        </main>
      </div>

      {/* Mobile bottom drawer */}
      {drawerOpen && (
        <>
          <div
            className={styles.backdrop}
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className={styles.drawer}>
            <div className={styles.drawerHandle}>
              <span className={styles.drawerTitle}>Filters</span>
              <button
                className={styles.drawerClose}
                onClick={() => setDrawerOpen(false)}
                aria-label="Close filters"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>
            <FilterContent
              filters={filters}
              onChange={updateFilters}
              onClear={() => { clearFilters(); setDrawerOpen(false); }}
            />
          </div>
        </>
      )}
    </div>
  );
}
