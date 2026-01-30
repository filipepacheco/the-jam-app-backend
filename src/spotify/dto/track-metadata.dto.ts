import { ApiProperty } from '@nestjs/swagger';

export class TrackMetadataDto {
  @ApiProperty({ description: 'Spotify track ID' })
  id: string;

  @ApiProperty({ description: 'Track title' })
  title: string;

  @ApiProperty({ description: 'Artist name(s), comma-separated if multiple' })
  artist: string;

  @ApiProperty({ description: 'Track duration in milliseconds' })
  durationMs: number;

  @ApiProperty({ description: 'Spotify URL for the track' })
  spotifyUrl: string;

  @ApiProperty({ description: 'Album name', required: false })
  albumName?: string;

  @ApiProperty({ description: 'Album cover image URL', required: false })
  albumImageUrl?: string;
}
