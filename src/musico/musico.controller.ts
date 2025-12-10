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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MusicoService } from './musico.service';
import { CreateMusicianDto } from './dto/create-musico.dto';
import { UpdateMusicianDto } from './dto/update-musico.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Musicians')
@Controller('musicos')
export class MusicoController {
  constructor(private readonly musicoService: MusicoService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new musician (admin only)' })
  @ApiResponse({ status: 201, description: 'Musician created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin only' })
  create(@Body() createMusicianDto: CreateMusicianDto) {
    return this.musicoService.create(createMusicianDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all musicians' })
  @ApiResponse({ status: 200, description: 'List of musicians' })
  findAll() {
    return this.musicoService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get musician by ID' })
  @ApiResponse({ status: 200, description: 'Musician found' })
  @ApiResponse({ status: 404, description: 'Musician not found' })
  findOne(@Param('id') id: string) {
    return this.musicoService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update musician (self or admin)' })
  @ApiResponse({ status: 200, description: 'Musician updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - can only update own profile' })
  async update(
    @Param('id') id: string,
    @Body() updateMusicianDto: UpdateMusicianDto,
    @Request() req,
  ) {
    // Allow user to update their own profile or admin to update any
    if (req.user.musicianId !== id && req.user.role !== 'admin') {
      throw new ForbiddenException('You can only update your own profile');
    }
    return this.musicoService.update(id, updateMusicianDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete musician (admin only)' })
  @ApiResponse({ status: 200, description: 'Musician deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin only' })
  remove(@Param('id') id: string) {
    return this.musicoService.remove(id);
  }
}
