import { IsInt, Min, Max, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFeedbackDto {
  @ApiProperty({ description: 'Rating from 1 to 5', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ description: 'Optional comment', required: false, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;

  @ApiProperty({ description: 'Browser user agent', required: false })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiProperty({ description: 'Page URL where feedback was submitted', required: false })
  @IsOptional()
  @IsString()
  pageUrl?: string;
}
