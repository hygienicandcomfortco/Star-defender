import Phaser from "phaser";
import { audioService } from "../core/audio";
import { ProfileStore } from "../core/profile";
import { createRuntimeGameState } from "../types/game";

export class BootScene extends Phaser.Scene {
  public constructor() {
    super("boot");
  }

  public create(): void {
    audioService.bind(this);
    const profile = ProfileStore.load();
    this.registry.set("profile", profile);
    this.registry.set("state", createRuntimeGameState(profile.bestScore));
    audioService.setSettings(profile.settings);

    this.input.keyboard?.once("keydown", () => audioService.unlock());
    this.input.once("pointerdown", () => audioService.unlock());

    this.scene.start("preload");
  }
}
