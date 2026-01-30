import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackResponseDto } from './dto/feedback-response.dto';
import { FeedbackQueryDto, FeedbackListResponseDto } from './dto/feedback-list.dto';

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

  async findAll(query: FeedbackQueryDto): Promise<FeedbackListResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.feedback.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          musician: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.feedback.count(),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        rating: item.rating,
        comment: item.comment,
        pageUrl: item.pageUrl,
        createdAt: item.createdAt,
        musicianId: item.musicianId,
        musicianName: item.musician?.name,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
