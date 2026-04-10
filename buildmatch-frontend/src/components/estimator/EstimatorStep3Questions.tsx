import { useState } from 'react';
import { Button } from '../ui/Button';

const QUESTIONS = [
  { key: 'foundation_visible_cracks', q: 'Are there visible cracks in the foundation?' },
  { key: 'roof_condition',            q: 'What is the condition of the roof? (good / fair / poor / unknown)' },
  { key: 'hvac_functional',           q: 'Is the HVAC system currently functional?' },
  { key: 'plumbing_issues',           q: 'Any known plumbing issues? Describe if yes.' },
  { key: 'electrical_panel',          q: 'What type/size electrical panel? (e.g., 100A, 200A, unknown)' },
  { key: 'mold_present',             q: 'Is mold visible anywhere?' },
  { key: 'permits_needed',           q: 'Will you need permits? (yes / no / unsure)' },
  { key: 'renovation_budget',        q: 'Do you have a target budget range? If so, what is it?' },
  { key: 'timeline',                 q: 'What is your target timeline for completing the renovation?' },
  { key: 'additional_notes',         q: 'Anything else the estimator should know about this property?' },
];

interface Props {
  answers: Record<string, string>;
  onNext:  (answers: Record<string, string>) => void;
}

export function EstimatorStep3Questions({ answers, onNext }: Props) {
  const [a, setA] = useState<Record<string, string>>({ ...answers });

  function set(key: string, val: string) {
    setA((prev) => ({ ...prev, [key]: val }));
  }

  function handleContinue() {
    onNext(a);
  }

  const answered = Object.values(a).filter(v => v.trim()).length;

  return (
    <div>
      <h2 style={heading}>Property questionnaire</h2>
      <p style={subtext}>
        Help the AI understand things that may not be visible in photos. Skip any you're unsure about.
      </p>

      <div style={card}>
        {QUESTIONS.map(({ key, q }, i) => (
          <div key={key} style={{
            paddingBottom: i < QUESTIONS.length - 1 ? 16 : 0,
            marginBottom: i < QUESTIONS.length - 1 ? 16 : 0,
            borderBottom: i < QUESTIONS.length - 1 ? '1px solid var(--color-border)' : 'none',
          }}>
            <label style={label}>{q}</label>
            <input
              type="text"
              value={a[key] ?? ''}
              onChange={(e) => set(key, e.target.value)}
              style={input}
              placeholder="Type your answer…"
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          {answered} of {QUESTIONS.length} answered
        </span>
        <Button variant="primary" onClick={handleContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}

const heading: React.CSSProperties = { fontSize: 20, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.02em' };
const subtext: React.CSSProperties = { fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 20px', lineHeight: 1.5 };
const card:    React.CSSProperties = { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, marginBottom: 20 };
const label:   React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 8 };
const input:   React.CSSProperties = { width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid var(--color-border)', borderRadius: 8, fontFamily: 'inherit' };
