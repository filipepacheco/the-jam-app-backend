import { ApiProperty } from '@nestjs/swagger';

export class MusicaResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  titulo: string;

  @ApiProperty()
  artista: string;

  @ApiProperty({ required: false })
  genero?: string | null;

  @ApiProperty({ required: false })
  duracao?: number | null;

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
