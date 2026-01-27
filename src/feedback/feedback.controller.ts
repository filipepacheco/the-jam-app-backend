import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Ip,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackResponseDto } from './dto/feedback-response.dto';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';

@ApiTags('Feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

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
