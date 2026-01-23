import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsNumber, IsUUID, Min, ValidateNested } from 'class-validator';

export class ScheduleOrderUpdateDto {
  @ApiProperty({ description: 'Schedule ID', format: 'uuid' })
  @IsUUID('4', { message: 'scheduleId must be a valid UUID' })
  scheduleId: string;

  @ApiProperty({ description: 'New order position (1-based)', minimum: 1 })
  @IsNumber()
  @Min(1)
  order: number;
}

export class ReorderSchedulesDto {
  @ApiProperty({
    description: 'Array of schedule order updates',
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
