export interface AudioSettings {
  muted: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
}

export interface GameProfile {
  version: 1;
  bestScore: number;
  totalRuns: number;
  totalScore: number;
  totalSecondsSurvived: number;
  settings: AudioSettings;
}

const STORAGE_KEY = "neon-drift-profile";

const DEFAULT_PROFILE: GameProfile = {
  version: 1,
  bestScore: 0,
  totalRuns: 0,
  totalScore: 0,
  totalSecondsSurvived: 0,
  settings: {
    muted: false,
    masterVolume: 0.7,
    musicVolume: 0.4,
    sfxVolume: 0.8
  }
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const sanitize = (raw: Partial<GameProfile>): GameProfile => ({
  ...DEFAULT_PROFILE,
  ...raw,
  version: 1,
  bestScore: Number(raw.bestScore ?? DEFAULT_PROFILE.bestScore),
  totalRuns: Number(raw.totalRuns ?? DEFAULT_PROFILE.totalRuns),
  totalScore: Number(raw.totalScore ?? DEFAULT_PROFILE.totalScore),
  totalSecondsSurvived: Number(raw.totalSecondsSurvived ?? DEFAULT_PROFILE.totalSecondsSurvived),
  settings: {
    ...DEFAULT_PROFILE.settings,
    ...raw.settings,
    muted: Boolean(raw.settings?.muted ?? DEFAULT_PROFILE.settings.muted),
    masterVolume: clamp01(Number(raw.settings?.masterVolume ?? DEFAULT_PROFILE.settings.masterVolume)),
    musicVolume: clamp01(Number(raw.settings?.musicVolume ?? DEFAULT_PROFILE.settings.musicVolume)),
    sfxVolume: clamp01(Number(raw.settings?.sfxVolume ?? DEFAULT_PROFILE.settings.sfxVolume))
  }
});

export class ProfileStore {
  public static load(): GameProfile {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) {
      return { ...DEFAULT_PROFILE };
    }

    try {
      const parsed = JSON.parse(serialized) as Partial<GameProfile>;
      return sanitize(parsed);
    } catch {
      return { ...DEFAULT_PROFILE };
    }
  }

  public static save(profile: GameProfile): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitize(profile)));
  }

  public static update(mutator: (profile: GameProfile) => GameProfile): GameProfile {
    const nextProfile = sanitize(mutator(this.load()));
    this.save(nextProfile);
    return nextProfile;
  }

  public static reset(): GameProfile {
    this.save(DEFAULT_PROFILE);
    return { ...DEFAULT_PROFILE };
  }
}

