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
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JamService } from './jam.service';
import { CreateJamDto } from './dto/create-jam.dto';
import { UpdateJamDto } from './dto/update-jam.dto';
import { ControlJamActionDto } from './dto/control-jam-action.dto';
import { JamResponseDto } from './dto/jam-response.dto';
import { LiveStateResponseDto } from './dto/live-state-response.dto';
import { LiveDashboardResponseDto } from './dto/live-dashboard-response.dto';
import { LiveControlActionResponseDto } from './dto/live-control-action-response.dto';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Jams')
@Controller('jams')
export class JamController {
  constructor(private readonly jamService: JamService) {}

  @Post()
  @UseGuards(SupabaseJwtGuard, RoleGuard)
  @Roles('host', 'admin', 'user')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new jam session' })
  @ApiResponse({
    status: 201,
    description: 'Jam created successfully',
    type: JamResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  create(@Body() createJamDto: CreateJamDto, @Request() req) {
    return this.jamService.create(createJamDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all jams' })
  @ApiResponse({
    status: 200,
    description: 'List of jams',
    type: [JamResponseDto],
  })
  findAll() {
    return this.jamService.findAll();
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
    const jam = await this.jamService.findOne(id);

    if (!jam) {
      throw new NotFoundException(`Jam with ID ${id} not found`);
    }

    // Extract current song (IN_PROGRESS)
    const currentSong = jam.schedules?.find(
      (s) => s.status === 'IN_PROGRESS',
    ) || null;

    // Extract next 3 songs (SCHEDULED)
    const nextSongs = jam.schedules
      ?.filter((s) => s.status === 'SCHEDULED')
      .sort((a, b) => a.order - b.order)
      .slice(0, 3) || [];

    return {
      currentSong,
      nextSongs,
      jamStatus: jam.status,
      timestamp: Date.now(),
    };
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
    return this.jamService.getLiveDashboard(id);
  }

  @Post(':id/live/control')
  @UseGuards(SupabaseJwtGuard, RoleGuard)
  @Roles('host', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Execute live jam control action (play/pause/skip/reorder)' })
  @ApiResponse({
    status: 200,
    description: 'Action executed successfully',
    type: LiveControlActionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not jam host' })
  @ApiResponse({ status: 404, description: 'Jam not found' })
  async executeControlAction(
    @Param('id') jamId: string,
    @Body() dto: ControlJamActionDto,
    @Request() req,
  ): Promise<LiveControlActionResponseDto> {
    // Verify user is the jam host
    const jam = await this.jamService.findOne(jamId);

    if (!jam) {
      throw new NotFoundException(`Jam with ID ${jamId} not found`);
    }

    if (jam.hostMusicianId && jam.hostMusicianId !== req.user.musicianId) {
      throw new ForbiddenException('You are not the host of this jam');
    }

    const updatedJam = await this.jamService.executeLiveAction(
      jamId,
      dto.action,
      dto.payload,
    );

    return {
      success: true,
      jam: updatedJam,
    };
  }

  @Patch(':id')
  @UseGuards(SupabaseJwtGuard, RoleGuard)
  @Roles('host', 'admin', 'user')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update jam' })
  @ApiResponse({ status: 200, description: 'Jam updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  update(@Param('id') id: string, @Body() updateJamDto: UpdateJamDto) {
    return this.jamService.update(id, updateJamDto);
  }

  @Delete(':id')
  @UseGuards(SupabaseJwtGuard, RoleGuard)
  @Roles('host', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete jam' })
  @ApiResponse({ status: 200, description: 'Jam deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  remove(@Param('id') id: string) {
    return this.jamService.remove(id);
  }
}
