import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { ScheduleOrderUpdateDto } from './reorder-schedules.dto';

export class ControlJamActionPayloadDto {
  @ApiProperty({
    description: 'Array of schedule order updates (for reorder action)',
    type: [ScheduleOrderUpdateDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleOrderUpdateDto)
  updates?: ScheduleOrderUpdateDto[];
}

export class ControlJamActionDto {
  @ApiProperty({
    description: 'Control action type',
    enum: ['play', 'pause', 'skip', 'reorder'],
  })
  @IsIn(['play', 'pause', 'skip', 'reorder'])
  action: 'play' | 'pause' | 'skip' | 'reorder';

  @ApiProperty({
    description: 'Action payload',
    type: ControlJamActionPayloadDto,
    required: false,
  })
  @IsOptional()
  payload?: ControlJamActionPayloadDto;
}
