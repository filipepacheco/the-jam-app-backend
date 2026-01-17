import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MusicaService } from './musica.service';
import { CreateMusicDto } from './dto/create-musica.dto';
import { UpdateMusicDto } from './dto/update-musica.dto';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Musicas')
@Controller('musicas')
export class MusicaController {
  constructor(private readonly musicaService: MusicaService) {}

  @Post()
  @UseGuards(SupabaseJwtGuard, RoleGuard)
  @Roles('host', 'admin', 'user')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new music' })
  @ApiResponse({ status: 201, description: 'Music created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  create(@Body() createMusicDto: CreateMusicDto) {
    return this.musicaService.create(createMusicDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all musics independent of jam' })
  @ApiResponse({ status: 200, description: 'List of musics' })
  findAll() {
    return this.musicaService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get music by ID' })
  @ApiResponse({ status: 200, description: 'Music found' })
  @ApiResponse({ status: 404, description: 'Music not found' })
  findOne(@Param('id') id: string) {
    return this.musicaService.findOne(id);
  }

  @Get('jam/:jamId')
  @ApiOperation({ summary: 'Get musics by jam' })
  @ApiResponse({ status: 200, description: 'List of musics for jam' })
  findByJam(@Param('jamId') jamId: string) {
    return this.musicaService.findByJam(jamId);
  }

  @Patch(':id')
  @UseGuards(SupabaseJwtGuard, RoleGuard)
  @Roles('host', 'admin', 'user')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update music' })
  @ApiResponse({ status: 200, description: 'Music updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  update(@Param('id') id: string, @Body() updateMusicDto: UpdateMusicDto) {
    return this.musicaService.update(id, updateMusicDto);
  }

  @Patch(':id/link-jam/:jamId')
  @UseGuards(SupabaseJwtGuard, RoleGuard)
  @Roles('host', 'admin', 'user')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Link music to a jam' })
  @ApiResponse({ status: 200, description: 'Music linked to jam successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  linkToJam(@Param('id') musicaId: string, @Param('jamId') jamId: string) {
    return this.musicaService.linkToJam(musicaId, jamId);
  }

  @Delete(':id')
  @UseGuards(SupabaseJwtGuard, RoleGuard)
  @Roles('host', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete music' })
  @ApiResponse({ status: 200, description: 'Music deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  remove(@Param('id') id: string) {
    return this.musicaService.remove(id);
  }
}
