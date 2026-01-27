import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExportPlaylistDto {
  @ApiProperty({ description: 'Jam ID to export' })
  @IsUUID()
  @IsNotEmpty()
  jamId: string;

  @ApiProperty({ description: 'Spotify OAuth access token from frontend' })
  @IsString()
  @IsNotEmpty()
  spotifyAccessToken: string;

  @ApiProperty({ description: 'Playlist name (defaults to jam name)', required: false })
  @IsString()
  @IsOptional()
  playlistName?: string;

  @ApiProperty({ description: 'Playlist description', required: false })
  @IsString()
  @IsOptional()
  playlistDescription?: string;

  @ApiProperty({
    description: 'Whether the playlist should be public',
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  public?: boolean;
}
