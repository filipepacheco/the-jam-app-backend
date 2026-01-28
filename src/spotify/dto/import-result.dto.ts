import { ApiProperty } from '@nestjs/swagger';

export class ImportResultDto {
  @ApiProperty({ description: 'Target jam (existing or newly created)' })
  jam: any;

  @ApiProperty({ description: 'Number of new Music records created' })
  importedTracks: number;

  @ApiProperty({ description: 'Number of existing Music records reused' })
  reusedTracks: number;

  @ApiProperty({ description: 'Number of tracks that failed to import' })
  skippedTracks: number;

  @ApiProperty({ description: 'Number of tracks added to the jam' })
  addedTracks: number;

  @ApiProperty({ description: 'Number of tracks skipped (already in jam)' })
  duplicateTracks: number;

  @ApiProperty({ description: 'Whether an existing jam was used' })
  isExistingJam: boolean;

  @ApiProperty({ description: 'Error details for skipped tracks', required: false })
  errors?: string[];
}
