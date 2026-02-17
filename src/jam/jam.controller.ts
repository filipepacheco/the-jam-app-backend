import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  HttpCode,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JamService } from './jam.service';
import { JamPlaybackService } from './jam-playback.service';
import { JamLiveStateService } from './jam-live-state.service';
import { CreateJamDto } from './dto/create-jam.dto';
import { UpdateJamDto } from './dto/update-jam.dto';
import { ReorderSchedulesDto } from './dto/reorder-schedules.dto';
import { JamResponseDto } from './dto/jam-response.dto';
import { LiveStateResponseDto } from './dto/live-state-response.dto';
import { LiveDashboardResponseDto } from './dto/live-dashboard-response.dto';
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

  @Post()
  @ProtectedRoute('host', 'admin')
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

  @Get(':identifier')
  @ApiOperation({ summary: 'Get jam by ID, slug, or short code' })
  @ApiResponse({ status: 200, description: 'Jam found', type: JamResponseDto })
  @ApiResponse({ status: 404, description: 'Jam not found' })
  findOne(@Param('identifier') identifier: string) {
    return this.jamService.findByIdentifier(identifier);
  }

  @Get(':identifier/live/state')
  @ApiOperation({ summary: 'Get live jam state for polling fallback' })
  @ApiResponse({
    status: 200,
    description: 'Current jam live state',
    type: LiveStateResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Jam not found' })
  async getLiveState(@Param('identifier') identifier: string): Promise<LiveStateResponseDto> {
    const jamId = await this.jamService.resolveJamId(identifier);
    return this.jamLiveStateService.getLiveState(jamId);
  }

  @Get(':identifier/live/dashboard')
  @ApiOperation({ summary: 'Get live jam dashboard data (current and next songs with musicians)' })
  @ApiResponse({
    status: 200,
    description: 'Live jam dashboard data',
    type: LiveDashboardResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Jam not found' })
  async getLiveDashboard(@Param('identifier') identifier: string): Promise<LiveDashboardResponseDto> {
    const jamId = await this.jamService.resolveJamId(identifier);
    return this.jamLiveStateService.getLiveDashboard(jamId);
  }

  @Post(':id/control/start')
  @HttpCode(200)
  @ProtectedRoute('host', 'admin')
  @ApiOperation({ summary: 'Start jam playback (starts first scheduled song)' })
  @ApiResponse({ status: 200, description: 'Jam started successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not jam host' })
  @ApiResponse({ status: 404, description: 'Jam not found' })
  async startJam(@Param('id', ParseUUIDPipe) jamId: string, @Request() req) {
    return this.jamPlaybackService.startJam(jamId, req.user?.musicianId);
  }

  @Post(':id/control/stop')
  @HttpCode(200)
  @ProtectedRoute('host', 'admin')
  @ApiOperation({ summary: 'Stop jam playback' })
  @ApiResponse({ status: 200, description: 'Jam stopped successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not jam host' })
  @ApiResponse({ status: 404, description: 'Jam not found' })
  async stopJam(@Param('id', ParseUUIDPipe) jamId: string, @Request() req) {
    return this.jamPlaybackService.stopJam(jamId, req.user?.musicianId);
  }

  @Post(':id/control/next')
  @HttpCode(200)
  @ProtectedRoute('host', 'admin')
  @ApiOperation({ summary: 'Skip to next song' })
  @ApiResponse({ status: 200, description: 'Skipped to next song' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not jam host' })
  @ApiResponse({ status: 404, description: 'Jam not found' })
  async nextSong(@Param('id', ParseUUIDPipe) jamId: string, @Request() req) {
    return this.jamPlaybackService.nextSong(jamId, req.user?.musicianId);
  }

  @Post(':id/control/previous')
  @HttpCode(200)
  @ProtectedRoute('host', 'admin')
  @ApiOperation({ summary: 'Go back to previous song' })
  @ApiResponse({ status: 200, description: 'Returned to previous song' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not jam host' })
  @ApiResponse({ status: 404, description: 'Jam not found' })
  async previousSong(@Param('id', ParseUUIDPipe) jamId: string, @Request() req) {
    return this.jamPlaybackService.previousSong(jamId, req.user?.musicianId);
  }

  @Post(':id/control/pause')
  @HttpCode(200)
  @ProtectedRoute('host', 'admin')
  @ApiOperation({ summary: 'Pause current song' })
  @ApiResponse({ status: 200, description: 'Song paused' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not jam host' })
  @ApiResponse({ status: 404, description: 'Jam not found' })
  async pauseSong(@Param('id', ParseUUIDPipe) jamId: string, @Request() req) {
    return this.jamPlaybackService.pauseSong(jamId, req.user?.musicianId);
  }

  @Post(':id/control/resume')
  @HttpCode(200)
  @ProtectedRoute('host', 'admin')
  @ApiOperation({ summary: 'Resume paused song' })
  @ApiResponse({ status: 200, description: 'Song resumed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not jam host' })
  @ApiResponse({ status: 404, description: 'Jam not found' })
  async resumeSong(@Param('id', ParseUUIDPipe) jamId: string, @Request() req) {
    return this.jamPlaybackService.resumeSong(jamId, req.user?.musicianId);
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
    @Param('id', ParseUUIDPipe) jamId: string,
    @Body() dto: ReorderSchedulesDto,
    @Request() req,
  ) {
    return this.jamPlaybackService.reorderSchedules(jamId, dto.updates, req.user?.musicianId);
  }

  @Get(':id/playback-history')
  @ProtectedRoute()
  @ApiOperation({ summary: 'Get playback history for jam' })
  @ApiResponse({ status: 200, description: 'Playback history retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Jam not found' })
  async getPlaybackHistory(@Param('id', ParseUUIDPipe) jamId: string, @Query('limit') limitParam?: string) {
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
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateJamDto: UpdateJamDto, @Request() req) {
    return this.jamService.update(id, updateJamDto, req.user?.musicianId, req.user?.isHost);
  }

  @Delete(':id')
  @ProtectedRoute('host', 'admin')
  @ApiOperation({ summary: 'Delete jam' })
  @ApiResponse({ status: 200, description: 'Jam deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.jamService.remove(id, req.user?.musicianId);
  }
}
