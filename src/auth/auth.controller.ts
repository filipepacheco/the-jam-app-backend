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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SupabaseJwtGuard } from './guards/supabase-jwt.guard';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';

import { MusicianProfileResponseDto } from './dto/musician-profile-response.dto';

@ApiTags('Authentication')
@Controller('auth')
@UseInterceptors(LoggingInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('logout')
  @UseGuards(SupabaseJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing token' })
  async logout(@Request() _req): Promise<{ message: string }> {
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(SupabaseJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile with registration status' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved',
    type: MusicianProfileResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing token' })
  async getProfile(@Request() req): Promise<MusicianProfileResponseDto> {
    const musician = await this.authService.getMusicianProfile(req.user.musicianId);
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
      registrationComplete,
      isNewUser: !registrationComplete,
      createdAt: musician.createdAt,
    };
  }

  @Patch('profile')
  @UseGuards(SupabaseJwtGuard)
  @ApiBearerAuth()
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
    const registrationComplete = this.authService.isRegistrationComplete(updatedMusician);

    return {
      id: updatedMusician.id,
      supabaseUserId: updatedMusician.supabaseUserId,
      name: updatedMusician.name,
      email: updatedMusician.email,
      phone: updatedMusician.phone,
      contact: updatedMusician.contact,
      instrument: updatedMusician.instrument,
      level: updatedMusician.level,
      isHost: updatedMusician.isHost,
      registrationComplete,
      isNewUser: !registrationComplete,
      createdAt: updatedMusician.createdAt,
    };
  }
}
