import { ApiProperty } from '@nestjs/swagger';
import { DashboardMusicianDto } from './live-dashboard-response.dto';

export class LiveStateMusicDto {
  @ApiProperty()
  title: string;

  @ApiProperty()
  artist: string;

  @ApiProperty({ nullable: true })
  duration: number | null;

  @ApiProperty({ nullable: true, required: false })
  link?: string | null;
}

export class LiveStateSongDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  order: number;

  @ApiProperty()
  status: string;

  @ApiProperty({
    nullable: true,
    description: 'When the song started playing',
  })
  startedAt?: Date | null;

  @ApiProperty({
    nullable: true,
    description: 'When the song was completed',
  })
  completedAt?: Date | null;

  @ApiProperty({ type: LiveStateMusicDto })
  music: LiveStateMusicDto;

  @ApiProperty({
    type: [DashboardMusicianDto],
    description: 'Musicians performing this song',
  })
  musicians: DashboardMusicianDto[];
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
    description: 'Next scheduled songs',
  })
  nextSongs: LiveStateSongDto[];

  @ApiProperty({
    type: [LiveStateSongDto],
    required: false,
    description: 'Previously played songs',
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
}
