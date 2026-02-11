import { PartialType } from '@nestjs/swagger';
import { CreateScheduleDto } from './create-escala.dto';

export class UpdateScheduleDto extends PartialType(CreateScheduleDto) {}
