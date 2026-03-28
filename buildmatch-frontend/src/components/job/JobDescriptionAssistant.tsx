import React, { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Spinner } from '../ui/Spinner';
import api from '../../services/api';
import styles from './JobDescriptionAssistant.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GeneratedJobDescription {
  title:             string;
  description:       string;
  scopeOfWork:       string;
  materialsIncluded: string;
  bidRequirements:   string;
  estimatedTimeline: string;
  fullDescription:   string;
}

interface ApiResponse<T> {
  success: boolean;
  data:    T;
  message?: string;
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function fetchQuestions(params: {
  roughDescription: string;
  tradeType:        string;
}): Promise<{ questions: string[] }> {
  const { data: res } = await api.post<ApiResponse<{ questions: string[] }>>(
    '/ai/job-assistant/questions',
    params,
  );
  return res.data;
}

async function fetchGenerated(params: {
  roughDescription: string;
  tradeType:        string;
  answers:          { question: string; answer: string }[];
  budgetMin:        number;
  budgetMax:        number;
  city:             string;
  state:            string;
}): Promise<GeneratedJobDescription> {
  const { data: res } = await api.post<ApiResponse<GeneratedJobDescription>>(
    '/ai/job-assistant/generate',
    params,
  );
  return res.data;
}

// ── Expandable section ────────────────────────────────────────────────────────

function ExpandableSection({ label, content }: { label: string; content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.expandable}>
      <button
        type="button"
        className={styles.expandableHeader}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        {open ? <ChevronUp size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />}
      </button>
      {open && <div className={styles.expandableBody}>{content}</div>}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  tradeType:        string;
  budgetMin:        number;
  budgetMax:        number;
  city:             string;
  state:            string;
  onGenerated:      (result: GeneratedJobDescription) => void;
  // Manual mode passthrough
  manualValue?:     string;
  onManualChange?:  (v: string) => void;
  manualError?:     string;
  manualPlaceholder?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function JobDescriptionAssistant({
  tradeType, budgetMin, budgetMax, city, state, onGenerated,
  manualValue = '', onManualChange, manualError, manualPlaceholder,
}: Props) {
  const [mode, setMode] = useState<'assistant' | 'manual'>('assistant');

  // Step 1 state
  const [roughDescription, setRoughDescription] = useState('');

  // Step 2 state
  const [questions, setQuestions]       = useState<string[]>([]);
  const [answers,   setAnswers]         = useState<string[]>([]);
  const [questionsError, setQuestionsError] = useState<string | null>(null);

  // Step 3 state
  const [generated,    setGenerated]    = useState<GeneratedJobDescription | null>(null);
  const [editedTitle,  setEditedTitle]  = useState('');
  const [editedDesc,   setEditedDesc]   = useState('');
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Step: 1 | 2 | 3
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // ── Mutations ───────────────────────────────────────────────────────────────

  const questionsMutation = useMutation({
    mutationFn: fetchQuestions,
    onSuccess: (data) => {
      setQuestions(data.questions);
      setAnswers(data.questions.map(() => ''));
      setQuestionsError(null);
      setStep(2);
    },
    onError: () => {
      setQuestionsError('AI assistant temporarily unavailable. Try again or switch to Manual mode.');
    },
  });

  const generateMutation = useMutation({
    mutationFn: fetchGenerated,
    onSuccess: (data) => {
      setGenerated(data);
      setEditedTitle(data.title);
      setEditedDesc(data.fullDescription);
      setGenerateError(null);
      setStep(3);
    },
    onError: () => {
      setGenerateError('AI assistant temporarily unavailable. Try again or switch to Manual mode.');
    },
  });

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleGetQuestions() {
    setQuestionsError(null);
    questionsMutation.mutate({ roughDescription, tradeType: tradeType || 'GENERAL' });
  }

  function handleGenerate() {
    setGenerateError(null);
    generateMutation.mutate({
      roughDescription,
      tradeType: tradeType || 'GENERAL',
      answers: questions.map((q, i) => ({ question: q, answer: answers[i] ?? '' })),
      budgetMin,
      budgetMax,
      city,
      state,
    });
  }

  function handleUse() {
    if (!generated) return;
    onGenerated({ ...generated, title: editedTitle, fullDescription: editedDesc });
    // Collapse assistant after use
    setStep(1);
    setRoughDescription('');
    setQuestions([]);
    setAnswers([]);
    setGenerated(null);
  }

  function handleRegenerate() {
    setStep(2);
    handleGenerate();
  }

  const allAnswered = answers.length === questions.length &&
    answers.every((a) => a.trim().length >= 5);

  // ── Manual mode ─────────────────────────────────────────────────────────────

  if (mode === 'manual') {
    return (
      <div className={styles.root}>
        <div className={styles.modeToggle}>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'assistant' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('assistant')}
          >
            <span className={styles.aiDot} />
            AI Assistant
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'manual' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('manual')}
          >
            Manual
          </button>
        </div>
        <textarea
          id="description"
          rows={6}
          value={manualValue}
          onChange={(e) => onManualChange?.(e.target.value)}
          placeholder={manualPlaceholder ?? 'Describe the work to be done…'}
          className={`${styles.textarea} ${manualError ? styles.textareaError : ''}`}
        />
        <p className={`${styles.charCounter} ${manualValue.length > 1990 ? styles.charCounterOver : ''}`}>
          {manualValue.length}/2000
        </p>
      </div>
    );
  }

