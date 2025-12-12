import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'User name', required: false })
  name?: string;

  @ApiProperty({ description: 'User email', required: false })
  email?: string;

  @ApiProperty({ description: 'User phone', required: false })
  phone?: string;

  @ApiProperty({ description: 'User role', enum: ['user', 'host', 'admin'] })
  role: 'user' | 'host' | 'admin';

  @ApiProperty({ description: 'Whether user is a host', default: false })
  isHost: boolean;

  @ApiProperty({ description: 'JWT token' })
  token: string;

  @ApiProperty({ description: 'Whether user is newly created' })
  isNewUser: boolean;
}



