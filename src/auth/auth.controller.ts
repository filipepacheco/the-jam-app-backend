import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SyncSupabaseUserDto } from './dto/sync-supabase-user.dto';
import { JwtAuthGuard } from './guards/jwt.guard';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';

@ApiTags('Authentication')
@Controller('auth')
@UseInterceptors(LoggingInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Login or auto-register with email or phone' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Account locked due to too many failed attempts' })
  @ApiResponse({ status: 429, description: 'Too many requests - rate limited' })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('sync-user')
  @ApiOperation({
    summary: 'Sync Supabase user to local database',
    description: 'Step 5: Endpoint for Supabase OAuth flow. Verifies Supabase token and syncs user data.',
  })
  @ApiBody({
    type: SyncSupabaseUserDto,
    description: 'Supabase authentication token',
  })
  @ApiResponse({
    status: 200,
    description: 'User synced successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Supabase not configured' })
  @ApiResponse({ status: 401, description: 'Invalid Supabase token' })
  async syncSupabaseUser(
    @Body() body: SyncSupabaseUserDto,
  ): Promise<AuthResponseDto> {
    return this.authService.syncSupabaseUser(body.token);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing token' })
  async logout(@Request() req): Promise<{ message: string }> {
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing token' })
  async getProfile(@Request() req) {
    return this.authService.getMusicianProfile(req.user.musicianId);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update musician profile (name, instrument, level, contact)' })
  @ApiBody({
    type: UpdateProfileDto,
    description: 'Profile fields to update',
  })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing token' })
  async updateProfile(@Request() req, @Body() updateProfileDto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.musicianId, updateProfileDto);
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
