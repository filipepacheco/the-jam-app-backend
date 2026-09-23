import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  Max,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

export class ScheduleOrderUpdateDto {
  @ApiProperty({ description: 'Schedule ID', format: 'uuid' })
  @IsUUID('4', { message: 'scheduleId must be a valid UUID' })
  scheduleId: string;

  @ApiProperty({
    description: 'Saved absolute position; omitted songs keep their positions',
    minimum: -2_147_483_648,
    maximum: 2_147_483_647,
  })
  @IsInt()
  @Min(-2_147_483_648)
  @Max(2_147_483_647)
  order: number;
}

export class ReorderSchedulesDto {
  @ApiPropertyOptional({
    description: 'Opaque queueRevision returned by live/state. Stale writes return 409.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  expectedRevision?: string;

  @ApiProperty({
    description:
      'Assign exact saved positions. Omitted songs remain fixed; include every displaced song. The actively playing song cannot move.',
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
