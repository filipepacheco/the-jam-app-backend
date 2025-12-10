import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRegistrationDto {
  @ApiProperty({ description: 'Musician ID' })
  @IsString()
  @IsNotEmpty()
  musicianId: string;

  @ApiProperty({ description: 'Schedule ID' })
  @IsString()
  @IsNotEmpty()
  scheduleId: string;

  @ApiProperty({ description: 'Instrument to play', required: false })
  @IsString()
  @IsOptional()
  instrument?: string;
}
