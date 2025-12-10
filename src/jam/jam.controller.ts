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
import { JamResponseDto } from './dto/jam-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Jams')
@Controller('jams')
export class JamController {
  constructor(private readonly jamService: JamService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RoleGuard)
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

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RoleGuard)
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
  @UseGuards(JwtAuthGuard, RoleGuard)
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
