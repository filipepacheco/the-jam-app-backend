// Instruments
export { CANONICAL_INSTRUMENTS, normalizeInstrument } from './instruments';
export type { CanonicalInstrument } from './instruments';

// Slug validation
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_VALIDATION_MESSAGE = 'Slug must be lowercase alphanumeric with hyphens (e.g. "friday-night-rock")';

// Pagination
export const DEFAULT_TAKE = 20;
export const MAX_TAKE = 100;

// Playback history
export const DEFAULT_HISTORY_LIMIT = 50;
export const MAX_HISTORY_LIMIT = 100;

// Feedback rate limiting
export const FEEDBACK_RATE_LIMIT = 5;
export const FEEDBACK_RATE_WINDOW_MS = 3600000; // 1 hour

// CORS
export const CORS_MAX_AGE = 86400; // 24 hours
