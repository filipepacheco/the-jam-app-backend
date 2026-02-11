import { PartialType } from '@nestjs/swagger';
import { CreateMusicDto } from './create-musica.dto';

export class UpdateMusicDto extends PartialType(CreateMusicDto) {}
