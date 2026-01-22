import { ApiProperty } from '@nestjs/swagger';

export class PlaybackHistoryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({
    description: 'The action performed on the jam playback',
  })
  action: string;

  @ApiProperty({
    description: 'Timestamp when the action occurred',
  })
  timestamp: Date;

  @ApiProperty({
    description: 'The schedule ID associated with the action',
  })
  scheduleId: string;

  @ApiProperty({
    description: 'Song title',
  })
  songTitle: string;

  @ApiProperty({
    description: 'Song artist',
  })
  songArtist: string;

  @ApiProperty({
    nullable: true,
    description: 'Musician name if action relates to a musician',
  })
  performedBy: string | null;

  @ApiProperty({
    required: false,
    description: 'Additional metadata about the action',
  })
  metadata?: any;
}
