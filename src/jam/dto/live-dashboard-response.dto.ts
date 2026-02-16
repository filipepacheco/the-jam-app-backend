import { ApiProperty } from '@nestjs/swagger';

export class DashboardMusicianDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  instrument: string;
}

export class DashboardSongDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  artist: string;

  @ApiProperty({ nullable: true })
  duration: number | null;

  @ApiProperty({ nullable: true, required: false })
  link?: string | null;

  @ApiProperty({ type: [DashboardMusicianDto] })
  musicians: DashboardMusicianDto[];
}

export class LiveDashboardResponseDto {
  @ApiProperty({
    description: 'Jam ID',
  })
  jamId: string;

  @ApiProperty({
    description: 'Jam name',
  })
  jamName: string;

  @ApiProperty({
    nullable: true,
    description: 'Jam QR code (data URL)',
  })
  qrCode: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Jam slug for friendly URLs',
  })
  slug: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Jam short code for QR/typing',
  })
  shortCode: string | null;

  @ApiProperty({
    description: 'Current jam status',
  })
  jamStatus: string;

  @ApiProperty({
    type: DashboardSongDto,
    nullable: true,
    description: 'Current song being played (IN_PROGRESS status)',
  })
  currentSong: DashboardSongDto | null;

  @ApiProperty({
    type: [DashboardSongDto],
    description: 'Next up to 3 scheduled songs',
  })
  nextSongs: DashboardSongDto[];
}
