import { AdminPageHeader } from '../../components/admin/shared/AdminPageHeader';
import styles from './AdminStub.module.css';
export function AdminFinancePage() {
  return (
    <div>
      <AdminPageHeader title="Finance" subtitle="Payment summaries, payouts, and refund management" />
      <div className={styles.placeholder}>
        <p>Finance dashboard — coming soon.</p>
        <ul className={styles.planned}><li>Revenue overview</li><li>Transaction table</li><li>Manual refund trigger</li><li>Payout schedule management</li></ul>
      </div>
    </div>
  );
}
