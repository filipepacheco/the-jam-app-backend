import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRegistrationDto {
  @ApiProperty({ description: 'Schedule ID' })
  @IsUUID()
  @IsNotEmpty()
  scheduleId: string;

  @ApiProperty({
    description: 'Deprecated. Registrations must always be created by the authenticated musician.',
    required: false,
    deprecated: true,
  })
  @IsUUID()
  @IsOptional()
  musicianId?: string;

  @ApiProperty({ description: 'Instrument to play' })
  @IsString()
  @IsNotEmpty()
  instrument: string;
}
