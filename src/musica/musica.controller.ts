import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MusicaService } from './musica.service';
import { CreateMusicDto } from './dto/create-musica.dto';
import { UpdateMusicDto } from './dto/update-musica.dto';
import { ProtectedRoute } from '../common/decorators/protected-route.decorator';

@ApiTags('Musicas')
@Controller('musicas')
export class MusicaController {
  constructor(private readonly musicaService: MusicaService) {}

  @Post()
  @ProtectedRoute('host', 'admin', 'user')
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
  findAll(@Query('skip') skipParam?: string, @Query('take') takeParam?: string) {
    let skip = skipParam ? parseInt(skipParam, 10) : 0;
    let take = takeParam ? parseInt(takeParam, 10) : 50;
    if (isNaN(skip) || skip < 0) skip = 0;
    if (isNaN(take) || take < 1) take = 50;
    if (take > 100) take = 100;
    return this.musicaService.findAll(skip, take);
  }

  @Patch(':id')
  @ProtectedRoute('host', 'admin', 'user')
  @ApiOperation({ summary: 'Update music' })
  @ApiResponse({ status: 200, description: 'Music updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateMusicDto: UpdateMusicDto) {
    return this.musicaService.update(id, updateMusicDto);
  }

  @Patch(':id/link-jam/:jamId')
  @ProtectedRoute('host', 'admin', 'user')
  @ApiOperation({ summary: 'Link music to a jam' })
  @ApiResponse({ status: 200, description: 'Music linked to jam successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  linkToJam(@Param('id', ParseUUIDPipe) musicaId: string, @Param('jamId', ParseUUIDPipe) jamId: string) {
    return this.musicaService.linkToJam(musicaId, jamId);
  }

  @Delete(':id')
  @ProtectedRoute('host', 'admin')
  @ApiOperation({ summary: 'Delete music' })
  @ApiResponse({ status: 200, description: 'Music deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.musicaService.remove(id);
  }
}
