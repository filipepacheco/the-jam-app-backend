import { ApiProperty } from '@nestjs/swagger';

export class MusicianResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nome: string;

  @ApiProperty()
  instrumento: string;

  @ApiProperty()
  nivel: string;

    @ApiProperty({ required: false })
    contato?: string | null;

    @ApiProperty({ required: false })
    telefone?: string | null;

  @ApiProperty()
  createdAt: Date;
}