  // ── Assistant mode ───────────────────────────────────────────────────────────

  return (
    <div className={styles.root}>
      {/* Mode toggle */}
      <div className={styles.modeToggle}>
        <button
          type="button"
          className={`${styles.modeBtn} ${mode === 'assistant' ? styles.modeBtnActive : ''}`}
          onClick={() => setMode('assistant')}
        >
          <span className={styles.aiDot} />
          AI Assistant
        </button>
        <button
          type="button"
          className={`${styles.modeBtn} ${mode === 'manual' ? styles.modeBtnActive : ''}`}
          onClick={() => setMode('manual')}
        >
          Manual
        </button>
      </div>

      {/* Step 1: Rough description */}
      {step >= 1 && (
        <div className={styles.roughBox}>
          <p className={styles.stepLabel}>Step 1 — Rough description</p>
          <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            Describe your job in a few words or sentences
          </label>
          <p className={styles.subtitle}>Don't worry about details — our AI will help fill those in</p>
          <textarea
            rows={3}
            maxLength={500}
            value={roughDescription}
            onChange={(e) => setRoughDescription(e.target.value)}
            placeholder="e.g. I need my bathroom renovated, old tiles removed, new vanity installed..."
            className={styles.textarea}
            disabled={step > 1}
          />
          <p className={`${styles.charCounter} ${roughDescription.length > 490 ? styles.charCounterOver : ''}`}>
            {roughDescription.length}/500
          </p>
          {step === 1 && (
            <>
              {questionsError && (
                <p style={{ fontSize: 13, color: 'var(--color-danger)', margin: 0 }}>{questionsError}</p>
              )}
              {questionsMutation.isPending ? (
                <div className={styles.loadingRow}>
                  <Spinner size="sm" />
                  AI is analyzing your job…
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={handleGetQuestions}
                  disabled={roughDescription.trim().length < 20 || questionsMutation.isPending}
                >
                  <Sparkles size={15} strokeWidth={2} />
                  Get AI questions
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 2: Follow-up questions */}
      {step >= 2 && questions.length > 0 && (
        <div className={styles.questionsBox}>
          <p className={styles.stepLabel}>Step 2 — Answer a few questions</p>
          {questions.map((q, i) => (
            <div key={i} className={styles.questionCard}>
              <p className={styles.questionText}>{q}</p>
              <textarea
                rows={2}
                value={answers[i] ?? ''}
                onChange={(e) => {
                  const next = [...answers];
                  next[i] = e.target.value;
                  setAnswers(next);
                }}
                placeholder="Your answer…"
                className={styles.textarea}
                disabled={step > 2}
              />
            </div>
          ))}

          {step === 2 && (
            <>
              {generateError && (
                <p style={{ fontSize: 13, color: 'var(--color-danger)', margin: 0 }}>{generateError}</p>
              )}
              {generateMutation.isPending ? (
                <div className={styles.loadingRow}>
                  <Spinner size="sm" />
                  Writing your job description…
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={handleGenerate}
                  disabled={!allAnswered || generateMutation.isPending}
                >
                  <Sparkles size={15} strokeWidth={2} />
                  Generate full description
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 3: Generated preview */}
      {step === 3 && generated && (
        <div className={styles.previewCard}>
          <p className={styles.stepLabel}>Step 3 — Review &amp; edit</p>

          <div className={styles.previewField}>
            <span className={styles.previewFieldLabel}>Suggested title</span>
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              maxLength={80}
              className={styles.previewTitleInput}
            />
          </div>

          <div className={styles.previewField}>
            <span className={styles.previewFieldLabel}>Full description</span>
            <textarea
              rows={8}
              value={editedDesc}
              onChange={(e) => setEditedDesc(e.target.value)}
              className={styles.textarea}
            />
          </div>

          <ExpandableSection label="Scope of work"       content={generated.scopeOfWork} />
          <ExpandableSection label="Materials included"  content={generated.materialsIncluded} />
          <ExpandableSection label="Bid requirements"    content={generated.bidRequirements} />
          <ExpandableSection label="Estimated timeline"  content={generated.estimatedTimeline} />

          <div className={styles.previewActions}>
            <button type="button" className={styles.btnPrimary} onClick={handleUse}>
              Use this description
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleRegenerate}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? <Spinner size="sm" /> : 'Regenerate'}
            </button>
          </div>

          <p className={styles.disclosure}>
            <Sparkles size={11} />
            Generated by BuildMatch AI. Review and edit before posting.
          </p>
        </div>
      )}
    </div>
  );
}

// ── AI assisted badge ─────────────────────────────────────────────────────────
// Exported separately so PostJobPage can place it inline in the label row.

export function AiAssistedBadge() {
  return (
    <span className={styles.aiBadge}>
      <Sparkles size={10} strokeWidth={2} />
      AI assisted
    </span>
  );
}
