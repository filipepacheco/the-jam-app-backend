import { IsString, IsNotEmpty, IsOptional, IsDateString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ImportPlaylistDto {
  @ApiProperty({ description: 'Spotify playlist URL or URI' })
  @IsString()
  @IsNotEmpty()
  playlistUrl: string;

  @ApiProperty({
    description: 'Jam ID to import into (if omitted, creates new jam)',
    required: false,
  })
  @IsString()
  @IsOptional()
  @IsUUID()
  jamId?: string;

  @ApiProperty({
    description: 'Jam name (defaults to playlist name, ignored if jamId provided)',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Jam description (defaults to playlist description, ignored if jamId provided)',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Jam date in ISO 8601 format (ignored if jamId provided)',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiProperty({ description: 'Jam location (ignored if jamId provided)', required: false })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ description: 'Custom URL slug for the jam (ignored if jamId provided)', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Slug must be lowercase alphanumeric with hyphens' })
  slug?: string;
}
