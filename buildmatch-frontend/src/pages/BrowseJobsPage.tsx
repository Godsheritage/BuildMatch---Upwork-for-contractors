import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X, Check, Briefcase } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getJobs } from '../services/job.service';
import { JobCard } from '../components/job/JobCard';
import type { JobPost } from '../types/job.types';
import styles from './BrowseJobsPage.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const TRADE_OPTIONS = [
  { value: 'GENERAL',     label: 'General Contractor' },
  { value: 'ELECTRICAL',  label: 'Electrical'         },
  { value: 'PLUMBING',    label: 'Plumbing'           },
  { value: 'HVAC',        label: 'HVAC'               },
  { value: 'ROOFING',     label: 'Roofing'            },
  { value: 'FLOORING',    label: 'Flooring'           },
  { value: 'PAINTING',    label: 'Painting'           },
  { value: 'LANDSCAPING', label: 'Landscaping'        },
  { value: 'DEMOLITION',  label: 'Demolition'         },
  { value: 'OTHER',       label: 'Other Trade'        },
];

const US_STATES = [
  { value: 'AL', label: 'Alabama' },       { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },       { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },    { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },   { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'D.C.' },          { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },       { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },         { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },       { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },        { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },     { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },      { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },      { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },   { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },       { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },        { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },    { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },      { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },      { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },{ value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },     { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },          { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },      { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' }, { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

const PAGE_SIZE = 10;

// ── Types ─────────────────────────────────────────────────────────────────────

type PostedWithin = 'any' | '7d' | '30d';
type SortKey      = 'newest' | 'budgetHigh' | 'budgetLow';

interface Filters {
  search:       string;
  tradeTypes:   string[];
  state:        string;
  city:         string;
  minBudget:    string;
  maxBudget:    string;
  postedWithin: PostedWithin;
}

const EMPTY_FILTERS: Filters = {
  search: '', tradeTypes: [], state: '', city: '',
  minBudget: '', maxBudget: '', postedWithin: 'any',
};

// ── URL helpers ───────────────────────────────────────────────────────────────

function filtersFromParams(p: URLSearchParams): Filters {
  return {
    search:       p.get('search')                || '',
    tradeTypes:   p.getAll('trade'),
    state:        p.get('state')                 || '',
    city:         p.get('city')                  || '',
    minBudget:    p.get('minBudget')             || '',
    maxBudget:    p.get('maxBudget')             || '',
    postedWithin: (p.get('within') as PostedWithin) || 'any',
  };
}

function buildParams(f: Filters, sort: SortKey, page: number): URLSearchParams {
  const p = new URLSearchParams();
  if (f.search)                  p.set('search',    f.search);
  f.tradeTypes.forEach((t) =>    p.append('trade',  t));
  if (f.state)                   p.set('state',     f.state);
  if (f.city)                    p.set('city',      f.city);
  if (f.minBudget)               p.set('minBudget', f.minBudget);
  if (f.maxBudget)               p.set('maxBudget', f.maxBudget);
  if (f.postedWithin !== 'any')  p.set('within',    f.postedWithin);
  if (sort !== 'newest')         p.set('sort',      sort);
  if (page > 1)                  p.set('page',      String(page));
  return p;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Filter panel ──────────────────────────────────────────────────────────────

interface FilterPanelProps {
  filters:  Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClear:  () => void;
}

function FilterPanel({ filters, onChange, onClear }: FilterPanelProps) {
  const toggleTrade = (val: string) => {
    const next = filters.tradeTypes.includes(val)
      ? filters.tradeTypes.filter((t) => t !== val)
      : [...filters.tradeTypes, val];
    onChange({ tradeTypes: next });
  };

  const hasActive =
    filters.search !== ''         ||
    filters.tradeTypes.length > 0 ||
    filters.state !== ''          ||
    filters.city !== ''           ||
    filters.minBudget !== ''      ||
    filters.maxBudget !== ''      ||
    filters.postedWithin !== 'any';

  return (
    <div className={styles.filterInner}>

      {/* Search */}
      <div className={styles.filterSection} style={{ paddingTop: 0 }}>
        <div className={styles.searchWrap}>
          <Search size={13} className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search jobs…"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
          />
        </div>
      </div>

      {/* Trade type */}
      <div className={styles.filterSection}>
        <p className={styles.filterTitle}>Trade Type</p>
        <div className={styles.checkList}>
          {TRADE_OPTIONS.map(({ value, label }) => {
            const checked = filters.tradeTypes.includes(value);
            return (
              <label key={value} className={styles.checkItem} onClick={() => toggleTrade(value)}>
                <div className={`${styles.checkBox} ${checked ? styles.checkBoxChecked : ''}`}>
                  {checked && <Check size={9} strokeWidth={3} color="#fff" />}
                </div>
                <span className={`${styles.checkLabel} ${checked ? styles.checkLabelActive : ''}`}>
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
          style={{ paddingLeft: 10, marginTop: 6 }}
        />
      </div>

      {/* Budget */}
      <div className={styles.filterSection}>
        <p className={styles.filterTitle}>Budget Range</p>
        <div className={styles.budgetRow}>
          <div className={styles.budgetField}>
            <span className={styles.budgetPrefix}>$</span>
            <input type="number" className={styles.budgetInput} placeholder="Min" min="0"
              value={filters.minBudget} onChange={(e) => onChange({ minBudget: e.target.value })} />
          </div>
          <span className={styles.budgetSep}>—</span>
          <div className={styles.budgetField}>
            <span className={styles.budgetPrefix}>$</span>
            <input type="number" className={styles.budgetInput} placeholder="Max" min="0"
              value={filters.maxBudget} onChange={(e) => onChange({ maxBudget: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Posted within */}
      <div className={styles.filterSection}>
        <p className={styles.filterTitle}>Posted Within</p>
        <div className={styles.radioList}>
          {(
            [
              { value: 'any', label: 'Any time'     },
              { value: '7d',  label: 'Last 7 days'  },
              { value: '30d', label: 'Last 30 days' },
            ] as { value: PostedWithin; label: string }[]
          ).map(({ value, label }) => {
            const active = filters.postedWithin === value;
            return (
              <label key={value} className={styles.radioItem} onClick={() => onChange({ postedWithin: value })}>
                <div className={`${styles.radioCircle} ${active ? styles.radioCircleActive : ''}`}>
                  {active && <div className={styles.radioDot} />}
                </div>
                <span className={`${styles.checkLabel} ${active ? styles.checkLabelActive : ''}`}>{label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {hasActive && (
        <div style={{ paddingTop: 12 }}>
          <button className={styles.clearBtn} onClick={onClear} type="button">
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ current, total, onChange }: {
  current: number; total: number; onChange: (p: number) => void;
}) {
  if (total <= 1) return null;
  const pages: (number | '…')[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push('…');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push('…');
    pages.push(total);
  }
  return (
    <div className={styles.pagination}>
      <button className={styles.pageBtn} disabled={current === 1} onClick={() => onChange(current - 1)}>← Prev</button>
      {pages.map((p, i) =>
        p === '…'
          ? <span key={`e${i}`} className={styles.pageEllipsis}>…</span>
          : <button key={p} className={`${styles.pageBtn} ${current === p ? styles.pageBtnActive : ''}`} onClick={() => onChange(p as number)}>{p}</button>
      )}
      <button className={styles.pageBtn} disabled={current === total} onClick={() => onChange(current + 1)}>Next →</button>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className={styles.skeletonCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className={styles.skeletonBlock} style={{ height: 18, width: 80, borderRadius: 20 }} />
        <div className={styles.skeletonBlock} style={{ height: 13, width: 50 }} />
      </div>
      <div className={styles.skeletonBlock} style={{ height: 18, width: '65%', marginBottom: 8 }} />
      <div className={styles.skeletonBlock} style={{ height: 12, width: 120, marginBottom: 14 }} />
      <div className={styles.skeletonBlock} style={{ height: 12, width: '100%', marginBottom: 5 }} />
      <div className={styles.skeletonBlock} style={{ height: 12, width: '80%', marginBottom: 5 }} />
      <div className={styles.skeletonBlock} style={{ height: 12, width: '55%', marginBottom: 14 }} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function BrowseJobsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters,     setFilters]     = useState<Filters>(() => filtersFromParams(searchParams));
  const [sort,        setSort]        = useState<SortKey>(() => (searchParams.get('sort') as SortKey) || 'newest');
  const [page,        setPage]        = useState(() => parseInt(searchParams.get('page') || '1', 10));
  const [filterOpen,  setFilterOpen]  = useState(false);

  const debouncedSearch    = useDebounce(filters.search,    400);
  const debouncedCity      = useDebounce(filters.city,      400);
  const debouncedMinBudget = useDebounce(filters.minBudget, 400);
  const debouncedMaxBudget = useDebounce(filters.maxBudget, 400);

  useEffect(() => {
    setSearchParams(buildParams(filters, sort, page), { replace: true });
  }, [filters, sort, page, setSearchParams]);

  const { data, isLoading } = useQuery({
    queryKey: [
      'jobs', 'browse',
      debouncedSearch, filters.state, debouncedCity,
      debouncedMinBudget, debouncedMaxBudget,
    ],
    queryFn: () => getJobs({
      search:    debouncedSearch    || undefined,
      state:     filters.state      || undefined,
      city:      debouncedCity      || undefined,
      minBudget: debouncedMinBudget ? parseFloat(debouncedMinBudget) : undefined,
      maxBudget: debouncedMaxBudget ? parseFloat(debouncedMaxBudget) : undefined,
      status:    'OPEN',
      limit:     50,
    }),
    staleTime: 30_000,
  });

  const processed = useMemo<JobPost[]>(() => {
    let list = data?.jobs ?? [];
    if (filters.tradeTypes.length > 0) {
      list = list.filter((j) => filters.tradeTypes.includes(j.tradeType));
    }
    if (filters.postedWithin !== 'any') {
      const cutoff = Date.now() - (filters.postedWithin === '7d' ? 7 : 30) * 86_400_000;
      list = list.filter((j) => new Date(j.createdAt).getTime() >= cutoff);
    }
    return [...list].sort((a, b) => {
      if (sort === 'budgetHigh') return b.budgetMax - a.budgetMax;
      if (sort === 'budgetLow')  return a.budgetMin - b.budgetMin;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [data, filters.tradeTypes, filters.postedWithin, sort]);

  const totalPages  = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems   = processed.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const hasActiveFilters =
    filters.search !== ''         ||
    filters.tradeTypes.length > 0 ||
    filters.state !== ''          ||
    filters.city !== ''           ||
    filters.minBudget !== ''      ||
    filters.maxBudget !== ''      ||
    filters.postedWithin !== 'any';

  const updateFilters = (patch: Partial<Filters>) => { setFilters((p) => ({ ...p, ...patch })); setPage(1); };
  const clearFilters  = () => { setFilters(EMPTY_FILTERS); setPage(1); };

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Browse Jobs</h1>
          <p className={styles.subtitle}>
            {isLoading ? '…' : `${processed.length} open job${processed.length !== 1 ? 's' : ''} available`}
          </p>
        </div>
        <div className={styles.headerRight}>
          <select
            className={styles.sortSelect}
            value={sort}
            onChange={(e) => { setSort(e.target.value as SortKey); setPage(1); }}
          >
            <option value="newest">Newest First</option>
            <option value="budgetHigh">Budget: High → Low</option>
            <option value="budgetLow">Budget: Low → High</option>
          </select>
          <button
            className={`${styles.filterToggleBtn} ${hasActiveFilters ? styles.filterToggleBtnActive : ''}`}
            onClick={() => setFilterOpen((v) => !v)}
            type="button"
          >
            <SlidersHorizontal size={14} strokeWidth={2} />
            Filters
            {hasActiveFilters && <span className={styles.filterDot} />}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className={`${styles.body} ${filterOpen ? styles.bodyWithFilter : ''}`}>

        {/* Filter panel */}
        {filterOpen && (
          <aside className={styles.filterPanel}>
            <div className={styles.filterHeader}>
              <span className={styles.filterHeading}>Filters</span>
              <button className={styles.filterCloseBtn} onClick={() => setFilterOpen(false)} aria-label="Close filters">
                <X size={15} strokeWidth={2} />
              </button>
            </div>
            <FilterPanel filters={filters} onChange={updateFilters} onClear={clearFilters} />
          </aside>
        )}

        {/* Results */}
        <div className={styles.results}>
          {isLoading ? (
            <div className={styles.list}>
              {Array.from({ length: 5 }, (_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : pageItems.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <Briefcase size={24} color="var(--color-text-muted)" strokeWidth={1.5} />
              </div>
              <p className={styles.emptyTitle}>No jobs match your filters</p>
              <p className={styles.emptyDesc}>Try broadening your search or removing some filters.</p>
              {hasActiveFilters && (
                <button className={styles.clearLink} onClick={clearFilters}>Clear filters</button>
              )}
            </div>
          ) : (
            <>
              <div className={styles.list}>
                {pageItems.map((job) => <JobCard key={job.id} job={job} />)}
              </div>
              <Pagination
                current={currentPage}
                total={totalPages}
                onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              />
            </>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {filterOpen && (
        <div className={styles.mobileDrawer}>
          <div className={styles.drawerHandle}>
            <span className={styles.filterHeading}>Filters</span>
            <button className={styles.filterCloseBtn} onClick={() => setFilterOpen(false)} aria-label="Close">
              <X size={18} strokeWidth={2} />
            </button>
          </div>
          <FilterPanel filters={filters} onChange={updateFilters} onClear={() => { clearFilters(); setFilterOpen(false); }} />
        </div>
      )}
      {filterOpen && <div className={styles.mobileBackdrop} onClick={() => setFilterOpen(false)} aria-hidden />}

    </div>
  );
}
