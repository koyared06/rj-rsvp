export const MUSIC_PLAYER_REQUEST_EVENT = "rj-music-player-request";
export const MUSIC_PLAYER_STATUS_EVENT = "rj-music-player-status";

export type MusicPlayerRequestDetail = {
  action: "playFeatured";
};

export type MusicPlayerStatusDetail = {
  loading: boolean;
  hasTracks: boolean;
  error: string;
};
