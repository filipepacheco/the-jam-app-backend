import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MusicoService } from './musico.service';
import { CreateMusicianDto } from './dto/create-musico.dto';
import { UpdateMusicianDto } from './dto/update-musico.dto';
import { ProtectedRoute } from '../common/decorators/protected-route.decorator';

@ApiTags('Musicians')
@Controller('musicos')
export class MusicoController {
  constructor(private readonly musicoService: MusicoService) {}

  @Post()
  @ProtectedRoute('host')
  @ApiOperation({ summary: 'Create a new musician (host only)' })
  @ApiResponse({ status: 201, description: 'Musician created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - host only' })
  create(@Body() createMusicianDto: CreateMusicianDto) {
    return this.musicoService.create(createMusicianDto);
  }

  @Get()
  @ProtectedRoute()
  @ApiOperation({ summary: 'List all musicians' })
  @ApiResponse({ status: 200, description: 'List of musicians' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Query('skip') skipParam?: string, @Query('take') takeParam?: string) {
    let skip = skipParam ? parseInt(skipParam, 10) : 0;
    let take = takeParam ? parseInt(takeParam, 10) : 50;
    if (isNaN(skip) || skip < 0) skip = 0;
    if (isNaN(take) || take < 1) take = 50;
    if (take > 100) take = 100;
    return this.musicoService.findAll(skip, take);
  }

  @Patch(':id')
  @ProtectedRoute()
  @ApiOperation({ summary: 'Update musician (self or host)' })
  @ApiResponse({ status: 200, description: 'Musician updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - can only update own profile unless host' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMusicianDto: UpdateMusicianDto,
    @Request() req,
  ) {
    return this.musicoService.update(id, updateMusicianDto, req.user?.musicianId);
  }

  @Delete(':id')
  @ProtectedRoute('host')
  @ApiOperation({ summary: 'Delete musician (host only)' })
  @ApiResponse({ status: 200, description: 'Musician deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - host only' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.musicoService.remove(id);
  }
}
