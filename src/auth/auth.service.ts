import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
  InternalServerErrorException,
  Inject,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Musician } from '@prisma/client';
import { SupabaseClient } from '@supabase/supabase-js';

// In-memory store for failed login attempts (consider Redis for production)
interface LoginAttempt {
  count: number;
  lastAttempt: number;
  lockedUntil?: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly loginAttempts = new Map<string, LoginAttempt>();

  // Configuration for account lockout
  private readonly MAX_LOGIN_ATTEMPTS = parseInt(process.env.LOGIN_ATTEMPT_LIMIT || '5', 10);
  private readonly LOCKOUT_WINDOW_MS = parseInt(process.env.LOGIN_ATTEMPT_WINDOW || '900', 10) * 1000; // 15 min default
  private readonly MAX_RETRY_ATTEMPTS = 3;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    @Optional()
    @Inject('SUPABASE_CLIENT')
    private supabaseClient: SupabaseClient,
  ) {}

  /**
   * Sync Supabase user to local database
   * Called when user logs in via Supabase OAuth
   * Step 5: POST /auth/sync-user endpoint
   */
  async syncSupabaseUser(supabaseToken: string): Promise<AuthResponseDto> {
    if (!this.supabaseClient) {
      throw new BadRequestException('Supabase is not configured');
    }

    try {
      // Verify token and get user data from Supabase
      const { data, error } = await this.supabaseClient.auth.getUser(supabaseToken);

      if (error || !data.user) {
        throw new UnauthorizedException('Invalid Supabase token');
      }

      const supabaseUser = data.user;
      let musician: Musician;
      let isNewUser = false;

      // Find existing musician by Supabase ID
      musician = await this.prisma.musician.findUnique({
        where: { supabaseUserId: supabaseUser.id },
      });

      // If not found, try to find by email
      if (!musician && supabaseUser.email) {
        musician = await this.prisma.musician.findUnique({
          where: { email: supabaseUser.email },
        });

        // Link Supabase ID to existing musician
        if (musician && !musician.supabaseUserId) {
          musician = await this.prisma.musician.update({
            where: { id: musician.id },
            data: { supabaseUserId: supabaseUser.id },
          });
          this.logger.log(`[SUPABASE_LINKED] Linked Supabase user to existing musician: ${musician.id}`);
        }
      }

      // Create new musician if doesn't exist
      if (!musician) {
        const name = supabaseUser.user_metadata?.full_name ||
                     supabaseUser.email?.split('@')[0] ||
                     `User_${supabaseUser.id.slice(-4)}`;

        musician = await this.prisma.musician.create({
          data: {
            supabaseUserId: supabaseUser.id,
            email: supabaseUser.email,
            name,
          },
        });
        isNewUser = true;
        this.logger.log(`[SUPABASE_NEW_USER] Created musician from Supabase: ${musician.id}`);
      }

      const role = musician.isHost ? 'host' : 'user'

      // Generate local JWT token
      const token = await this.generateToken(musician.id, role);

      return {
        userId: musician.id,
        name: musician.name,
        email: musician.email,
        phone: musician.phone,
        role,
        isHost: musician.isHost,
        token,
        isNewUser,
      };
    } catch (error) {
      this.logger.error(`[SUPABASE_ERROR] Sync failed: ${error.message}`);
      throw new UnauthorizedException('Failed to sync with Supabase');
    }
  }

  /**
   * Login or auto-register user with email or phone
   * Includes validation, lockout protection, and retry logic
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, phone } = loginDto;

    // Validate: exactly one of email or phone must be provided
    if (!email && !phone) {
      throw new BadRequestException('Either email or phone must be provided');
    }

    if (email && phone) {
      throw new BadRequestException('Provide either email or phone, not both');
    }

    // Input validation for email format
    if (email && !this.isValidEmail(email)) {
      throw new BadRequestException('Invalid email format');
    }

    // Input validation for phone format
    if (phone && !this.isValidPhone(phone)) {
      throw new BadRequestException('Invalid phone format. Use format: +5511999999999');
    }

    const identifier = email || phone;

    // Check for account lockout
    const lockoutStatus = this.checkLockout(identifier);
    if (lockoutStatus.isLocked) {
      const remainingMinutes = Math.ceil(lockoutStatus.remainingMs / 60000);
      this.logger.warn(`[LOGIN_BLOCKED] Account locked for ${identifier}, ${remainingMinutes} min remaining`);
      throw new UnauthorizedException(
        `Account temporarily locked. Try again in ${remainingMinutes} minute(s).`,
      );
    }

    let musician: Musician | null;
    let isNewUser = false;

    try {
      // Query musician by email or phone with retry logic
      musician = await this.findMusicianWithRetry(email, phone);

      // If not found, create new musician with retry logic
      if (!musician) {
        musician = await this.createMusicianWithRetry(email, phone);
        isNewUser = true;
        this.logger.log(`[NEW_USER] Created musician: ${this.maskIdentifier(identifier)}`);
      } else {
        this.logger.log(`[LOGIN_SUCCESS] Musician logged in: ${this.maskIdentifier(identifier)}`);
      }

      // Clear failed attempts on successful login
      this.clearLoginAttempts(identifier);

      const role = musician.isHost ? 'host' : 'user'

      // Generate JWT token
      const token = await this.generateToken(musician.id, role);

      return {
        userId: musician.id,
        name: musician.name,
        email: musician.email,
        phone: musician.phone,
        role,
        isHost: musician.isHost,
        token,
        isNewUser,
      };
    } catch (error) {
      // Record failed attempt for non-validation errors
      if (!(error instanceof BadRequestException)) {
        this.recordFailedAttempt(identifier);
        this.logger.warn(`[LOGIN_FAILED] ${this.maskIdentifier(identifier)}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Find musician with retry logic for database conflicts
   */
  private async findMusicianWithRetry(
    email?: string,
    phone?: string,
  ): Promise<Musician | null> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        if (email) {
          return await this.prisma.musician.findUnique({
            where: { email },
          });
        } else {
          return await this.prisma.musician.findUnique({
            where: { phone },
          });
        }
      } catch (error) {
        lastError = error;
        this.logger.warn(`[DB_RETRY] Find musician attempt ${attempt}/${this.MAX_RETRY_ATTEMPTS}: ${error.message}`);
        if (attempt < this.MAX_RETRY_ATTEMPTS) {
          await this.sleep(100 * attempt); // Exponential backoff
        }
      }
    }

    throw new InternalServerErrorException(
      `Database error after ${this.MAX_RETRY_ATTEMPTS} attempts: ${lastError.message}`,
    );
  }

  /**
   * Create musician with retry logic for race conditions
   */
  private async createMusicianWithRetry(
    email?: string,
    phone?: string,
  ): Promise<Musician> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        return await this.createMusicianFromLogin(email, phone);
      } catch (error) {
        lastError = error;

        // Check for unique constraint violation (race condition)
        if (error.code === 'P2002') {
          this.logger.log(`[RACE_CONDITION] Duplicate detected, fetching existing musician`);
          // Musician was created by another request, fetch it
          const existing = await this.findMusicianWithRetry(email, phone);
          if (existing) {
            return existing;
          }
        }

        this.logger.warn(`[DB_RETRY] Create musician attempt ${attempt}/${this.MAX_RETRY_ATTEMPTS}: ${error.message}`);
        if (attempt < this.MAX_RETRY_ATTEMPTS) {
          await this.sleep(100 * attempt); // Exponential backoff
        }
      }
    }

    throw new InternalServerErrorException(
      `Failed to create musician after ${this.MAX_RETRY_ATTEMPTS} attempts`,
    );
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone format (E.164 format preferred)
   */
  private isValidPhone(phone: string): boolean {
    // Accept formats: +5511999999999 or 11999999999 (10-15 digits)
    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    return phoneRegex.test(phone.replace(/[\s\-()]/g, ''));
  }

  /**
   * Check if identifier is locked out
   */
  private checkLockout(identifier: string): { isLocked: boolean; remainingMs: number } {
    const attempt = this.loginAttempts.get(identifier);

    if (!attempt || !attempt.lockedUntil) {
      return { isLocked: false, remainingMs: 0 };
    }

    const now = Date.now();
    if (now < attempt.lockedUntil) {
      return { isLocked: true, remainingMs: attempt.lockedUntil - now };
    }

    // Lockout expired, clear it
    this.loginAttempts.delete(identifier);
    return { isLocked: false, remainingMs: 0 };
  }

  /**
   * Record a failed login attempt
   */
  private recordFailedAttempt(identifier: string): void {
    const now = Date.now();
    const attempt = this.loginAttempts.get(identifier);

    if (!attempt || now - attempt.lastAttempt > this.LOCKOUT_WINDOW_MS) {
      // First attempt or window expired
      this.loginAttempts.set(identifier, {
        count: 1,
        lastAttempt: now,
      });
      return;
    }

    // Increment counter
    attempt.count++;
    attempt.lastAttempt = now;

    // Check if should lock
    if (attempt.count >= this.MAX_LOGIN_ATTEMPTS) {
      attempt.lockedUntil = now + this.LOCKOUT_WINDOW_MS;
      this.logger.warn(`[ACCOUNT_LOCKED] ${this.maskIdentifier(identifier)} locked for ${this.LOCKOUT_WINDOW_MS / 60000} minutes`);
    }
  }

  /**
   * Clear login attempts on successful login
   */
  private clearLoginAttempts(identifier: string): void {
    this.loginAttempts.delete(identifier);
  }

  /**
   * Mask identifier for logging (privacy)
   */
  private maskIdentifier(identifier: string): string {
    if (identifier.includes('@')) {
      const [name, domain] = identifier.split('@');
      return `${name.substring(0, 2)}***@${domain}`;
    }
    return `***${identifier.slice(-4)}`;
  }

  /**
   * Sleep utility for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate JWT token for musician
   */
  async generateToken(musicianId: string, role: string): Promise<string> {
    const payload = {
      sub: musicianId,
      role,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Get musician profile by ID
   * Validates JWT claims
   */
  async getMusicianProfile(musicianId: string): Promise<Musician> {
    if (!musicianId || typeof musicianId !== 'string') {
      throw new BadRequestException('Invalid musician ID');
    }

    const musician = await this.prisma.musician.findUnique({
      where: { id: musicianId },
    });

    if (!musician) {
      this.logger.warn(`[PROFILE_NOT_FOUND] musicianId: ${musicianId}`);
      throw new BadRequestException('Musician not found');
    }

    return musician;
  }

  /**
   * Update musician profile
   * Allows musicians to fill in name, instrument, level, and contact after login
   */
  async updateProfile(musicianId: string, updateData: any): Promise<Musician> {
    if (!musicianId || typeof musicianId !== 'string') {
      throw new BadRequestException('Invalid musician ID');
    }

    // Verify musician exists
    const musician = await this.prisma.musician.findUnique({
      where: { id: musicianId },
    });

    if (!musician) {
      throw new BadRequestException('Musician not found');
    }

    // Update only provided fields
    const updatePayload = {};
    if (updateData.name !== undefined) {
      updatePayload['name'] = updateData.name;
    }
    if (updateData.instrument !== undefined) {
      updatePayload['instrument'] = updateData.instrument;
    }
    if (updateData.level !== undefined) {
      updatePayload['level'] = updateData.level;
    }
    if (updateData.contact !== undefined) {
      updatePayload['contact'] = updateData.contact;
    }

    const updatedMusician = await this.prisma.musician.update({
      where: { id: musicianId },
      data: updatePayload,
    });

    this.logger.log(`[PROFILE_UPDATED] musicianId: ${musicianId}`);
    return updatedMusician;
  }

  /**
   * Create new musician from login credentials
   * Name is set to null and deferred to profile setup
   */
  private async createMusicianFromLogin(
    email?: string,
    phone?: string,
  ): Promise<Musician> {
    const musician = await this.prisma.musician.create({
      data: {
        name: null,
        email: email || null,
        phone: phone || null,
        instrument: null,
        level: null,
        isHost: false,
      },
    });

    return musician;
  }
}
