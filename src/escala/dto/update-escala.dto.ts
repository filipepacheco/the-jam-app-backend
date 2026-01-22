import { PartialType } from '@nestjs/mapped-types';
import { CreateScheduleDto } from './create-escala.dto';

export class UpdateScheduleDto extends PartialType(CreateScheduleDto) {}
