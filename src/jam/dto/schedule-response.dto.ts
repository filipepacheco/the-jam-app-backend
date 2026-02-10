import { ApiProperty } from '@nestjs/swagger';
import { MusicaResponseDto } from './musica-response.dto';
import { RegistrationResponseDto } from './registration-response.dto';

export class ScheduleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  jamId: string;

  @ApiProperty()
  musicId: string;

  @ApiProperty()
  order: number;

  @ApiProperty({ enum: ['SUGGESTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'] })
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ required: false })
  startedAt?: Date | null;

  @ApiProperty({ required: false })
  pausedAt?: Date | null;

  @ApiProperty({ required: false })
  completedAt?: Date | null;

  @ApiProperty({ type: MusicaResponseDto, required: false })
  music?: MusicaResponseDto;

  @ApiProperty({ type: [RegistrationResponseDto], required: false })
  registrations?: RegistrationResponseDto[];
}
