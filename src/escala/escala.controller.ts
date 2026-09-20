import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EscalaService } from './escala.service';
import { CreateScheduleDto } from './dto/create-escala.dto';
import { UpdateScheduleDto } from './dto/update-escala.dto';
import { ProtectedRoute } from '../common/decorators/protected-route.decorator';

@ApiTags('Schedules')
@Controller('escalas')
export class EscalaController {
  constructor(private readonly escalaService: EscalaService) {}

  @Post()
  @ProtectedRoute('host', 'admin', 'user')
  @ApiOperation({ summary: 'Create new schedule' })
  @ApiResponse({ status: 201, description: 'Schedule created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  create(@Body() createScheduleDto: CreateScheduleDto, @Request() req) {
    return this.escalaService.create(createScheduleDto, req.musician?.isHost === true);
  }

  @Patch(':id')
  @ProtectedRoute('host', 'admin')
  @ApiOperation({
    summary: 'Edit an unplayed schedule',
    description:
      'Unplayed slots may be suggested, scheduled or canceled. Playback controls own active/completed transitions. Jam moves and direct order edits are rejected; use queue reorder. Music cannot be replaced after registration or playback history exists.',
  })
  @ApiResponse({ status: 200, description: 'Schedule updated successfully' })
  @ApiResponse({ status: 400, description: 'Edit violates schedule lifecycle or identity' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - host only' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateScheduleDto: UpdateScheduleDto) {
    return this.escalaService.update(id, updateScheduleDto);
  }

  @Delete(':id')
  @ProtectedRoute('host', 'admin')
  @ApiOperation({
    summary: 'Remove an unplayed schedule',
    description:
      'Current/completed songs cannot be removed. Slots with registrations or history are canceled and retained; empty unplayed slots are deleted.',
  })
  @ApiResponse({ status: 200, description: 'Schedule removed successfully' })
  @ApiResponse({ status: 400, description: 'Current or completed song cannot be removed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - host only' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.escalaService.remove(id);
  }
}
