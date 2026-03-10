import Phaser from "phaser";
import { audioService } from "../core/audio";
import type { GameProfile } from "../core/profile";

export class MainMenuScene extends Phaser.Scene {
  private logo?: Phaser.GameObjects.Image;
  private titleText?: Phaser.GameObjects.Text;
  private subtitleText?: Phaser.GameObjects.Text;
  private bestScoreText?: Phaser.GameObjects.Text;
  private profileText?: Phaser.GameObjects.Text;
  private startPrompt?: Phaser.GameObjects.Text;
  private settingsPrompt?: Phaser.GameObjects.Text;
  private settingsKey?: Phaser.Input.Keyboard.Key;
  private launchStarted = false;
  private profile?: GameProfile;

  public constructor() {
    super("main-menu");
  }

  public create(): void {
    audioService.bind(this);
    audioService.playMusic();
    this.launchStarted = false;

    this.profile = this.registry.get("profile") as GameProfile;
    this.logo = this.add.image(0, 0, "logo-mark").setOrigin(0.5);
    this.titleText = this.add.text(0, 0, "STAR DEFENDER", {
      fontFamily: "Verdana",
      fontSize: "46px",
      color: "#22d3ee",
      fontStyle: "bold"
    }).setOrigin(0.5);
    this.subtitleText = this.add.text(0, 0, "Pilot the strike jet and survive the UFO invasion.", {
      fontFamily: "Verdana",
      fontSize: "28px",
      color: "#e2e8f0"
      ,
      align: "center"
    }).setOrigin(0.5);

    this.bestScoreText = this.add.text(0, 0, "", {
      fontFamily: "Verdana",
      fontSize: "26px",
      color: "#facc15"
    }).setOrigin(0.5);

    this.profileText = this.add.text(0, 0, "", {
      fontFamily: "Verdana",
      fontSize: "22px",
      color: "#93c5fd",
      align: "center"
    }).setOrigin(0.5);

    this.startPrompt = this.add.text(0, 0, "Tap / ENTER / SPACE to Launch", {
      fontFamily: "Verdana",
      fontSize: "32px",
      color: "#22d3ee"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.startPrompt.on("pointerdown", this.startRun, this);

    this.settingsPrompt = this.add.text(0, 0, "Tap here or press O for Settings", {
      fontFamily: "Verdana",
      fontSize: "24px",
      color: "#bfdbfe"
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.settingsPrompt.on("pointerdown", () => this.openSettings());

    this.layout();

    this.tweens.add({
      targets: this.startPrompt,
      alpha: 0.2,
      yoyo: true,
      repeat: -1,
      duration: 700
    });

    this.input.keyboard?.on("keydown-SPACE", this.startRun, this);
    this.input.keyboard?.on("keydown-ENTER", this.startRun, this);

    this.settingsKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.O);
    this.settingsKey?.on("down", this.openSettings, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.settingsKey?.off("down", this.openSettings, this);
      this.input.keyboard?.off("keydown-SPACE", this.startRun, this);
      this.input.keyboard?.off("keydown-ENTER", this.startRun, this);
      this.startPrompt?.off("pointerdown", this.startRun, this);
      this.settingsPrompt?.off("pointerdown");
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    });
  }

  private startRun(): void {
    if (this.launchStarted) {
      return;
    }

    this.launchStarted = true;
    audioService.unlock();
    if (this.scale.game.device.input.touch && !this.scale.isFullscreen) {
      this.scale.startFullscreen();
    }
    audioService.playMenuConfirm();
    this.scene.start("game");
    this.scene.launch("ui");
  }

  private onResize(): void {
    this.layout();
  }

  private layout(): void {
    const { width, height } = this.scale;
    const compact = width < 760;
    const safeWidth = width * (compact ? 0.9 : 0.8);
    const titleSize = compact ? 32 : 46;
    const bodySize = compact ? 20 : 28;
    const statSize = compact ? 18 : 26;
    const smallStatSize = compact ? 15 : 22;
    const startSize = compact ? 24 : 32;
    const settingsSize = compact ? 18 : 24;

    this.logo?.setPosition(width * 0.5, height * 0.14).setDisplaySize(compact ? 62 : 88, compact ? 62 : 88);
    this.titleText?.setPosition(width * 0.5, height * 0.24).setFontSize(titleSize);
    this.subtitleText?.setPosition(width * 0.5, height * 0.37).setFontSize(bodySize).setWordWrapWidth(safeWidth);

    this.bestScoreText?.setPosition(width * 0.5, height * 0.5).setFontSize(statSize)
      .setText(`Best Score: ${this.profile?.bestScore ?? 0}`);
    this.profileText?.setPosition(width * 0.5, height * 0.58).setFontSize(smallStatSize).setWordWrapWidth(safeWidth)
      .setText(`Runs: ${this.profile?.totalRuns ?? 0}  |  Lifetime Score: ${this.profile?.totalScore ?? 0}`);

    this.startPrompt?.setPosition(width * 0.5, height * 0.72).setFontSize(startSize);
    this.settingsPrompt?.setPosition(width * 0.5, height * 0.82).setFontSize(settingsSize).setWordWrapWidth(safeWidth);
  }

  private openSettings(): void {
    if (!this.scene.isActive("settings")) {
      audioService.unlock();
      this.scene.launch("settings", { returnScene: "main-menu" });
    }
  }
}
