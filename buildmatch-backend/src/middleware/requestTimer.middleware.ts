/**
 * src/middleware/requestTimer.middleware.ts
 *
 * Records the wall-clock duration of every HTTP response in a rolling
 * in-memory buffer (last 1 000 requests, with timestamps).
 *
 * Two read interfaces are exported:
 *   getResponseTimeStats()     — overall avg + p95 (used by GET /status)
 *   getHourlyPerformance()     — 24 one-hour buckets for the perf chart
 *
 * Mount as the FIRST middleware in app.ts (before body parsers).
 */

import type { Request, Response, NextFunction } from 'express';

// ── Rolling buffer ─────────────────────────────────────────────────────────────

const BUFFER_SIZE = 1_000;

interface TimedEntry {
  durationMs: number;
  ts:         number; // Unix ms — needed for hourly bucketing
}

const _buffer: TimedEntry[] = [];

// ── Aggregate helpers ──────────────────────────────────────────────────────────

/** Overall avg and p95 across every entry in the buffer. */
export function getResponseTimeStats(): { avgResponseMs: number; p95ResponseMs: number } {
  if (_buffer.length === 0) return { avgResponseMs: 0, p95ResponseMs: 0 };

  const sorted = _buffer.map(e => e.durationMs).sort((a, b) => a - b);
  const avg    = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  const p95idx = Math.floor(0.95 * sorted.length);
  const p95    = sorted[Math.min(p95idx, sorted.length - 1)];

  return {
    avgResponseMs: Math.round(avg),
    p95ResponseMs: Math.round(p95),
  };
}

/**
 * Returns 24 one-hour time buckets covering the last 24 hours.
 * Bucket 0 = oldest (24 h ago); bucket 23 = most recent completed hour.
 * Buckets with no requests have avgMs = 0, p95Ms = 0, count = 0.
 */
export function getHourlyPerformance(): {
  hour:   string; // e.g. "14:00"
  avgMs:  number;
  p95Ms:  number;
  count:  number;
}[] {
  const now   = Date.now();
  const since = now - 24 * 60 * 60 * 1_000;

  // 24 slots — index 0 = entries from 24-23h ago, index 23 = entries from 1-0h ago
  const slots: number[][] = Array.from({ length: 24 }, () => []);

  for (const entry of _buffer) {
    if (entry.ts < since) continue;
    const hoursAgo = Math.floor((now - entry.ts) / (60 * 60 * 1_000));
    if (hoursAgo >= 24) continue;
    const slotIdx = 23 - hoursAgo;
    slots[slotIdx].push(entry.durationMs);
  }

  return slots.map((durations, i) => {
    // Label: the start of the hour this bucket represents
    const bucketStartMs = now - (23 - i) * 60 * 60 * 1_000;
    const d             = new Date(bucketStartMs);
    const hour          = `${String(d.getHours()).padStart(2, '0')}:00`;

    if (durations.length === 0) return { hour, avgMs: 0, p95Ms: 0, count: 0 };

    const sorted = durations.slice().sort((a, b) => a - b);
    const avg    = sorted.reduce((s, v) => s + v, 0) / sorted.length;
    const p95idx = Math.floor(0.95 * sorted.length);
    const p95    = sorted[Math.min(p95idx, sorted.length - 1)];

    return {
      hour,
      avgMs:  Math.round(avg),
      p95Ms:  Math.round(p95),
      count:  durations.length,
    };
  });
}

// ── Middleware ─────────────────────────────────────────────────────────────────

export function requestTimer(req: Request, res: Response, next: NextFunction): void {
  const startMs = Date.now();

  res.on('finish', () => {
    const entry: TimedEntry = { durationMs: Date.now() - startMs, ts: startMs };
    if (_buffer.length >= BUFFER_SIZE) _buffer.shift();
    _buffer.push(entry);
  });

  next();
}
