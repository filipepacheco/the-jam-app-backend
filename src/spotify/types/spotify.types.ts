export interface SpotifyApiError {
  status?: number;
  retryAfter?: string;
  message?: string;
}

export interface AuthenticatedRequest {
  headers?: Record<string, string | string[] | undefined>;
  user: {
    musicianId: string;
    id?: string;
  };
}
