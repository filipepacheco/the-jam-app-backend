import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SpotifyToken {
  accessToken: string;
  expiresAt: number;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string[];
  durationMs: number;
  spotifyUrl: string;
}

export interface SpotifyApiResponse {
  id?: string;
  name?: string;
  description?: string | null;
  tracks?: {
    items: Array<{
      track: {
        id: string;
        name: string;
        artists: Array<{ name: string }>;
        duration_ms: number;
        external_urls: { spotify: string };
        album?: { name: string; images?: Array<{ url: string }> };
      };
    }>;
  };
  items?: Array<{
    track: {
      id: string;
      name: string;
      artists: Array<{ name: string }>;
      duration_ms: number;
      external_urls: { spotify: string };
      album?: { name: string; images?: Array<{ url: string }> };
    };
  }>;
  next?: string | null;
  artists?: Array<{ name: string }>;
  duration_ms?: number;
  album?: { name: string; images?: Array<{ url: string }> };
  error?: { status: number; message: string };
}

@Injectable()
export class SpotifyApiClient {
  private readonly logger = new Logger(SpotifyApiClient.name);
  private cachedToken: SpotifyToken | null = null;

  constructor(private readonly configService: ConfigService) {}

  get isConfigured(): boolean {
    return !!(
      this.configService.get<string>('SPOTIFY_CLIENT_ID') &&
      this.configService.get<string>('SPOTIFY_CLIENT_SECRET')
    );
  }

  async getClientToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.accessToken;
    }

    const clientId = this.configService.get<string>('SPOTIFY_CLIENT_ID');
    const clientSecret = this.configService.get<string>('SPOTIFY_CLIENT_SECRET');
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Failed to get Spotify client token: ${response.status} ${body}`);
      throw new Error('Failed to authenticate with Spotify');
    }

    const data = await response.json();
    this.cachedToken = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };

    return this.cachedToken.accessToken;
  }

  async getPlaylist(
    playlistId: string,
    token: string,
  ): Promise<{ name: string; description: string | null }> {
    const response = await this.spotifyFetch(
      `https://api.spotify.com/v1/playlists/${playlistId}?fields=name,description`,
      token,
    );
    return { name: response.name, description: response.description || null };
  }

  async getPlaylistTracks(playlistId: string, token: string): Promise<SpotifyTrack[]> {
    const tracks: SpotifyTrack[] = [];
    let url: string | null =
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks?fields=items(track(id,name,artists(name),duration_ms,external_urls)),next&limit=100`;

    while (url) {
      const data = await this.spotifyFetch(url, token);

      for (const item of data.items) {
        if (!item.track || !item.track.id) continue;
        tracks.push({
          id: item.track.id,
          name: item.track.name,
          artists: item.track.artists.map((a: { name: string }) => a.name),
          durationMs: item.track.duration_ms,
          spotifyUrl: `https://open.spotify.com/track/${item.track.id}`,
        });
      }

      url = data.next || null;
    }

    return tracks;
  }

  async getCurrentUserId(token: string): Promise<string> {
    const data = await this.spotifyFetch('https://api.spotify.com/v1/me', token);
    return data.id;
  }

  async createPlaylist(
    userId: string,
    name: string,
    description: string | undefined,
    isPublic: boolean,
    token: string,
  ): Promise<{ id: string; externalUrl: string }> {
    const response = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description: description || '',
        public: isPublic,
      }),
    });

    await this.handleSpotifyError(response);
    const data = await response.json();
    return { id: data.id, externalUrl: data.external_urls.spotify };
  }

  async addTracksToPlaylist(playlistId: string, trackUris: string[], token: string): Promise<void> {
    for (let i = 0; i < trackUris.length; i += 100) {
      const batch = trackUris.slice(i, i + 100);
      const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: batch }),
      });

      await this.handleSpotifyError(response);
    }
  }

  parsePlaylistId(urlOrUri: string): string | null {
    // Handle spotify:playlist:ID format
    const uriMatch = urlOrUri.match(/^spotify:playlist:([a-zA-Z0-9]+)$/);
    if (uriMatch) return uriMatch[1];

    // Handle https://open.spotify.com/playlist/ID?si=...
    const urlMatch = urlOrUri.match(/^https?:\/\/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
    if (urlMatch) return urlMatch[1];

    return null;
  }

  parseTrackId(urlOrUri: string): string | null {
    // Handle https://open.spotify.com/track/ID?si=...
    const urlMatch = urlOrUri.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/);
    if (urlMatch) return urlMatch[1];

    // Handle spotify:track:ID format
    const uriMatch = urlOrUri.match(/spotify:track:([a-zA-Z0-9]+)/);
    if (uriMatch) return uriMatch[1];

    return null;
  }

  async getTrack(
    trackId: string,
    token: string,
  ): Promise<SpotifyTrack & { albumName?: string; albumImageUrl?: string }> {
    const response = await this.spotifyFetch(`https://api.spotify.com/v1/tracks/${trackId}`, token);

    return {
      id: response.id,
      name: response.name,
      artists: response.artists.map((a: { name: string }) => a.name),
      durationMs: response.duration_ms,
      spotifyUrl: `https://open.spotify.com/track/${response.id}`,
      albumName: response.album?.name,
      albumImageUrl: response.album?.images?.[0]?.url,
    };
  }

  extractTrackUri(link: string): string | null {
    if (!link) return null;

    // Handle spotify:track:ID
    const uriMatch = link.match(/^spotify:track:([a-zA-Z0-9]+)$/);
    if (uriMatch) return link;

    // Handle https://open.spotify.com/track/ID
    const urlMatch = link.match(/^https?:\/\/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/);
    if (urlMatch) return `spotify:track:${urlMatch[1]}`;

    return null;
  }

  private async spotifyFetch(url: string, token: string): Promise<SpotifyApiResponse> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    await this.handleSpotifyError(response);
    return response.json();
  }

  private async handleSpotifyError(response: Response): Promise<void> {
    if (response.ok) return;

    const body = await response.text();
    this.logger.warn(`Spotify API error: ${response.status} ${body}`);

    const error = new Error(`Spotify API error: ${response.status}`) as Error & {
      status: number;
      retryAfter: string | null;
    };
    error.status = response.status;
    error.retryAfter = response.headers.get('retry-after');
    throw error;
  }
}
