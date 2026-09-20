import {
  Controller,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InscricaoService } from './inscricao.service';
import { CreateRegistrationDto } from './dto/create-inscricao.dto';
import { UpdateRegistrationDto } from './dto/update-inscricao.dto';
import { ProtectedRoute } from '../common/decorators/protected-route.decorator';
import { JamManagementService } from '../jam/jam-management.service';

@ApiTags('Registrations')
@Controller('inscricoes')
export class InscricaoController {
  constructor(
    private readonly inscricaoService: InscricaoService,
    private readonly jamManagementService: JamManagementService,
  ) {}

  @Post()
  @ProtectedRoute()
  @ApiOperation({ summary: 'Apply to play an instrument on a scheduled song' })
  @ApiResponse({ status: 201, description: 'Registration created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 409,
    description: 'Musician already applied for this instrument on this scheduled song',
  })
  create(@Body() createRegistrationDto: CreateRegistrationDto, @Request() req) {
    // If musicianId is provided in DTO and user is host, use that. Otherwise, use authenticated user
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
  @ApiResponse({
    status: 409,
    description: 'Updated instrument would duplicate another application on the scheduled song',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRegistrationDto: UpdateRegistrationDto,
    @Request() req,
  ) {
    return this.updateRegistration(id, updateRegistrationDto, req.user?.musicianId);
  }

  private async updateRegistration(
    id: string,
    updateRegistrationDto: UpdateRegistrationDto,
    musicianId?: string,
  ) {
    await this.jamManagementService.assertCanManageRegistration(id, musicianId);
    return this.inscricaoService.update(id, updateRegistrationDto);
  }

  @Delete(':id')
  @ProtectedRoute()
  @ApiOperation({ summary: 'Cancel registration' })
  @ApiResponse({ status: 200, description: 'Registration cancelled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - can only delete own registrations' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.inscricaoService.remove(id, req.user.musicianId);
  }
}
