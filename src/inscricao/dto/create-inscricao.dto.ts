import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRegistrationDto {
  @ApiProperty({ description: 'Schedule ID' })
  @IsString()
  @IsNotEmpty()
  scheduleId: string;

  @ApiProperty({ description: 'Musician ID (optional, only usable by hosts)', required: false })
  @IsString()
  @IsOptional()
  musicianId?: string;

  @ApiProperty({ description: 'Instrument to play', required: false })
  @IsString()
  @IsOptional()
  instrument?: string;
}
