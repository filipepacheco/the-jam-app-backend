import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MusicianLevel } from '@prisma/client';

export class UpdateProfileDto {
  @ApiProperty({ description: 'Musician name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Musician instrument', required: false })
  @IsString()
  @IsOptional()
  instrument?: string;

  @ApiProperty({
    description: 'Musician level',
    enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL'],
    required: false
  })
  @IsEnum(MusicianLevel)
  @IsOptional()
  level?: MusicianLevel;

  @ApiProperty({ description: 'Musician contact (phone or email)', required: false })
  @IsString()
  @IsOptional()
  contact?: string;
}

