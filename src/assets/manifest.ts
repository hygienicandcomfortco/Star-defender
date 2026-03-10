export interface ImageAsset {
  key: string;
  path: string;
}

export interface AudioAsset {
  key: string;
  paths: string[];
}

export const IMAGE_ASSETS: ImageAsset[] = [
  { key: "logo-full", path: "/assets/branding/logo-full.svg" },
  { key: "logo-mark", path: "/assets/branding/logo-mark.svg" },
  { key: "player", path: "/assets/sprites/player.svg" },
  { key: "enemy", path: "/assets/sprites/enemy.svg" },
  { key: "enemy-dasher", path: "/assets/sprites/enemy-dasher.svg" },
  { key: "enemy-tank", path: "/assets/sprites/enemy-tank.svg" },
  { key: "arena-tile", path: "/assets/sprites/arena-tile.svg" }
];

export const AUDIO_ASSETS: AudioAsset[] = [
  { key: "bgm-main", paths: ["/assets/audio/bgm-main.wav"] },
  { key: "sfx-menu-confirm", paths: ["/assets/audio/sfx-menu-confirm.wav"] },
  { key: "sfx-hit", paths: ["/assets/audio/sfx-hit.wav"] },
  { key: "sfx-game-over", paths: ["/assets/audio/sfx-game-over.wav"] },
  { key: "sfx-wave-up", paths: ["/assets/audio/sfx-wave-up.wav"] }
];
