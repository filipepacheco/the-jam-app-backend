import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsArray, IsString } from 'class-validator';

export class ControlJamActionPayloadDto {
  @ApiProperty({
    description: 'Array of schedule IDs in desired order (for reorder action)',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scheduleIds?: string[];
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

