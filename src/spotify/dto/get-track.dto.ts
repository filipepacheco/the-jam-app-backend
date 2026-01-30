import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetTrackDto {
  @ApiProperty({
    description: 'Spotify track URL or URI',
    example: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh',
  })
  @IsString()
  @IsNotEmpty()
  trackUrl: string;
}
