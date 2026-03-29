import { AdminPageHeader } from '../../components/admin/shared/AdminPageHeader';
import styles from './AdminStub.module.css';
export function AdminReviewsPage() {
  return (
    <div>
      <AdminPageHeader title="Reviews" subtitle="Moderate contractor and investor reviews" />
      <div className={styles.placeholder}>
        <p>Review moderation — coming soon.</p>
        <ul className={styles.planned}><li>Pending review approval queue</li><li>Flagged/reported review list</li><li>Remove or edit reviews with audit trail</li></ul>
      </div>
    </div>
  );
}
