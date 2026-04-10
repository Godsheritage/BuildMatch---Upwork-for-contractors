import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calculator, ChevronRight, Building2, Plus } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

interface PropertyWithEstimates {
  id: string; address_line1: string; city: string; state: string;
  zip_code: string; property_type: string;
  estimates: {
    id: string; status: string; total_low: number | null; total_high: number | null;
    confidenceOverall: string | null; renovationPurpose: string; createdAt: string;
  }[];
}

export function MyEstimatesPage() {
  const { toast }    = useToast();
  const navigate     = useNavigate();
  const [loading, setLoading]       = useState(true);
  const [properties, setProperties] = useState<PropertyWithEstimates[]>([]);

  useEffect(() => {
    (async () => {
      try {
        // Fetch properties
        const propRes = await api.get<{ success: boolean; data: Array<{
          id: string; address_line1: string; city: string; state: string;
          zip_code: string; property_type: string;
        }> }>('/estimator/properties');
        const props = propRes.data.data ?? [];

        // Fetch estimates per property
        const enriched: PropertyWithEstimates[] = await Promise.all(
          props.map(async (p) => {
            try {
              const estRes = await api.get<{ success: boolean; data: Array<{
                id: string; status: string; totalLow: number | null; totalHigh: number | null;
                confidenceOverall: string | null; renovationPurpose: string; createdAt: string;
              }> }>(`/estimator/properties/${p.id}/estimates`);
              return {
                ...p,
                estimates: (estRes.data.data ?? []).map(e => ({
                  ...e,
                  total_low: e.totalLow,
                  total_high: e.totalHigh,
                })),
              };
            } catch {
              return { ...p, estimates: [] };
            }
          }),
        );

        setProperties(enriched);
      } catch {
        toast('Could not load estimates.', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const totalEstimates = properties.reduce((s, p) => s + p.estimates.length, 0);

  if (loading) {
    return (
      <div style={page}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, textAlign: 'center', padding: 60 }}>
          Loading…
        </p>
      </div>
    );
  }

  return (
    <div style={page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>My Estimates</h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
            {totalEstimates} estimate{totalEstimates !== 1 ? 's' : ''} across {properties.length} propert{properties.length !== 1 ? 'ies' : 'y'}
          </p>
        </div>
        <Link to="/estimate/new">
          <Button variant="primary" size="sm"><Plus size={14} /> New Estimate</Button>
        </Link>
      </div>

      {properties.length === 0 ? (
        <div style={emptyWrap}>
          <Calculator size={48} strokeWidth={1} color="var(--color-accent)" style={{ opacity: 0.5 }} />
          <h3 style={{ margin: '16px 0 6px', fontSize: 18, fontWeight: 600 }}>No estimates yet</h3>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--color-text-muted)', maxWidth: 440, textAlign: 'center', lineHeight: 1.6 }}>
            Start by walking through your next property with the BuildMatch Estimator to get a detailed renovation cost breakdown.
          </p>
          <Link to="/estimate/new">
            <Button variant="primary">Start Your First Estimate</Button>
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {properties.map((p) => (
            <div key={p.id} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Building2 size={16} strokeWidth={1.75} color="var(--color-text-muted)" />
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{p.address_line1}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {p.city}, {p.state} {p.zip_code} · {p.property_type.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>

              {p.estimates.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
                  No estimates yet for this property.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {p.estimates.map((e, i) => (
                    <div key={e.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 0', gap: 12,
                      borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>
                          {e.status === 'COMPLETE' && e.total_low != null
                            ? `$${e.total_low.toLocaleString()} – $${(e.total_high ?? 0).toLocaleString()}`
                            : e.status === 'PROCESSING' ? 'Processing…' : 'Failed'}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
                          {new Date(e.createdAt).toLocaleDateString()}
                          {e.confidenceOverall && ` · ${e.confidenceOverall} confidence`}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        {e.status === 'COMPLETE' && (
                          <>
                            <Link to={`/estimate/${e.id}`} style={{ fontSize: 12, color: 'var(--color-accent)', fontWeight: 500, textDecoration: 'none' }}>
                              View Report
                            </Link>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => navigate(`/dashboard/post-job?estimateId=${e.id}`)}
                            >
                              Post a Job
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Link
                to={`/estimate/new?propertyId=${p.id}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-accent)', fontWeight: 500, marginTop: 8, textDecoration: 'none' }}
              >
                New estimate for this property <ChevronRight size={12} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const page: React.CSSProperties = { maxWidth: 780, margin: '0 auto', padding: '32px 24px 64px' };
const emptyWrap: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', textAlign: 'center', padding: '60px 20px',
};
const card: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--color-border)',
  borderRadius: 12, padding: '18px 22px',
};
