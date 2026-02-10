import { ApiProperty } from '@nestjs/swagger';
import { MusicaResponseDto } from './musica-response.dto';
import { RegistrationResponseDto } from './registration-response.dto';

export class JamMusicaResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  jamId: string;

  @ApiProperty()
  musicId: string;

  @ApiProperty({ type: MusicaResponseDto })
  music: MusicaResponseDto;

  @ApiProperty({ type: [RegistrationResponseDto], required: false })
  registrations?: RegistrationResponseDto[];
}
