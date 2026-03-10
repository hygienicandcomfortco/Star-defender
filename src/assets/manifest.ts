export interface ImageAsset {
  key: string;
  path: string;
}

export interface AudioAsset {
  key: string;
  paths: string[];
}

const ASSET_BASE = `${import.meta.env.BASE_URL}assets`;

export const IMAGE_ASSETS: ImageAsset[] = [
  { key: "logo-full", path: `${ASSET_BASE}/branding/logo-full.svg` },
  { key: "logo-mark", path: `${ASSET_BASE}/branding/logo-mark.svg` },
  { key: "player", path: `${ASSET_BASE}/sprites/player.svg` },
  { key: "enemy", path: `${ASSET_BASE}/sprites/enemy.svg` },
  { key: "enemy-dasher", path: `${ASSET_BASE}/sprites/enemy-dasher.svg` },
  { key: "enemy-tank", path: `${ASSET_BASE}/sprites/enemy-tank.svg` },
  { key: "arena-tile", path: `${ASSET_BASE}/sprites/arena-tile.svg` }
];

export const AUDIO_ASSETS: AudioAsset[] = [
  { key: "bgm-main", paths: [`${ASSET_BASE}/audio/bgm-main.wav`] },
  { key: "sfx-menu-confirm", paths: [`${ASSET_BASE}/audio/sfx-menu-confirm.wav`] },
  { key: "sfx-hit", paths: [`${ASSET_BASE}/audio/sfx-hit.wav`] },
  { key: "sfx-game-over", paths: [`${ASSET_BASE}/audio/sfx-game-over.wav`] },
  { key: "sfx-wave-up", paths: [`${ASSET_BASE}/audio/sfx-wave-up.wav`] }
];
