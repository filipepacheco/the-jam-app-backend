import { ApiProperty } from '@nestjs/swagger';
import {MusicaResponseDto} from "./musica-response.dto";
import {MusicianResponseDto} from "./musician-response.dto";

export class ScheduleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  jamId: string;

  @ApiProperty()
  musicId: string;

  @ApiProperty()
  order: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: MusicaResponseDto })
  music?: MusicaResponseDto;

}

