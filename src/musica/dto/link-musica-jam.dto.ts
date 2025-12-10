import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LinkMusicaJamDto {
  @ApiProperty({ description: 'ID da jam session' })
  @IsString()
  @IsNotEmpty()
  jamId: string;
}

