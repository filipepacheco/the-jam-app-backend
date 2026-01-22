import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MusicStatus } from '@prisma/client';

export class CreateMusicDto {
  @ApiProperty({ description: 'Music title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Artist name' })
  @IsString()
  @IsNotEmpty()
  artist: string;

  @ApiProperty({ description: 'Music genre', required: false, nullable: true })
  @IsString()
  @IsOptional()
  genre?: string | null;

  @ApiProperty({ description: 'Duration in seconds', required: false, nullable: true })
  @IsInt()
  @Min(1)
  @IsOptional()
  duration?: number | null;

  @ApiProperty({ description: 'Music description', required: false, nullable: true })
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiProperty({
    description: 'Link to music (YouTube, Spotify, etc)',
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  link?: string | null;

  @ApiProperty({
    description: 'Music status',
    enum: MusicStatus,
    default: MusicStatus.SUGGESTED,
    required: false,
  })
  @IsEnum(MusicStatus)
  @IsOptional()
  status?: MusicStatus;

  @ApiProperty({ description: 'Number of drummers needed', example: 0, default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  neededDrums?: number;

  @ApiProperty({ description: 'Number of guitarists needed', example: 0, default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  neededGuitars?: number;

  @ApiProperty({ description: 'Number of vocalists needed', example: 0, default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  neededVocals?: number;

  @ApiProperty({ description: 'Number of bassists needed', example: 0, default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  neededBass?: number;

  @ApiProperty({ description: 'Number of keyboardists needed', example: 0, default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  neededKeys?: number;
}
