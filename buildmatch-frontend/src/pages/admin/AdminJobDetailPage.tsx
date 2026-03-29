import { useParams, Link } from 'react-router-dom';
import { AdminPageHeader } from '../../components/admin/shared/AdminPageHeader';
import { useAdminJob } from '../../hooks/useAdmin';
import { Button } from '../../components/ui';
import styles from './AdminStub.module.css';

export function AdminJobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { data, isLoading } = useAdminJob(jobId ?? null);

  return (
    <div>
      <AdminPageHeader
        title={isLoading ? 'Loading…' : data?.title ?? 'Job Detail'}
        subtitle={data ? `${data.status} · ${data.tradeType}` : undefined}
        actions={
          <Link to="/admin/jobs">
            <Button variant="secondary" size="sm">Back to Jobs</Button>
          </Link>
        }
      />
      <div className={styles.placeholder}>
        <p>Full job detail view — coming soon.</p>
        {data && (
          <pre className={styles.json}>{JSON.stringify(data, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}
