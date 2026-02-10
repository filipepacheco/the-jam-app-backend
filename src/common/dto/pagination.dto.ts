import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { DEFAULT_TAKE, MAX_TAKE } from '../constants';

export class PaginationDto {
  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description: 'Number of records to skip',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  skip?: number = 0;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_TAKE,
    default: DEFAULT_TAKE,
    description: 'Number of records to take',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_TAKE)
  @IsOptional()
  take?: number = DEFAULT_TAKE;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    skip: number;
    take: number;
    hasMore: boolean;
  };
}
