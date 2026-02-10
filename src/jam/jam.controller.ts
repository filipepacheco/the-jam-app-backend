import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  NotFoundException,
  HttpCode,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JamService } from './jam.service';
import { JamPlaybackService } from './jam-playback.service';
import { JamLiveStateService } from './jam-live-state.service';
import { CreateJamDto } from './dto/create-jam.dto';
import { UpdateJamDto } from './dto/update-jam.dto';
import { ReorderSchedulesDto } from './dto/reorder-schedules.dto';
import { JamResponseDto } from './dto/jam-response.dto';
import { LiveStateResponseDto } from './dto/live-state-response.dto';
import { LiveDashboardResponseDto } from './dto/live-dashboard-response.dto';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import { ProtectedRoute } from '../common/decorators/protected-route.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { DEFAULT_HISTORY_LIMIT, MAX_HISTORY_LIMIT } from '../common/constants';

@ApiTags('Jams')
@Controller('jams')
export class JamController {
  constructor(
    private readonly jamService: JamService,
    private readonly jamPlaybackService: JamPlaybackService,
    private readonly jamLiveStateService: JamLiveStateService,
  ) {}

  private async findJamOrFail(id: string) {
    const jam = await this.jamService.findOne(id);
    if (!jam) {
      throw new NotFoundException(`Jam with ID ${id} not found`);
    }
    return jam;
  }

