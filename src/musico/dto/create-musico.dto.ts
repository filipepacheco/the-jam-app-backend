import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

enum MusicianLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  PROFESSIONAL = 'PROFESSIONAL',
}

export class CreateMusicianDto {
  @ApiProperty({ description: 'Musician name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Musician contact' })
  @IsString()
  @IsOptional()
  contact?: string;

  @ApiProperty({ description: 'Primary instrument' })
  @IsString()
  @IsNotEmpty()
  instrument: string;

  @ApiProperty({
    description: 'Experience level',
    enum: MusicianLevel,
  })
  @IsEnum(MusicianLevel)
  @IsNotEmpty()
  level: MusicianLevel;
}
