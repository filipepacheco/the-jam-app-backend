import { PrismaService } from '../../prisma/prisma.service';

// Safe alphanumeric chars - excludes ambiguous: 0, O, 1, I, L
const SHORT_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const SHORT_CODE_LENGTH = 6;
const MAX_COLLISION_RETRIES = 10;

/**
 * Generate a random short code (e.g. "ABC123").
 * Uses only unambiguous characters for easy verbal sharing.
 */
function randomShortCode(): string {
  let code = '';
  for (let i = 0; i < SHORT_CODE_LENGTH; i++) {
    code += SHORT_CODE_CHARS[Math.floor(Math.random() * SHORT_CODE_CHARS.length)];
  }
  return code;
}

/**
 * Generate a unique short code, checking the database for collisions.
 */
export async function generateShortCode(prisma: PrismaService): Promise<string> {
  for (let i = 0; i < MAX_COLLISION_RETRIES; i++) {
    const code = randomShortCode();
    const existing = await prisma.jam.findUnique({ where: { shortCode: code } });
    if (!existing) return code;
  }
  throw new Error('Failed to generate unique short code after max retries');
}

/**
 * Slugify a string: lowercase, replace non-alphanumeric with hyphens, trim hyphens.
 */
function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric to hyphens
    .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens
    .slice(0, 60); // limit length before suffix
}

/**
 * Generate a slug from a jam name with the short code as suffix for uniqueness.
 * Example: "Friday Night Rock" + "ABC123" -> "friday-night-rock-abc123"
 */
export function generateSlug(name: string, shortCode: string): string {
  const base = slugify(name);
  const suffix = shortCode.toLowerCase();
  if (!base) return suffix;
  return `${base}-${suffix}`;
}
