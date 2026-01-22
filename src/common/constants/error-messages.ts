export const ErrorMessages = {
  // Generic errors
  INTERNAL_SERVER_ERROR: 'Internal server error',
  VALIDATION_ERROR: 'Validation error',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',

  // Jam errors
  JAM_NOT_FOUND: 'Jam not found',
  JAM_NOT_ACTIVE: 'Jam is not active',
  JAM_ALREADY_PLAYING: 'Jam is already playing',
  JAM_ALREADY_STOPPED: 'Jam is already stopped',
  JAM_NOT_PLAYING: 'Jam is not currently playing',
  JAM_NOT_PAUSED: 'Jam is not paused',

  // Schedule errors
  SCHEDULE_NOT_FOUND: 'Schedule not found',
  NO_CURRENT_SONG: 'No current song playing',
  NO_SCHEDULED_SONGS: 'No songs scheduled to play',
  NO_AVAILABLE_SONGS: 'No songs available to play',
  SCHEDULE_IDS_REQUIRED: 'scheduleIds array is required',
  SCHEDULE_NOT_BELONGS_TO_JAM: (id: string) => `Schedule ID ${id} does not belong to this jam`,

  // Music errors
  MUSIC_NOT_FOUND: 'Music not found',

  // Musician errors
  MUSICIAN_NOT_FOUND: 'Musician not found',
  HOST_MUSICIAN_NOT_FOUND: 'Host musician not found',

  // Registration errors
  REGISTRATION_NOT_FOUND: 'Registration not found',

  // Action errors
  INVALID_ACTION: 'Invalid action',
} as const;

export type ErrorMessageKey = keyof typeof ErrorMessages;
