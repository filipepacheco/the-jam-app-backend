import { ApiProperty } from '@nestjs/swagger';
import { JamResponseDto } from './jam-response.dto';

export class LiveControlActionResponseDto {
  @ApiProperty({
    description: 'Whether the action was successful',
  })
  success: boolean;

  @ApiProperty({
    type: JamResponseDto,
    description: 'Updated jam with all schedules and registrations',
  })
  jam: JamResponseDto;
}
