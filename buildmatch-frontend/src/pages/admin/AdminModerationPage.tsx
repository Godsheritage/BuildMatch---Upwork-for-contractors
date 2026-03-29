import { AdminPageHeader } from '../../components/admin/shared/AdminPageHeader';
import styles from './AdminStub.module.css';

export function AdminModerationPage() {
  return (
    <div>
      <AdminPageHeader
        title="Moderation"
        subtitle="Content queue, flagged messages, and banned email management"
      />
      <div className={styles.placeholder}>
        <p>Moderation queue — coming soon.</p>
        <ul className={styles.planned}>
          <li>Flagged message review queue</li>
          <li>User-reported content</li>
          <li>Banned email management (move from Settings)</li>
          <li>Content filter pattern editor</li>
        </ul>
      </div>
    </div>
  );
}
