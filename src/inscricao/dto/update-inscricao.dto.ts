import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RegistrationStatus } from '@prisma/client';

export class UpdateRegistrationDto {
  @ApiProperty({
    description: 'Instrument to play',
    required: false,
  })
  @IsString()
  @IsOptional()
  instrument?: string;

  @ApiProperty({
    description: 'Registration status',
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    required: false,
  })
  @IsEnum(RegistrationStatus)
  @IsOptional()
  status?: RegistrationStatus;
}
