import { ApiProperty } from '@nestjs/swagger';
import { MusicaResponseDto } from './musica-response.dto';
import { RegistrationResponseDto } from './registration-response.dto';

export class LiveStateSongDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  jamId: string;

  @ApiProperty()
  musicId: string;

  @ApiProperty()
  order: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({
    nullable: true,
    description: 'When the song started playing',
  })
  startedAt?: Date | null;

  @ApiProperty({
    nullable: true,
    description: 'When the song was paused (if paused)',
  })
  pausedAt?: Date | null;

  @ApiProperty({
    nullable: true,
    description: 'When the song was completed',
  })
  completedAt?: Date | null;

  @ApiProperty({ type: MusicaResponseDto })
  music: MusicaResponseDto;

  @ApiProperty({
    type: [RegistrationResponseDto],
    required: false,
  })
  registrations?: RegistrationResponseDto[];
}

export class LiveStateResponseDto {
  @ApiProperty({
    type: LiveStateSongDto,
    nullable: true,
    description: 'Current song being played (IN_PROGRESS status)',
  })
  currentSong: LiveStateSongDto | null;

  @ApiProperty({
    type: [LiveStateSongDto],
    description: 'Next 3 scheduled songs',
  })
  nextSongs: LiveStateSongDto[];

  @ApiProperty({
    type: [LiveStateSongDto],
    required: false,
    description: 'Previously played songs (up to 3)',
  })
  previousSongs?: LiveStateSongDto[];

  @ApiProperty({
    type: [LiveStateSongDto],
    required: false,
    description: 'Suggested songs in the jam',
  })
  suggestedSongs?: LiveStateSongDto[];

  @ApiProperty({
    description: 'Current jam status',
  })
  jamStatus: string;

  @ApiProperty({
    enum: ['STOPPED', 'PLAYING', 'PAUSED'],
    description: 'Current playback state',
  })
  playbackState: string;

  @ApiProperty({
    nullable: true,
    description: 'When the current song started playing',
  })
  currentSongStartedAt: Date | null;

  @ApiProperty({
    nullable: true,
    description: 'When the current song was paused (if paused)',
  })
  currentSongPausedAt: Date | null;

  @ApiProperty({
    description: 'Timestamp of response',
  })
  timestamp: number;
}

