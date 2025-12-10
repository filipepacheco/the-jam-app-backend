import { PartialType } from '@nestjs/mapped-types';
import { CreateMusicDto } from './create-musica.dto';

export class UpdateMusicDto extends PartialType(CreateMusicDto) {}

