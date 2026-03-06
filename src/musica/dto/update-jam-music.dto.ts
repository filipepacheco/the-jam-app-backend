import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateJamMusicDto {
  @ApiProperty({ description: 'Arrangement notes (key, tempo, structure, etc.)', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}
