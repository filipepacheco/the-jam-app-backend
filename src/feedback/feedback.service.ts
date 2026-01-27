import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackResponseDto } from './dto/feedback-response.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateFeedbackDto,
    musicianId: string | null,
    ipAddress: string,
  ): Promise<FeedbackResponseDto> {
    const feedback = await this.prisma.feedback.create({
      data: {
        rating: dto.rating,
        comment: dto.comment,
        userAgent: dto.userAgent,
        pageUrl: dto.pageUrl,
        ipAddress,
        musicianId,
      },
    });

    return {
      id: feedback.id,
      rating: feedback.rating,
      comment: feedback.comment,
      createdAt: feedback.createdAt,
      musicianId: feedback.musicianId,
    };
  }
}
