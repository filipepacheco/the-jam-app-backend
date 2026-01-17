import { ApiProperty } from '@nestjs/swagger';
import { MusicianLevel } from '@prisma/client';

export class MusicianProfileResponseDto {
  @ApiProperty({ description: 'Musician ID (UUID)' })
  id: string;

  @ApiProperty({ description: 'Supabase user ID' })
  supabaseUserId?: string;

  @ApiProperty({ description: 'Musician name' })
  name?: string;

  @ApiProperty({ description: 'Musician email' })
  email?: string;

  @ApiProperty({ description: 'Musician phone' })
  phone?: string;

  @ApiProperty({ description: 'Primary contact info' })
  contact?: string;

  @ApiProperty({ description: 'Instrument (drums, guitar, vocals, bass, keys, etc.)' })
  instrument?: string;

  @ApiProperty({
    description: 'Skill level',
    enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL'],
  })
  level?: MusicianLevel;

  @ApiProperty({ description: 'Whether user is a jam host' })
  isHost: boolean;

  @ApiProperty({
    description: 'Whether profile registration is complete (has instrument, level, and contact)',
  })
  registrationComplete: boolean;

  @ApiProperty({description:'Whether is new user'})
  isNewUser: boolean;

  @ApiProperty({ description: 'Account creation timestamp' })
  createdAt: Date;


}
