import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({ type: Object })
  music: any;

  @ApiProperty({
    type: [Object],
    required: false,
  })
  registrations?: any[];
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
    description: 'Current jam status',
  })
  jamStatus: string;

  @ApiProperty({
    description: 'Timestamp of response',
  })
  timestamp: number;
}

