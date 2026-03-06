import { PartialType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';
import { CreateMusicianDto } from './create-musico.dto';

export class UpdateMusicianDto extends PartialType(CreateMusicianDto) {
  @ApiProperty({ description: 'Musician phone number', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  phone?: string;

  @ApiProperty({ description: 'Short biography / music background', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  bio?: string;

  @ApiProperty({ description: 'Other instruments (comma-separated)', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  otherInstruments?: string;
}
