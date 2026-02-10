import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseJwtGuard } from '../../auth/guards/supabase-jwt.guard';
import { RoleGuard } from '../../auth/guards/role.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

export function ProtectedRoute(...roles: string[]) {
  return applyDecorators(UseGuards(SupabaseJwtGuard, RoleGuard), Roles(...roles), ApiBearerAuth());
}
