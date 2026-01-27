import { ApiProperty } from '@nestjs/swagger';

export class FeedbackResponseDto {
  @ApiProperty({ description: 'Feedback ID (UUID)' })
  id: string;

  @ApiProperty({ description: 'Rating from 1 to 5' })
  rating: number;

  @ApiProperty({ description: 'Optional comment', required: false })
  comment?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Musician ID if authenticated', required: false })
  musicianId?: string;
}
