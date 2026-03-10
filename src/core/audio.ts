import Phaser from "phaser";
import type { AudioSettings } from "./profile";

const DEFAULT_SETTINGS: AudioSettings = {
  muted: false,
  masterVolume: 0.7,
  musicVolume: 0.4,
  sfxVolume: 0.8
};

const BGM_KEY = "bgm-main";
type AdjustableSound = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;

export class AudioService {
  private settings: AudioSettings = { ...DEFAULT_SETTINGS };
  private manager?: Phaser.Sound.BaseSoundManager;
  private music?: AdjustableSound;
  private pendingMusicPlayback = false;

  public bind(scene: Phaser.Scene): void {
    this.manager = scene.sound;
    this.applyMix();
  }

  public setSettings(settings: AudioSettings): void {
    this.settings = { ...settings };
    this.applyMix();
  }

  public unlock(): void {
    (this.manager as { unlock?: () => void } | undefined)?.unlock?.();
  }

  public playMusic(): void {
    if (!this.manager) {
      return;
    }

    if (this.manager.locked) {
      if (!this.pendingMusicPlayback) {
        this.pendingMusicPlayback = true;
        this.manager.once("unlocked", () => {
          this.pendingMusicPlayback = false;
          this.playMusic();
        });
      }
      return;
    }

    if (!this.music) {
      this.music = this.manager.add(BGM_KEY, {
        loop: true,
        volume: this.currentMusicVolume()
      }) as AdjustableSound;
    }

    if (!this.music.isPlaying) {
      this.music.play();
    }
    this.applyMix();
  }

  public stopMusic(): void {
    this.music?.stop();
    this.pendingMusicPlayback = false;
  }

  public playMenuConfirm(): void {
    this.playSfx("sfx-menu-confirm", 0.9);
  }

  public playHit(): void {
    this.playSfx("sfx-hit", 0.8);
  }

  public playEnemyBlast(): void {
    this.playSfx("sfx-hit", 1);
  }

  public playGameOver(): void {
    this.playSfx("sfx-game-over", 0.9);
  }

  public playWaveAdvance(): void {
    this.playSfx("sfx-wave-up", 0.8);
  }

  private playSfx(key: string, volumeScale = 1): void {
    if (!this.manager) {
      return;
    }

    const volume = this.currentSfxVolume() * volumeScale;
    if (volume <= 0.001) {
      return;
    }

    this.manager.play(key, { volume });
  }

  private applyMix(): void {
    if (!this.manager) {
      return;
    }

    this.manager.mute = this.settings.muted;
    this.manager.volume = this.settings.masterVolume;

    if (this.music) {
      this.music.setVolume(this.currentMusicVolume());
      if (this.settings.muted || this.currentMusicVolume() <= 0.001) {
        this.music.pause();
      } else if (this.music.isPaused) {
        this.music.resume();
      }
    }
  }

  private currentMusicVolume(): number {
    return this.settings.masterVolume * this.settings.musicVolume;
  }

  private currentSfxVolume(): number {
    return this.settings.masterVolume * this.settings.sfxVolume;
  }
}

export const audioService = new AudioService();
