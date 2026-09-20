import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';

export class ScheduleOrderUpdateDto {
  @ApiProperty({ description: 'Schedule ID', format: 'uuid' })
  @IsUUID('4', { message: 'scheduleId must be a valid UUID' })
  scheduleId: string;

  @ApiProperty({
    description: 'Relative rank among supplied songs (positive, unique integer)',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  order: number;
}

export class ReorderSchedulesDto {
  @ApiProperty({
    description:
      'Move supplied songs to the front by rank; omitted songs retain relative order. The entire queue is renumbered from 1.',
    type: [ScheduleOrderUpdateDto],
    example: [
      { scheduleId: '123e4567-e89b-12d3-a456-426614174000', order: 1 },
      { scheduleId: '123e4567-e89b-12d3-a456-426614174001', order: 2 },
    ],
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'Updates array cannot be empty' })
  @ValidateNested({ each: true })
  @Type(() => ScheduleOrderUpdateDto)
  updates: ScheduleOrderUpdateDto[];
}
