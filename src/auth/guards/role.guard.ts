import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.musicianId) {
      throw new ForbiddenException('User not authenticated');
    }

    // Get musician from database to check role
    const musician = await this.prisma.musician.findUnique({
      where: { id: user.musicianId },
    });

    if (!musician) {
      throw new ForbiddenException('Musician not found');
    }

    // Attach musician to request for downstream use
    request.musician = musician;

    // Map roles to musician flags: 'host' -> musician.isHost
    const roleMapping = {
      'host': musician.isHost,
      'admin': false, // Can add admin flag to musician if needed in future
    };

    // Check if user has one of the required roles
    const hasRole = requiredRoles.some((role) => {
      if (role === 'host') {
        return musician.isHost === true;
      }
      if (role === 'admin') {
        return roleMapping['admin'];
      }
      return false;
    });

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}

