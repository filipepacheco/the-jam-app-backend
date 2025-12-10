import { ApiProperty } from '@nestjs/swagger';
import { MusicaResponseDto } from './musica-response.dto';

export class JamMusicaResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  jamId: string;

  @ApiProperty()
  musicaId: string;

  @ApiProperty({ type: MusicaResponseDto })
  musica: MusicaResponseDto;
}
