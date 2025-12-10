import { ApiProperty } from '@nestjs/swagger';
import { MusicianResponseDto } from './musician-response.dto';

export class RegistrationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  musicianId: string;

  @ApiProperty()
  jamId: string;

  @ApiProperty()
  jamMusicId: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: MusicianResponseDto })
  musician: MusicianResponseDto;
}
