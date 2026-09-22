import { ApiProperty } from '@nestjs/swagger';
import { JamMusicaResponseDto } from './jam-musica-response.dto';
import { RegistrationResponseDto } from './registration-response.dto';
import { ScheduleResponseDto } from './schedule-response.dto';

export class JamResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  hostName?: string;

  @ApiProperty({ required: false })
  description?: string | null;

  @ApiProperty({ required: false })
  date?: Date | null;

  @ApiProperty({ required: false })
  location?: string | null;

  @ApiProperty({ required: false })
  qrCode?: string | null;

  @ApiProperty({ required: false })
  slug?: string | null;

  @ApiProperty({ required: false })
  shortCode?: string | null;

  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'LIVE', 'FINISHED'] })
  status: string;

  @ApiProperty({ enum: ['OWNER_ONLY', 'SHARED_HOSTS'] })
  managementMode: string;

  @ApiProperty({ required: false })
  spotifyPlaylistUrl?: string | null;

  @ApiProperty({
    description: 'Whether new performance registrations are approved automatically',
    required: false,
  })
  autoApproveRegistrations?: boolean;

  @ApiProperty({ enum: ['STOPPED', 'PLAYING', 'PAUSED'], required: false })
  playbackState?: string;

  @ApiProperty({ required: false })
  currentScheduleId?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [JamMusicaResponseDto], required: false })
  jamMusics?: JamMusicaResponseDto[];

  @ApiProperty({ type: [RegistrationResponseDto], required: false })
  registrations?: RegistrationResponseDto[];

  @ApiProperty({ type: [ScheduleResponseDto], required: false })
  schedules?: ScheduleResponseDto[];

  @ApiProperty({
    description: 'Distinct musicians with a pending or approved registration in this jam',
    required: false,
  })
  registeredMusicianCount?: number;
}
