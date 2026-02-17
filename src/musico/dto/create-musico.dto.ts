import { IsString, IsNotEmpty, IsEnum, IsOptional, MaxLength } from 'class-validator';
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
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Musician contact' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
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
