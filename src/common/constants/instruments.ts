/**
 * Canonical instrument keys used throughout the application.
 * All instrument values stored in the database should be one of these.
 */
export const CANONICAL_INSTRUMENTS = ['drums', 'guitars', 'vocals', 'bass', 'keys'] as const;

export type CanonicalInstrument = (typeof CANONICAL_INSTRUMENTS)[number];

/**
 * Maps known instrument name variants (EN, PT, ES) to canonical keys.
 * Used to normalize free-text instrument values on save.
 */
const INSTRUMENT_ALIASES: Record<string, CanonicalInstrument> = {
  // Drums
  drums: 'drums',
  drum: 'drums',
  bateria: 'drums',
  batería: 'drums',
  percussion: 'drums',

  // Guitars
  guitar: 'guitars',
  guitars: 'guitars',
  guitarra: 'guitars',
  guitarras: 'guitars',

  // Vocals
  vocals: 'vocals',
  vocal: 'vocals',
  vozes: 'vocals',
  voz: 'vocals',
  voces: 'vocals',
  singer: 'vocals',
  voice: 'vocals',

  // Bass
  bass: 'bass',
  baixo: 'bass',
  bajo: 'bass',
  'bass guitar': 'bass',

  // Keys
  keys: 'keys',
  keyboard: 'keys',
  keyboards: 'keys',
  'keyboard/piano': 'keys',
  teclado: 'keys',
  teclados: 'keys',
  piano: 'keys',
};

/**
 * Normalizes an instrument string to its canonical key.
 * Returns the original value (lowercased) if no mapping is found.
 */
export function normalizeInstrument(instrument: string | null | undefined): string | null {
  if (!instrument) return null;
  const lower = instrument.toLowerCase().trim();
  return INSTRUMENT_ALIASES[lower] ?? lower;
}
