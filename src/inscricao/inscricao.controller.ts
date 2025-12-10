import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InscricaoService } from './inscricao.service';
import { CreateRegistrationDto } from './dto/create-inscricao.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Registrations')
@Controller('inscricoes')
export class InscricaoController {
  constructor(private readonly inscricaoService: InscricaoService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new registration' })
  @ApiResponse({ status: 201, description: 'Registration created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() createRegistrationDto: CreateRegistrationDto) {
    return this.inscricaoService.create(createRegistrationDto);
  }

  @Get('jam/:jamId')
  @ApiOperation({ summary: 'Get registrations by jam' })
  @ApiResponse({ status: 200, description: 'List of registrations for jam' })
  findByJam(@Param('jamId') jamId: string) {
    return this.inscricaoService.findByJam(jamId);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('host', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve a registration' })
  @ApiResponse({ status: 200, description: 'Registration approved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - host only' })
  approve(@Param('id') id: string) {
    return this.inscricaoService.approve(id);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('host', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a registration' })
  @ApiResponse({ status: 200, description: 'Registration rejected' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - host only' })
  reject(@Param('id') id: string) {
    return this.inscricaoService.reject(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel registration' })
  @ApiResponse({ status: 200, description: 'Registration cancelled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  remove(@Param('id') id: string) {
    return this.inscricaoService.remove(id);
  }
}
