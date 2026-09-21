import { IsNotEmpty, IsInt, Min, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ScheduleStatus } from '@prisma/client';

export class CreateScheduleDto {
  @ApiProperty({ description: 'Jam session ID' })
  @IsUUID()
  @IsNotEmpty()
  jamId: string;

  @ApiProperty({ description: 'Music ID' })
  @IsUUID()
  @IsNotEmpty()
  musicId: string;

  @ApiProperty({
    description: 'Legacy input; allocation appends after the highest occupied position',
    deprecated: true,
  })
  @IsInt()
  @Min(0)
  order: number;

  @ApiProperty({
    description:
      'Initial queue status. Musicians may suggest; hosts may suggest, schedule or cancel. Playback-owned IN_PROGRESS/COMPLETED are rejected.',
    enum: ScheduleStatus,
    required: false,
  })
  @IsEnum(ScheduleStatus)
  @IsOptional()
  status?: ScheduleStatus;
}
