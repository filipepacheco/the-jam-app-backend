import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRegistrationDto {
  @ApiProperty({ description: 'Schedule ID' })
  @IsUUID()
  @IsNotEmpty()
  scheduleId: string;

  @ApiProperty({
    description:
      'Defaults to the authenticated musician. Authorized jam hosts may register another musician.',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  musicianId?: string;

  @ApiProperty({ description: 'Instrument to play' })
  @IsString()
  @IsNotEmpty()
  instrument: string;
}
