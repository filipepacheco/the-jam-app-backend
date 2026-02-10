import { Controller, Post, Body, Param, Delete, Patch, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InscricaoService } from './inscricao.service';
import { CreateRegistrationDto } from './dto/create-inscricao.dto';
import { UpdateRegistrationDto } from './dto/update-inscricao.dto';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import { ProtectedRoute } from '../common/decorators/protected-route.decorator';

@ApiTags('Registrations')
@Controller('inscricoes')
export class InscricaoController {
  constructor(private readonly inscricaoService: InscricaoService) {}

  @Post()
  @UseGuards(SupabaseJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new registration' })
  @ApiResponse({ status: 201, description: 'Registration created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() createRegistrationDto: CreateRegistrationDto, @Request() req) {
    // If musicianId is provided in DTO and user is host, use that. Otherwise use authenticated user
    const musicianId =
      createRegistrationDto.musicianId && req.user.isHost
        ? createRegistrationDto.musicianId
        : req.user.musicianId;
    return this.inscricaoService.create(createRegistrationDto, musicianId);
  }

  @Patch(':id')
  @ProtectedRoute('host', 'admin')
  @ApiOperation({ summary: 'Update registration details (instrument, status)' })
  @ApiResponse({ status: 200, description: 'Registration updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - host only' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  update(@Param('id') id: string, @Body() updateRegistrationDto: UpdateRegistrationDto) {
    return this.inscricaoService.update(id, updateRegistrationDto);
  }

  @Delete(':id')
  @UseGuards(SupabaseJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel registration' })
  @ApiResponse({ status: 200, description: 'Registration cancelled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - can only delete own registrations' })
  remove(@Param('id') id: string, @Request() req) {
    return this.inscricaoService.remove(id, req.user.musicianId);
  }
}
