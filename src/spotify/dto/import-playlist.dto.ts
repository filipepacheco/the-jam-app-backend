import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ImportPlaylistDto {
  @ApiProperty({ description: 'Spotify playlist URL or URI' })
  @IsString()
  @IsNotEmpty()
  playlistUrl: string;

  @ApiProperty({ description: 'Jam name (defaults to playlist name)', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Jam description (defaults to playlist description)',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Jam date in ISO 8601 format', required: false })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiProperty({ description: 'Jam location', required: false })
  @IsString()
  @IsOptional()
  location?: string;
}
