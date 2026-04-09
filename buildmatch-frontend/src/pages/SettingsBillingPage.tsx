import { Link } from 'react-router-dom';
import { ChevronLeft, Plus, CreditCard } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import styles from './SettingsSubPage.module.css';

export function SettingsBillingPage() {
  const { toast } = useToast();

  function handleAdd() {
    toast('Billing methods are coming soon.', 'success');
  }

  return (
    <div className={styles.page}>
      <Link to="/dashboard/settings" className={styles.back}>
        <ChevronLeft size={15} strokeWidth={2} />
        Account Settings
      </Link>

      <div className={styles.header}>
        <h1 className={styles.title}>Billing &amp; payments</h1>
        <p className={styles.subtitle}>
          Manage how you pay for upgrades and add-ons on BuildMatch.
        </p>
      </div>

      {/* Billing methods */}
      <div className={styles.card}>
        <p className={styles.sectionTitle}>Billing methods</p>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, margin: '0 0 16px' }}>
          You haven't set up any billing methods yet. Your billing method will be charged only when
          your available balance from BuildMatch earnings is not sufficient to pay for your monthly
          membership and/or add-ons.
        </p>
        <button
          type="button"
          onClick={handleAdd}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-accent)', fontSize: 13, fontWeight: 500,
            padding: 0,
          }}
        >
          <Plus size={16} strokeWidth={2} />
          Add a billing method
        </button>
      </div>

      {/* Payment history */}
      <div className={styles.card}>
        <p className={styles.sectionTitle}>Payment history</p>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '28px 16px', textAlign: 'center', gap: 10,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: '#F8F7F5', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <CreditCard size={20} strokeWidth={1.5} color="var(--color-text-muted)" />
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
            No payments yet. Your invoices will appear here once you've made a purchase.
          </p>
        </div>
      </div>
    </div>
  );
}
