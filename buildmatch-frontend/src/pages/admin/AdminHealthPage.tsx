import { useState, useEffect } from 'react';
import { AdminPageHeader } from '../../components/admin/shared/AdminPageHeader';
import { AdminStatCard } from '../../components/admin/shared/AdminStatCard';
import { Button } from '../../components/ui';
import api from '../../services/api';
import styles from './AdminHealthPage.module.css';

interface HealthData {
  database: { ok: boolean; latencyMs?: number };
  supabase:  { ok: boolean };
  anthropic: { ok: boolean };
}

interface HealthService {
  name: string;
  key: keyof HealthData;
}

const SERVICES: HealthService[] = [
  { name: 'PostgreSQL / Prisma', key: 'database' },
  { name: 'Supabase',            key: 'supabase'  },
  { name: 'Anthropic AI',        key: 'anthropic' },
];

export function AdminHealthPage() {
  const [health, setHealth]     = useState<HealthData | null>(null);
  const [loading, setLoading]   = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  async function check() {
    setLoading(true);
    try {
      const res = await api.get<{ data: HealthData }>('/admin/health');
      setHealth(res.data.data);
      setCheckedAt(new Date());
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { check(); }, []);

  const allOk = health
    ? Object.values(health).every(s => s.ok)
    : null;

  return (
    <div>
      <AdminPageHeader
        title="System Health"
        subtitle={checkedAt ? `Last checked ${checkedAt.toLocaleTimeString()}` : 'Checking…'}
        actions={
          <Button variant="secondary" size="sm" onClick={check} disabled={loading}>
            {loading ? 'Checking…' : 'Refresh'}
          </Button>
        }
      />

      <div className={styles.summary}>
        <AdminStatCard
          label="Overall Status"
          value={allOk === null ? '…' : allOk ? 'Healthy' : 'Degraded'}
        />
      </div>

      <div className={styles.serviceGrid}>
        {SERVICES.map(({ name, key }) => {
          const s = health?.[key];
          const ok = s?.ok;
          return (
            <div key={key} className={`${styles.serviceCard} ${ok === false ? styles.serviceErr : ''}`}>
              <div className={styles.serviceName}>{name}</div>
              <div className={`${styles.serviceStatus} ${ok ? styles.ok : ok === false ? styles.err : styles.pending}`}>
                {ok === undefined ? '…' : ok ? 'OK' : 'Error'}
              </div>
              {(s as { latencyMs?: number })?.latencyMs !== undefined && (
                <div className={styles.serviceLatency}>
                  {(s as { latencyMs: number }).latencyMs} ms
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
