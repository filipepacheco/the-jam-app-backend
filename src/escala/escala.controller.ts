import { Controller, Post, Body, Patch, Param, Delete, ParseUUIDPipe } from '@nestjs/common';
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
  create(@Body() createScheduleDto: CreateScheduleDto) {
    return this.escalaService.create(createScheduleDto);
  }

  @Patch(':id')
  @ProtectedRoute('host', 'admin')
  @ApiOperation({ summary: 'Update schedule' })
  @ApiResponse({ status: 200, description: 'Schedule updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - host only' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateScheduleDto: UpdateScheduleDto) {
    return this.escalaService.update(id, updateScheduleDto);
  }

  @Delete(':id')
  @ProtectedRoute('host', 'admin')
  @ApiOperation({ summary: 'Remove from schedule' })
  @ApiResponse({ status: 200, description: 'Schedule removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - host only' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.escalaService.remove(id);
  }
}