  @Post()
  @ProtectedRoute('host', 'admin', 'user')
  @ApiOperation({ summary: 'Create a new jam session' })
  @ApiResponse({
    status: 201,
    description: 'Jam created successfully',
    type: JamResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  create(@Body() createJamDto: CreateJamDto, @Request() _req) {
    return this.jamService.create(createJamDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all jams with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of jams',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/JamResponseDto' } },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            skip: { type: 'number' },
            take: { type: 'number' },
            hasMore: { type: 'boolean' },
          },
        },
      },
    },
  })
  findAll(@Query() pagination: PaginationDto) {
    return this.jamService.findAll(pagination.skip, pagination.take);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get jam by ID' })
  @ApiResponse({ status: 200, description: 'Jam found', type: JamResponseDto })
  @ApiResponse({ status: 404, description: 'Jam not found' })
  findOne(@Param('id') id: string) {
    return this.jamService.findOne(id);
  }

  @Get(':id/live/state')
  @ApiOperation({ summary: 'Get live jam state for polling fallback' })
  @ApiResponse({
    status: 200,
    description: 'Current jam live state',
    type: LiveStateResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Jam not found' })
  async getLiveState(@Param('id') id: string): Promise<LiveStateResponseDto> {
    return this.jamLiveStateService.getLiveState(id);
  }

  @Get(':id/live/dashboard')
  @ApiOperation({ summary: 'Get live jam dashboard data (current and next songs with musicians)' })
  @ApiResponse({
    status: 200,
    description: 'Live jam dashboard data',
    type: LiveDashboardResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Jam not found' })
  async getLiveDashboard(@Param('id') id: string): Promise<LiveDashboardResponseDto> {
    return this.jamLiveStateService.getLiveDashboard(id);
  }

  @Post(':id/control/start')
  @HttpCode(200)
  @ProtectedRoute('host', 'admin')
  @ApiOperation({ summary: 'Start jam playback (starts first scheduled song)' })
  @ApiResponse({ status: 200, description: 'Jam started successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not jam host' })
  @ApiResponse({ status: 404, description: 'Jam not found' })
  async startJam(@Param('id') jamId: string, @Request() req) {
    await this.findJamOrFail(jamId);
    return this.jamPlaybackService.startJam(jamId, req.user?.id);
  }

  @Post(':id/control/stop')
  @HttpCode(200)
  @ProtectedRoute('host', 'admin')
  @ApiOperation({ summary: 'Stop jam playback' })
  @ApiResponse({ status: 200, description: 'Jam stopped successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not jam host' })
  @ApiResponse({ status: 404, description: 'Jam not found' })
  async stopJam(@Param('id') jamId: string, @Request() req) {
    await this.findJamOrFail(jamId);
    return this.jamPlaybackService.stopJam(jamId, req.user?.id);
  }

  @Post(':id/control/next')
  @HttpCode(200)
  @ProtectedRoute('host', 'admin')
  @ApiOperation({ summary: 'Skip to next song' })
  @ApiResponse({ status: 200, description: 'Skipped to next song' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not jam host' })
  @ApiResponse({ status: 404, description: 'Jam not found' })
  async nextSong(@Param('id') jamId: string, @Request() req) {
    await this.findJamOrFail(jamId);
    return this.jamPlaybackService.nextSong(jamId, req.user?.id);
  }

  @Post(':id/control/previous')
  @HttpCode(200)
  @ProtectedRoute('host', 'admin')
  @ApiOperation({ summary: 'Go back to previous song' })
  @ApiResponse({ status: 200, description: 'Returned to previous song' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not jam host' })
  @ApiResponse({ status: 404, description: 'Jam not found' })
  async previousSong(@Param('id') jamId: string, @Request() req) {
    await this.findJamOrFail(jamId);
    return this.jamPlaybackService.previousSong(jamId, req.user?.id);
  }

  @Post(':id/control/pause')
  @HttpCode(200)
  @ProtectedRoute('host', 'admin')
  @ApiOperation({ summary: 'Pause current song' })
  @ApiResponse({ status: 200, description: 'Song paused' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not jam host' })
  @ApiResponse({ status: 404, description: 'Jam not found' })
  async pauseSong(@Param('id') jamId: string, @Request() req) {
    await this.findJamOrFail(jamId);
    return this.jamPlaybackService.pauseSong(jamId, req.user?.id);
  }

  @Post(':id/control/resume')
  @HttpCode(200)
  @ProtectedRoute('host', 'admin')
  @ApiOperation({ summary: 'Resume paused song' })
  @ApiResponse({ status: 200, description: 'Song resumed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not jam host' })
  @ApiResponse({ status: 404, description: 'Jam not found' })
  async resumeSong(@Param('id') jamId: string, @Request() req) {
    await this.findJamOrFail(jamId);
    return this.jamPlaybackService.resumeSong(jamId, req.user?.id);
  }

  @Post(':id/control/reorder')
  @HttpCode(200)
  @ProtectedRoute('host', 'admin')
  @ApiOperation({ summary: 'Reorder schedules in jam queue (drag and drop support)' })
  @ApiResponse({ status: 200, description: 'Queue reordered successfully', type: JamResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid schedule IDs or validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not jam host' })
  @ApiResponse({ status: 404, description: 'Jam not found' })
  async reorderSchedules(
    @Param('id') jamId: string,
    @Body() dto: ReorderSchedulesDto,
    @Request() req,
  ) {
    await this.findJamOrFail(jamId);
    return this.jamPlaybackService.reorderSchedules(jamId, dto.updates, req.user?.id);
  }

  @Get(':id/playback-history')
  @UseGuards(SupabaseJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get playback history for jam' })
  @ApiResponse({ status: 200, description: 'Playback history retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Jam not found' })
  async getPlaybackHistory(@Param('id') jamId: string, @Query('limit') limitParam?: string) {
    let limit = limitParam ? parseInt(limitParam, 10) : DEFAULT_HISTORY_LIMIT;
    if (isNaN(limit) || limit < 1) limit = DEFAULT_HISTORY_LIMIT;
    if (limit > MAX_HISTORY_LIMIT) limit = MAX_HISTORY_LIMIT;
    return this.jamPlaybackService.getPlaybackHistory(jamId, limit);
  }

  @Patch(':id')
  @ProtectedRoute('host', 'admin', 'user')
  @ApiOperation({ summary: 'Update jam' })
  @ApiResponse({ status: 200, description: 'Jam updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  update(@Param('id') id: string, @Body() updateJamDto: UpdateJamDto) {
    return this.jamService.update(id, updateJamDto);
  }

  @Delete(':id')
  @ProtectedRoute('host', 'admin')
  @ApiOperation({ summary: 'Delete jam' })
  @ApiResponse({ status: 200, description: 'Jam deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  remove(@Param('id') id: string) {
    return this.jamService.remove(id);
  }
}
