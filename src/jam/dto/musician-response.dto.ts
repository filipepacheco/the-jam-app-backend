import { ApiProperty } from '@nestjs/swagger';

export class MusicianResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ required: false })
  name?: string | null;

  @ApiProperty({ required: false })
  instrument?: string | null;

  @ApiProperty({ required: false })
  level?: string | null;

  @ApiProperty({ required: false })
  contact?: string | null;

  @ApiProperty({ required: false })
  phone?: string | null;

  @ApiProperty({ required: false })
  email?: string | null;

  @ApiProperty({ required: false })
  supabaseUserId?: string | null;

  @ApiProperty()
  isHost: boolean;

  @ApiProperty()
  createdAt: Date;
}
