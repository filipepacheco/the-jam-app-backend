import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsString, IsUUID } from 'class-validator';

export class ReorderSchedulesDto {
  @ApiProperty({
    description: 'Array of schedule IDs in the desired order',
    example: [
      '123e4567-e89b-12d3-a456-426614174000',
      '123e4567-e89b-12d3-a456-426614174001',
      '123e4567-e89b-12d3-a456-426614174002',
    ],
    type: [String],
  })
  @ArrayNotEmpty({ message: 'Schedule IDs array cannot be empty' })
  @ArrayUnique({ message: 'Schedule IDs must be unique' })
  @IsUUID('4', { each: true, message: 'Each schedule ID must be a valid UUID' })
  @IsString({ each: true })
  scheduleIds: string[];
}
