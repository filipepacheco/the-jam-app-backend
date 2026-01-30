import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Ip,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackResponseDto } from './dto/feedback-response.dto';
import { FeedbackQueryDto, FeedbackListResponseDto } from './dto/feedback-list.dto';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get()
  @UseGuards(SupabaseJwtGuard, RoleGuard)
  @Roles('host')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all feedback (host only)' })
  @ApiResponse({ status: 200, description: 'Paginated feedback list', type: FeedbackListResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - host role required' })
  async findAll(@Query() query: FeedbackQueryDto): Promise<FeedbackListResponseDto> {
    return this.feedbackService.findAll(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OptionalJwtGuard)
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @ApiOperation({ summary: 'Submit feedback (authentication optional)' })
  @ApiResponse({ status: 201, description: 'Feedback submitted', type: FeedbackResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async create(
    @Body() createFeedbackDto: CreateFeedbackDto,
    @Request() req,
    @Ip() ip: string,
  ): Promise<FeedbackResponseDto> {
    const musicianId = req.user?.musicianId || null;
    return this.feedbackService.create(createFeedbackDto, musicianId, ip);
  }
}
