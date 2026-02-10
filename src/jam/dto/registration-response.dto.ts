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

  @ApiProperty({ required: false })
  scheduleId?: string;

  @ApiProperty({ required: false })
  instrument?: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: MusicianResponseDto, required: false })
  musician?: MusicianResponseDto;
}
