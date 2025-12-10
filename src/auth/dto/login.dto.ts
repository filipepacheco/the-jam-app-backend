import { IsEmail, IsOptional, IsString, Matches, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
    required: false,
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'User phone number (E.164 format recommended)',
    example: '+5511999999999',
    required: false,
  })
  @IsString({ message: 'Phone must be a string' })
  @Matches(/^\+?[1-9]\d{9,14}$/, {
    message: 'Invalid phone format. Use format: +5511999999999 (10-15 digits)',
  })
  @IsOptional()
  phone?: string;
}
