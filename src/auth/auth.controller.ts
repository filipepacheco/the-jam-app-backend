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
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { MusicianLevel } from '@prisma/client';
import { AuthService } from './auth.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { ProtectedRoute } from '../common/decorators/protected-route.decorator';
import { MusicianProfileResponseDto } from './dto/musician-profile-response.dto';

@ApiTags('Authentication')
@Controller('auth')
@UseGuards(ThrottlerGuard)
@UseInterceptors(LoggingInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('logout')
  @ProtectedRoute()
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing token' })
  async logout(@Request() _req): Promise<{ message: string }> {
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @ProtectedRoute()
  @ApiOperation({ summary: 'Get current user profile with registration status' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved',
    type: MusicianProfileResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing token' })
  async getProfile(@Request() req): Promise<MusicianProfileResponseDto> {
    const musician = await this.authService.getMusicianProfile(req.user.musicianId);
    return this.toProfileResponse(musician);
  }

  @Patch('profile')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ProtectedRoute()
  @ApiOperation({
    summary: 'Update musician profile (name, instrument, level, contact, phone, isHost)',
  })
  @ApiBody({
    type: UpdateProfileDto,
    description: 'Profile fields to update',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: MusicianProfileResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing token' })
  async updateProfile(
    @Request() req,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<MusicianProfileResponseDto> {
    const updatedMusician = await this.authService.updateProfile(
      req.user.musicianId,
      updateProfileDto,
    );
    return this.toProfileResponse(updatedMusician);
  }

  private toProfileResponse(musician: {
    id: string;
    supabaseUserId: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    contact: string | null;
    instrument: string | null;
    level: MusicianLevel | null;
    isHost: boolean;
    createdAt: Date;
  }): MusicianProfileResponseDto {
    const registrationComplete = this.authService.isRegistrationComplete(musician);
    return {
      id: musician.id,
      supabaseUserId: musician.supabaseUserId,
      name: musician.name,
      email: musician.email,
      phone: musician.phone,
      contact: musician.contact,
      instrument: musician.instrument,
      level: musician.level,
      isHost: musician.isHost,
      role: musician.isHost ? 'host' : 'user',
      registrationComplete,
      isNewUser: !registrationComplete,
      createdAt: musician.createdAt,
    };
  }
}
