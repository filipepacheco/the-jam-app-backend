import { PartialType } from '@nestjs/mapped-types';
import { CreateJamDto } from './create-jam.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JamStatus } from '@prisma/client';

export class UpdateJamDto extends PartialType(CreateJamDto) {
  @ApiProperty({ description: 'Jam status', enum: JamStatus, required: false })
  @IsEnum(JamStatus)
  @IsOptional()
  status?: JamStatus;
}
