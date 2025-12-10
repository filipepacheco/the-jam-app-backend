import { IsString, IsNotEmpty, IsOptional, IsISO8601, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JamStatus } from "@prisma/client";

export class CreateJamDto {
  @ApiProperty({ description: 'Jam session name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Jam session description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Jam session date and time', required: false })
  @IsISO8601()
  @IsOptional()
  date?: string;

  @ApiProperty({ description: 'Jam session location' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ description: 'Host musician ID (UUID)', required: false })
  @IsUUID()
  @IsOptional()
  hostMusicianId?: string;

  @ApiProperty({ description: 'Host name (denormalized cache)', required: false })
  @IsString()
  @IsOptional()
  hostName?: string;

  @ApiProperty({ description: 'Host contact (denormalized cache)', required: false })
  @IsString()
  @IsOptional()
  hostContact?: string;

  @ApiProperty({ description: 'Jam session QR Code', required: false })
  @IsString()
  @IsOptional()
  qrCode?: string;

  @ApiProperty({ description: 'Jam session status', required: false, enum: ['ACTIVE', 'INACTIVE', 'FINISHED'] })
  @IsString()
  @IsOptional()
  status?: JamStatus;
}
