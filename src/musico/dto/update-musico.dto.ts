import { PartialType } from '@nestjs/mapped-types';
import { CreateMusicianDto } from './create-musico.dto';

export class UpdateMusicianDto extends PartialType(CreateMusicianDto) {}
