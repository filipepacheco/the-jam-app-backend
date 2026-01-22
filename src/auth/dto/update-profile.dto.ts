import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MusicianLevel } from '@prisma/client';

export class UpdateProfileDto {
  @ApiProperty({ description: 'Musician name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Musician instrument (drums, guitar, vocals, bass, keys, etc.)',
    required: false,
  })
  @IsString()
  @IsOptional()
  instrument?: string;

  @ApiProperty({
    description: 'Musician skill level',
    enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL'],
    required: false,
  })
  @IsEnum(MusicianLevel)
  @IsOptional()
  level?: MusicianLevel;

  @ApiProperty({ description: 'Contact phone number or secondary email', required: false })
  @IsString()
  @IsOptional()
  contact?: string;

  @ApiProperty({ description: 'Phone number', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ description: 'Whether user wants to host jams', required: false })
  @IsBoolean()
  @IsOptional()
  isHost?: boolean;
}
