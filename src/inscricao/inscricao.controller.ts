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
  @ApiOperation({
    summary:
      'Create or restore a registration for yourself, or for another musician as an authorized jam host',
  })
  @ApiResponse({
    status: 201,
    description: 'Registration created or withdrawn registration restored successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Only authorized jam hosts can register other musicians',
  })
  @ApiResponse({
    status: 409,
    description: 'Musician already applied for this instrument on this scheduled song',
  })
  create(@Body() createRegistrationDto: CreateRegistrationDto, @Request() req) {
    return this.inscricaoService.create(
      createRegistrationDto,
      req.user.musicianId,
      req.user.isHost === true,
    );
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
    return this.inscricaoService.update(id, updateRegistrationDto, true);
  }

  @Delete(':id')
  @ProtectedRoute()
  @ApiOperation({ summary: 'Cancel registration' })
  @ApiResponse({ status: 200, description: 'Registration cancelled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - can only delete own registrations' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.inscricaoService.remove(id, req.user.musicianId, req.user.isHost === true);
  }
}
