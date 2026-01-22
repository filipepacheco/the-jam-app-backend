import { ApiProperty } from '@nestjs/swagger';

export class MusicaResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  artist: string;

  @ApiProperty({ required: false })
  genre?: string | null;

  @ApiProperty({ required: false })
  duration?: number | null;

  @ApiProperty({ required: false })
  description?: string | null;

  @ApiProperty({ required: false })
  link?: string | null;

  @ApiProperty()
  status: string;

  @ApiProperty({ example: 0, description: 'Number of drummers needed' })
  neededDrums: number;

  @ApiProperty({ example: 0, description: 'Number of guitarists needed' })
  neededGuitars: number;

  @ApiProperty({ example: 0, description: 'Number of vocalists needed' })
  neededVocals: number;

  @ApiProperty({ example: 0, description: 'Number of bassists needed' })
  neededBass: number;

  @ApiProperty({ example: 0, description: 'Number of keyboardists needed' })
  neededKeys: number;

  @ApiProperty()
  createdAt: Date;
}
