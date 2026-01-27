import { ApiProperty } from '@nestjs/swagger';

export class ExportResultDto {
  @ApiProperty({ description: 'Spotify playlist ID' })
  spotifyPlaylistId: string;

  @ApiProperty({ description: 'Spotify playlist URL' })
  spotifyPlaylistUrl: string;

  @ApiProperty({ description: 'Total tracks added to playlist' })
  totalTracks: number;

  @ApiProperty({ description: 'Tracks skipped (no valid Spotify link)' })
  skippedTracks: number;

  @ApiProperty({ description: 'Error details for skipped tracks', required: false })
  errors?: string[];
}
