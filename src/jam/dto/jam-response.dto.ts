import { ApiProperty } from '@nestjs/swagger';
import { JamMusicaResponseDto } from './jam-musica-response.dto';
import {Registration} from "@prisma/client";
import {RegistrationResponseDto} from "./registration-response.dto";
import {ScheduleResponseDto} from "./schedule-response.dto";

export class JamResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  hostName: string;

  @ApiProperty({ required: false })
  description?: string | null;

  @ApiProperty({ required: false })
  date?: Date | null;

  @ApiProperty({ required: false })
  qrCode?: string | null;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

    @ApiProperty({ type: [JamMusicaResponseDto], required: false })
    jamsmusics?: JamMusicaResponseDto[];

    @ApiProperty({ type: [RegistrationResponseDto], required: false })
    registrations?: RegistrationResponseDto[];

    @ApiProperty({ type: [ScheduleResponseDto], required: false })
    schedules?: ScheduleResponseDto[];

}

