import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRegistrationDto {
  @ApiProperty({ description: 'Schedule ID' })
  @IsUUID()
  @IsNotEmpty()
  scheduleId: string;

  @ApiProperty({ description: 'Musician ID (optional, only usable by hosts)', required: false })
  @IsUUID()
  @IsOptional()
  musicianId?: string;

  @ApiProperty({ description: 'Instrument to play', required: false })
  @IsString()
  @IsOptional()
  instrument?: string;
}
