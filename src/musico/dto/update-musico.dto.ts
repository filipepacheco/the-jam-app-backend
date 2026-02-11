import { PartialType } from '@nestjs/swagger';
import { CreateMusicianDto } from './create-musico.dto';

export class UpdateMusicianDto extends PartialType(CreateMusicianDto) {}
