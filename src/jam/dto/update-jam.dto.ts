import { PartialType } from '@nestjs/swagger';
import { CreateJamDto } from './create-jam.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JamManagementMode, JamStatus } from '@prisma/client';

export class UpdateJamDto extends PartialType(CreateJamDto) {
  @ApiProperty({ description: 'Jam status', enum: JamStatus, required: false })
  @IsEnum(JamStatus)
  @IsOptional()
  status?: JamStatus;

  @ApiProperty({
    description:
      'Who may manage playback, queue actions, and registration approvals. Only the event owner may change this setting.',
    enum: JamManagementMode,
    required: false,
  })
  @IsEnum(JamManagementMode)
  @IsOptional()
  managementMode?: JamManagementMode;
}
