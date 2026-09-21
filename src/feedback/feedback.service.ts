import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackResponseDto } from './dto/feedback-response.dto';
import { FeedbackQueryDto, FeedbackListResponseDto } from './dto/feedback-list.dto';
import { FEEDBACK_RATE_LIMIT, FEEDBACK_RATE_WINDOW_MS } from '../common/constants';
import { normalizeClientIp } from '../common/client-identity';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateFeedbackDto,
    musicianId: string | null,
    ipAddress: string,
  ): Promise<FeedbackResponseDto> {
    const now = Date.now();
    const windowStart = new Date(now - FEEDBACK_RATE_WINDOW_MS);
    const clientIp = normalizeClientIp(ipAddress);
    const quotaKey = `feedback:${clientIp}`;

    const feedback = await this.prisma.$transaction(async (tx) => {
      // Serialize submissions for this client across every API instance.
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${quotaKey}, 0))::text AS lock
      `;

      const recent = await tx.feedback.findMany({
        where: {
          ipAddress: clientIp,
          createdAt: { gte: windowStart },
        },
        orderBy: { createdAt: 'asc' },
        take: FEEDBACK_RATE_LIMIT,
        select: { createdAt: true },
      });

      if (recent.length >= FEEDBACK_RATE_LIMIT) {
        const retryAfter = Math.max(
          1,
          Math.ceil((recent[0].createdAt.getTime() + FEEDBACK_RATE_WINDOW_MS - now) / 1000),
        );
        throw new HttpException(
          {
            message: 'Feedback submission limit exceeded',
            error: 'Too Many Requests',
            retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return tx.feedback.create({
        data: {
          rating: dto.rating,
          comment: dto.comment,
          userAgent: dto.userAgent,
          pageUrl: dto.pageUrl,
          ipAddress: clientIp,
          musicianId,
        },
      });
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
