import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ScheduleStatus } from '@prisma/client';
import { CreateScheduleDto } from './create-escala.dto';

export class UpdateScheduleDto extends PartialType(CreateScheduleDto) {
  @ApiPropertyOptional({ description: 'Must remain the existing jam ID; transfers are rejected' })
  jamId?: string;

  @ApiPropertyOptional({
    description: 'May change only before registration or playback history exists',
  })
  musicId?: string;

  @ApiPropertyOptional({
    description: 'Direct order edits are rejected with 400; use the jam queue reorder operation',
    deprecated: true,
  })
  order?: number;

  @ApiPropertyOptional({
    description: 'Only unplayed slots may change among SUGGESTED, SCHEDULED and CANCELED',
    enum: [ScheduleStatus.SUGGESTED, ScheduleStatus.SCHEDULED, ScheduleStatus.CANCELED],
  })
  status?: ScheduleStatus;
}
