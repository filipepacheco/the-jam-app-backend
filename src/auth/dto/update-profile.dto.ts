import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MusicianLevel } from '@prisma/client';

export class UpdateProfileDto {
  @ApiProperty({ description: 'Musician name', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiProperty({
    description: 'Musician instrument (drums, guitar, vocals, bass, keys, etc.)',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
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
  @MaxLength(255)
  contact?: string;

  @ApiProperty({ description: 'Phone number', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  phone?: string;
}
