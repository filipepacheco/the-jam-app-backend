import { IsString, IsOptional, IsIn } from 'class-validator';
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
    description: 'Host-managed registration status. Use DELETE to withdraw an application.',
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    required: false,
  })
  @IsIn([RegistrationStatus.PENDING, RegistrationStatus.APPROVED, RegistrationStatus.REJECTED])
  @IsOptional()
  status?: RegistrationStatus;
}
