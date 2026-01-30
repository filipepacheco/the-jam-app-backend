import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class FeedbackQueryDto {
  @ApiProperty({ description: 'Page number (1-based)', default: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: 'Items per page', default: 20, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class FeedbackListItemDto {
  @ApiProperty({ description: 'Feedback ID (UUID)' })
  id: string;

  @ApiProperty({ description: 'Rating from 1 to 5' })
  rating: number;

  @ApiProperty({ description: 'Optional comment', required: false })
  comment?: string;

  @ApiProperty({ description: 'Page URL where feedback was submitted', required: false })
  pageUrl?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Musician ID if authenticated', required: false })
  musicianId?: string;

  @ApiProperty({ description: 'Musician name if authenticated', required: false })
  musicianName?: string;
}

export class FeedbackListResponseDto {
  @ApiProperty({ type: [FeedbackListItemDto], description: 'List of feedback items' })
  items: FeedbackListItemDto[];

  @ApiProperty({ description: 'Total number of feedback items' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;
}
