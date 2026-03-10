import Phaser from "phaser";
import { audioService } from "../core/audio";
import type { GameProfile } from "../core/profile";

export class MainMenuScene extends Phaser.Scene {
  private startPrompt?: Phaser.GameObjects.Text;
  private settingsKey?: Phaser.Input.Keyboard.Key;
  private launchStarted = false;

  public constructor() {
    super("main-menu");
  }

  public create(): void {
    audioService.bind(this);
    audioService.playMusic();
    this.launchStarted = false;

    const { width, height } = this.scale;
    const profile = this.registry.get("profile") as GameProfile;

    this.add.image(width * 0.5, 136, "logo-mark").setDisplaySize(88, 88);
    this.add.text(width * 0.5, 206, "STAR DEFENDER", {
      fontFamily: "Verdana",
      fontSize: "46px",
      color: "#22d3ee",
      fontStyle: "bold"
    }).setOrigin(0.5);

    this.add.text(width * 0.5, 300, "Pilot the strike jet and survive the UFO invasion.", {
      fontFamily: "Verdana",
      fontSize: "28px",
      color: "#e2e8f0"
    }).setOrigin(0.5);

    this.add.text(width * 0.5, 360, `Best Score: ${profile.bestScore}`, {
      fontFamily: "Verdana",
      fontSize: "26px",
      color: "#facc15"
    }).setOrigin(0.5);

    this.add.text(width * 0.5, 402, `Runs: ${profile.totalRuns}  |  Lifetime Score: ${profile.totalScore}`, {
      fontFamily: "Verdana",
      fontSize: "22px",
      color: "#93c5fd"
    }).setOrigin(0.5);

    this.startPrompt = this.add.text(width * 0.5, 484, "Tap / ENTER / SPACE to Launch", {
      fontFamily: "Verdana",
      fontSize: "32px",
      color: "#22d3ee"
    }).setOrigin(0.5);

    this.add.text(width * 0.5, 534, "Press O for Settings", {
      fontFamily: "Verdana",
      fontSize: "24px",
      color: "#bfdbfe"
    }).setOrigin(0.5);

    this.tweens.add({
      targets: this.startPrompt,
      alpha: 0.2,
      yoyo: true,
      repeat: -1,
      duration: 700
    });

    this.input.keyboard?.on("keydown-SPACE", this.startRun, this);
    this.input.keyboard?.on("keydown-ENTER", this.startRun, this);
    this.input.once("pointerdown", this.startRun, this);

    this.settingsKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.O);
    this.settingsKey?.on("down", this.openSettings, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.settingsKey?.off("down", this.openSettings, this);
      this.input.keyboard?.off("keydown-SPACE", this.startRun, this);
      this.input.keyboard?.off("keydown-ENTER", this.startRun, this);
      this.input.off("pointerdown", this.startRun, this);
    });
  }

  private startRun(): void {
    if (this.launchStarted) {
      return;
    }

    this.launchStarted = true;
    audioService.unlock();
    audioService.playMenuConfirm();
    this.scene.start("game");
    this.scene.launch("ui");
  }

  private openSettings(): void {
    if (!this.scene.isActive("settings")) {
      audioService.unlock();
      this.scene.launch("settings", { returnScene: "main-menu" });
    }
  }
}
