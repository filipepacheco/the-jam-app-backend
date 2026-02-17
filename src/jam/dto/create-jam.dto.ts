import { IsString, IsNotEmpty, IsOptional, IsISO8601, IsUUID, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JamStatus } from '@prisma/client';

export class CreateJamDto {
  @ApiProperty({ description: 'Jam session name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Custom slug for friendly URLs. Lowercase alphanumeric and hyphens only. Auto-generated from name if not provided.',
    required: false,
    example: 'friday-night-rock',
  })
  @IsString()
  @IsOptional()
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens (e.g. "friday-night-rock")',
  })
  slug?: string;

  @ApiProperty({ description: 'Jam session description', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ description: 'Jam session date and time', required: false })
  @IsISO8601()
  @IsOptional()
  date?: string;

  @ApiProperty({ description: 'Jam session location' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ description: 'Host musician ID (UUID)', required: false })
  @IsUUID()
  @IsOptional()
  hostMusicianId?: string;

  @ApiProperty({ description: 'Host name (denormalized cache)', required: false })
  @IsString()
  @IsOptional()
  hostName?: string;

  @ApiProperty({ description: 'Host contact (denormalized cache)', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  hostContact?: string;

  @ApiProperty({ description: 'Jam session QR Code', required: false })
  @IsString()
  @IsOptional()
  qrCode?: string;

  @ApiProperty({
    description: 'Jam session status',
    required: false,
    enum: ['ACTIVE', 'INACTIVE', 'LIVE', 'FINISHED'],
  })
  @IsString()
  @IsOptional()
  status?: JamStatus;
}
