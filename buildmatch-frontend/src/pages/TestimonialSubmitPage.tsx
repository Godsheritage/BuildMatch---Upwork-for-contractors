import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import axios from 'axios';
import { getTestimonialRequest, submitTestimonial } from '../services/testimonial.service';
import type { TestimonialRequestInfo } from '../services/testimonial.service';

type PageState = 'loading' | 'ready' | 'submitting' | 'success' | 'already_done' | 'expired' | 'error';

export function TestimonialSubmitPage() {
  const { token } = useParams<{ token: string }>();
  const [pageState, setPageState]   = useState<PageState>('loading');
  const [request,   setRequest]     = useState<TestimonialRequestInfo | null>(null);
  const [body,      setBody]        = useState('');
  const [bodyError, setBodyError]   = useState('');

  useEffect(() => {
    if (!token) { setPageState('error'); return; }
    getTestimonialRequest(token)
      .then((data) => { setRequest(data); setPageState('ready'); })
      .catch((err) => {
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          if (status === 409) { setPageState('already_done'); return; }
          if (status === 410) { setPageState('expired');      return; }
        }
        setPageState('error');
      });
  }, [token]);

  const contractorName = request
    ? `${request.contractorProfile.user.firstName} ${request.contractorProfile.user.lastName}`
    : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim().length < 20) { setBodyError('Please write at least 20 characters.'); return; }
    setBodyError('');
    setPageState('submitting');
    try {
      await submitTestimonial(token!, body.trim());
      setPageState('success');
    } catch {
      setPageState('ready');
      setBodyError('Something went wrong. Please try again.');
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-surface)', display: 'flex', flexDirection: 'column' }}>
      {/* Minimal nav */}
      <nav style={{
        background: 'var(--color-bg)',
        borderBottom: '1px solid var(--color-border)',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        padding: '0 32px',
      }}>
        <Link to="/" style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none', letterSpacing: '-0.02em' }}>
          BuildMatch
        </Link>
      </nav>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
        <div style={{
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-card)',
          padding: 40,
          width: '100%',
          maxWidth: 520,
        }}>

          {/* Loading */}
          {pageState === 'loading' && (
            <div>
              <div style={{ height: 24, width: '60%', background: 'var(--color-surface)', borderRadius: 4, marginBottom: 12, animation: 'pulse 1.6s ease-in-out infinite' }} />
              <div style={{ height: 16, width: '80%', background: 'var(--color-surface)', borderRadius: 4, marginBottom: 8,  animation: 'pulse 1.6s ease-in-out infinite' }} />
              <div style={{ height: 16, width: '50%', background: 'var(--color-surface)', borderRadius: 4,                   animation: 'pulse 1.6s ease-in-out infinite' }} />
            </div>
          )}

          {/* Already submitted */}
          {pageState === 'already_done' && (
            <div style={{ textAlign: 'center' }}>
              <CheckCircle2 size={48} color="var(--color-accent)" style={{ marginBottom: 16 }} />
              <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8 }}>
                Already submitted
              </h1>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                A testimonial has already been submitted using this link. Thank you!
              </p>
            </div>
          )}

          {/* Expired */}
          {pageState === 'expired' && (
            <div style={{ textAlign: 'center' }}>
              <Clock size={48} color="var(--color-text-muted)" style={{ marginBottom: 16 }} />
              <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8 }}>
                Link expired
              </h1>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                This testimonial link has expired. Please ask the contractor to send a new request.
              </p>
            </div>
          )}

          {/* Generic error */}
          {pageState === 'error' && (
            <div style={{ textAlign: 'center' }}>
              <AlertCircle size={48} color="var(--color-danger)" style={{ marginBottom: 16 }} />
              <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8 }}>
                Link not found
              </h1>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                This testimonial link is invalid or no longer available.
              </p>
            </div>
          )}

          {/* Success */}
          {pageState === 'success' && (
            <div style={{ textAlign: 'center' }}>
              <CheckCircle2 size={48} color="var(--color-accent)" style={{ marginBottom: 16 }} />
              <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8 }}>
                Thank you!
              </h1>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                Your testimonial for <strong>{contractorName}</strong> has been submitted and will appear on their public profile.
              </p>
            </div>
          )}

          {/* Form */}
          {(pageState === 'ready' || pageState === 'submitting') && request && (
            <form onSubmit={handleSubmit}>
              <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6, letterSpacing: '-0.02em' }}>
                Share your experience with {contractorName}
              </h1>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 24, lineHeight: 1.5 }}>
                Your honest feedback helps others make confident hiring decisions.
              </p>

              {request.personalMessage && (
                <blockquote style={{
                  borderLeft: '3px solid var(--color-highlight)',
                  paddingLeft: 14,
                  margin: '0 0 24px',
                  color: 'var(--color-text-muted)',
                  fontStyle: 'italic',
                  fontSize: 13,
                  lineHeight: 1.6,
                }}>
                  "{request.personalMessage}"
                </blockquote>
              )}

              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    Your testimonial
                  </label>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {body.length} / 1000
                  </span>
                </div>
                <textarea
                  value={body}
                  onChange={(e) => { setBody(e.target.value); setBodyError(''); }}
                  placeholder={`Tell others about your experience working with ${contractorName}…`}
                  rows={6}
                  maxLength={1000}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    fontSize: 14,
                    fontFamily: 'var(--font-family)',
                    border: `1px solid ${bodyError ? 'var(--color-danger)' : 'var(--color-border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    resize: 'vertical',
                    lineHeight: 1.6,
                    outline: 'none',
                    color: 'var(--color-text-primary)',
                    background: 'var(--color-bg)',
                  }}
                />
                {bodyError && (
                  <p style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 4 }}>{bodyError}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={pageState === 'submitting'}
                style={{
                  width: '100%',
                  padding: '11px 0',
                  background: 'var(--color-primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'var(--font-family)',
                  cursor: pageState === 'submitting' ? 'not-allowed' : 'pointer',
                  opacity: pageState === 'submitting' ? 0.7 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {pageState === 'submitting' ? 'Submitting…' : 'Submit testimonial'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
