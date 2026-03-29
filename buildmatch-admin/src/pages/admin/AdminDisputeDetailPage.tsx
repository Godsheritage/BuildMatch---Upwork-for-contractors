import { useParams, Link } from 'react-router-dom';
import { AdminPageHeader } from '../../components/admin/shared/AdminPageHeader';
import { useAdminDispute } from '../../hooks/useAdmin';
import { Button } from '../../components/ui';
import styles from './AdminStub.module.css';

export function AdminDisputeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useAdminDispute(id ?? null);
  return (
    <div>
      <AdminPageHeader title={isLoading ? 'Loading…' : `Dispute #${id?.slice(0, 8) ?? ''}`} subtitle={data ? `Status: ${data.status}` : undefined} actions={<Link to="/admin/disputes"><Button variant="secondary" size="sm">Back to Disputes</Button></Link>} />
      <div className={styles.placeholder}>
        <p>Full dispute detail view — coming soon.</p>
        {data && <pre className={styles.json}>{JSON.stringify(data, null, 2)}</pre>}
      </div>
    </div>
  );
}
