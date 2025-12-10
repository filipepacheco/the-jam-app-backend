import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { EscalaService } from './escala.service';
import { CreateScheduleDto } from './dto/create-escala.dto';
import { UpdateScheduleDto } from './dto/update-escala.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Schedules')
@Controller('escalas')
export class EscalaController {
  constructor(private readonly escalaService: EscalaService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('host', 'admin', 'user')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new schedule' })
  @ApiResponse({ status: 201, description: 'Schedule created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  create(@Body() createScheduleDto: CreateScheduleDto) {
    return this.escalaService.create(createScheduleDto);
  }

  @Get('jam/:jamId')
  @ApiOperation({ summary: 'Get schedules by jam' })
  @ApiResponse({ status: 200, description: 'List of schedules for jam' })
  findByJam(@Param('jamId') jamId: string) {
    return this.escalaService.findByJam(jamId);
  }

  // @Get('musico/:musicoId')
  // @ApiOperation({ summary: 'Get schedules by musician' })
  // findByMusico(@Param('musicoId') musicoId: string) {
  //   return this.escalaService.findByMusico(musicoId);
  // }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('host', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update schedule' })
  @ApiResponse({ status: 200, description: 'Schedule updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - host only' })
  update(@Param('id') id: string, @Body() updateScheduleDto: UpdateScheduleDto) {
    return this.escalaService.update(id, updateScheduleDto);
  }

  @Put('jam/:jamId/reorder')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('host', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder schedules - array position becomes the order' })
  @ApiResponse({ status: 200, description: 'Schedules reordered successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - host only' })
  reorderSchedule(
    @Param('jamId') jamId: string,
    @Body() scheduleIds: string[],
  ) {
    return this.escalaService.reorderSchedule(jamId, scheduleIds);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('host', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove from schedule' })
  @ApiResponse({ status: 200, description: 'Schedule removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - host only' })
  remove(@Param('id') id: string) {
    return this.escalaService.remove(id);
  }
}
