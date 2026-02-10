export interface SpotifyApiError {
  status?: number;
  retryAfter?: string;
  message?: string;
}

export interface AuthenticatedRequest {
  user: {
    musicianId: string;
    id?: string;
  };
}
