import { AdminPageHeader } from '../../components/admin/shared/AdminPageHeader';
import styles from './AdminStub.module.css';
export function AdminAnalyticsPage() {
  return (
    <div>
      <AdminPageHeader title="Analytics" subtitle="Platform growth, engagement, and conversion metrics" />
      <div className={styles.placeholder}>
        <p>Analytics dashboard — coming soon.</p>
        <ul className={styles.planned}><li>User registration trend</li><li>Job post and bid submission volumes</li><li>Contractor match acceptance rate</li><li>AI feature usage</li></ul>
      </div>
    </div>
  );
}
