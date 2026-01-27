import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SpotifyService } from './spotify.service';
import { ImportPlaylistDto } from './dto/import-playlist.dto';
import { ImportResultDto } from './dto/import-result.dto';
import { ExportPlaylistDto } from './dto/export-playlist.dto';
import { ExportResultDto } from './dto/export-result.dto';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';

@ApiTags('Spotify')
@Controller('spotify')
export class SpotifyController {
  constructor(private readonly spotifyService: SpotifyService) {}

  @Post('import')
  @UseGuards(SupabaseJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Import a Spotify playlist as a new jam' })
  @ApiResponse({ status: 201, description: 'Jam created from playlist', type: ImportResultDto })
  @ApiResponse({ status: 400, description: 'Invalid playlist URL' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Playlist not found on Spotify' })
  @ApiResponse({ status: 503, description: 'Spotify integration not configured' })
  async importPlaylist(@Body() dto: ImportPlaylistDto, @Req() req: any): Promise<ImportResultDto> {
    return this.spotifyService.importPlaylist(dto, req.user.musicianId);
  }

  @Post('export')
  @UseGuards(SupabaseJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export a jam as a Spotify playlist' })
  @ApiResponse({ status: 201, description: 'Spotify playlist created', type: ExportResultDto })
  @ApiResponse({ status: 400, description: 'No valid Spotify links in jam' })
  @ApiResponse({ status: 401, description: 'Unauthorized or invalid Spotify token' })
  @ApiResponse({ status: 404, description: 'Jam not found' })
  async exportPlaylist(@Body() dto: ExportPlaylistDto): Promise<ExportResultDto> {
    return this.spotifyService.exportPlaylist(dto);
  }
}
