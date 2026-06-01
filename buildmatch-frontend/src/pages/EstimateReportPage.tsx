import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { Step5Results } from '../components/estimator/Step5Results';
import { getEstimate, getProperty, type PropertyEstimate, type Property } from '../services/property.service';
import type { WizardState } from './EstimatorPage';

/**
 * Standalone page for viewing a past estimate report.
 * Route: /estimate/:estimateId
 * Fetches the estimate + its property, then renders Step5Results
 * in its completed state so the user can review, print, or post a job.
 */
export function EstimateReportPage() {
  const { estimateId } = useParams();
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState('');
  const [wizard,  setWizard]    = useState<WizardState | null>(null);

  useEffect(() => {
    if (!estimateId) { setError('No estimate ID'); setLoading(false); return; }
    let cancelled = false;

    (async () => {
      try {
        const est: PropertyEstimate = await getEstimate(estimateId);
        const prop: Property        = await getProperty(est.property_id);
        if (cancelled) return;

        const state: WizardState = {
          currentStep: 5,
          property: {
            id:           prop.id,
            addressLine1: prop.address_line1,
            addressLine2: prop.address_line2 ?? '',
            city:         prop.city,
            state:        prop.state,
            zipCode:      prop.zip_code,
            propertyType: prop.property_type,
            yearBuilt:    prop.year_built?.toString() ?? '',
            sqftEstimate: prop.sqft_estimate?.toString() ?? '',
            bedrooms:     prop.bedrooms?.toString() ?? '',
            bathrooms:    prop.bathrooms?.toString() ?? '',
            hasBasement:  prop.has_basement,
            hasGarage:    prop.has_garage,
            stories:      prop.stories?.toString() ?? '1',
          },
          photos:         {},
          answers:        {},
          estimateId:     est.id,
          estimateStatus: est.status as 'COMPLETE' | 'FAILED',
        };

        setWizard(state);
      } catch {
        if (!cancelled) setError('Could not load estimate.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [estimateId]);

  if (loading) {
    return (
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <Loader size={28} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: 12, color: 'var(--color-text-muted)', fontSize: 14 }}>Loading estimate…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !wizard) {
    return (
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 16, fontWeight: 600 }}>{error || 'Estimate not found'}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 24px 64px' }}>
      <Step5Results
        state={wizard}
        onUpdate={(patch) => setWizard((prev) => prev ? { ...prev, ...patch } : prev)}
        onGoToStep={() => {}}
      />
    </div>
  );
}
