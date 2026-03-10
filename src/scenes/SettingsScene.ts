import Phaser from "phaser";
import { audioService } from "../core/audio";
import { ProfileStore, type GameProfile } from "../core/profile";
import { createRuntimeGameState, type RuntimeGameState } from "../types/game";

const STEP = 0.1;

interface SettingsSceneData {
  returnScene: "main-menu" | "game";
}

interface UIButton {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  bg: Phaser.GameObjects.Rectangle;
}

export class SettingsScene extends Phaser.Scene {
  private dataSource: SettingsSceneData = { returnScene: "main-menu" };
  private statusLabelsText?: Phaser.GameObjects.Text;
  private statusValuesText?: Phaser.GameObjects.Text;
  private profile!: GameProfile;
  private uiScale = 1;
  private compact = false;

  public constructor() {
    super("settings");
  }

  public init(data: Partial<SettingsSceneData>): void {
    this.dataSource = {
      returnScene: data.returnScene ?? "main-menu"
    };
  }

  public create(): void {
    audioService.bind(this);
    this.profile = this.registry.get("profile") as GameProfile;
    const { width, height } = this.scale;
    this.uiScale = Phaser.Math.Clamp(Math.min(width / 1280, height / 720), 0.54, 1);
    this.compact = width < 900;
    const panelMargin = this.compact ? 20 : 70;
    const panelWidth = Math.min(980 * this.uiScale, width - panelMargin);
    const panelHeight = Math.min(620 * this.uiScale, height - panelMargin);
    const panelX = width * 0.5;
    const panelY = height * 0.5;
    const panelTop = panelY - panelHeight * 0.5;
    const statsLabelX = panelX - panelWidth * (this.compact ? 0.44 : 0.39);
    const statsValueX = panelX - panelWidth * (this.compact ? 0.1 : 0.12);
    const controlsX = panelX + panelWidth * (this.compact ? 0.05 : 0.16);

    this.add.rectangle(width * 0.5, height * 0.5, width, height, 0x020617, 0.9);
    this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x0b1730, 0.97).setStrokeStyle(3, 0x0ea5e9, 0.9);
    this.add.rectangle(panelX, panelTop + 64 * this.uiScale, panelWidth - 28 * this.uiScale, 94 * this.uiScale, 0x0f254d, 0.9)
      .setStrokeStyle(1, 0x38bdf8, 0.45);

    this.add.image(panelX - panelWidth * 0.39, panelTop + 64 * this.uiScale, "logo-mark")
      .setDisplaySize(56 * this.uiScale, 56 * this.uiScale);
    this.add.text(panelX - panelWidth * 0.31, panelTop + 64 * this.uiScale, "STAR DEFENDER", {
      fontFamily: "Verdana",
      fontSize: `${Math.round(36 * this.uiScale)}px`,
      color: "#38bdf8",
      fontStyle: "bold"
    }).setOrigin(0, 0.5);
    this.add.text(panelX + panelWidth * 0.19, panelTop + 64 * this.uiScale, "COMMAND", {
      fontFamily: "Verdana",
      fontSize: `${Math.round(40 * this.uiScale)}px`,
      color: "#22d3ee",
      fontStyle: "bold"
    }).setOrigin(0.5);

    this.statusLabelsText = this.add.text(statsLabelX, panelTop + 138, "", {
      fontFamily: "Verdana",
      fontSize: `${Math.round(23 * this.uiScale)}px`,
      color: "#e2e8f0",
      lineSpacing: Math.round(12 * this.uiScale)
    }).setOrigin(0, 0);
    this.statusValuesText = this.add.text(statsValueX, panelTop + 138, "", {
      fontFamily: "Verdana",
      fontSize: `${Math.round(23 * this.uiScale)}px`,
      color: "#e2e8f0",
      lineSpacing: Math.round(12 * this.uiScale)
    }).setOrigin(0, 0);

    const rowY = {
      mute: panelTop + 238 * this.uiScale,
      master: panelTop + 305 * this.uiScale,
      music: panelTop + 372 * this.uiScale,
      sfx: panelTop + 439 * this.uiScale,
      reset: panelTop + 506 * this.uiScale
    };
    const mainButtonWidth = Math.round(330 * this.uiScale);
    const mainButtonHeight = Math.round(48 * this.uiScale);

    this.createButton(controlsX, rowY.mute, mainButtonWidth, mainButtonHeight, "Toggle Mute", () => {
      this.profile.settings.muted = !this.profile.settings.muted;
      this.commitProfile();
    });

    this.createSteppedControl(controlsX, rowY.master, "Master", () => {
      this.profile.settings.masterVolume = Math.max(0, this.profile.settings.masterVolume - STEP);
      this.commitProfile();
    }, () => {
      this.profile.settings.masterVolume = Math.min(1, this.profile.settings.masterVolume + STEP);
      this.commitProfile();
    });

    this.createSteppedControl(controlsX, rowY.music, "Music", () => {
      this.profile.settings.musicVolume = Math.max(0, this.profile.settings.musicVolume - STEP);
      this.commitProfile();
    }, () => {
      this.profile.settings.musicVolume = Math.min(1, this.profile.settings.musicVolume + STEP);
      this.commitProfile();
    });

    this.createSteppedControl(controlsX, rowY.sfx, "SFX", () => {
      this.profile.settings.sfxVolume = Math.max(0, this.profile.settings.sfxVolume - STEP);
      this.commitProfile();
    }, () => {
      this.profile.settings.sfxVolume = Math.min(1, this.profile.settings.sfxVolume + STEP);
      this.commitProfile();
    });

    this.createButton(controlsX, rowY.reset, mainButtonWidth, mainButtonHeight, "Reset Save Profile", () => {
      this.profile = ProfileStore.reset();
      this.registry.set("state", createRuntimeGameState(this.profile.bestScore) satisfies RuntimeGameState);
      this.commitProfile();
    });

    this.createButton(
      panelX,
      panelTop + panelHeight - 34 * this.uiScale,
      Math.round(230 * this.uiScale),
      Math.round(46 * this.uiScale),
      this.compact ? "Close" : "Close (Esc)",
      () => {
      this.closeSettings();
      }
    );

    this.input.keyboard?.on("keydown-ESC", this.closeSettings, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown-ESC", this.closeSettings, this);
    });
    this.renderStatus();
  }

  private createSteppedControl(
    x: number,
    y: number,
    label: string,
    onMinus: () => void,
    onPlus: () => void
  ): void {
    this.add.text(x - 164 * this.uiScale, y, `${label} Volume`, {
      fontFamily: "Verdana",
      fontSize: `${Math.round(20 * this.uiScale)}px`,
      color: "#bfdbfe"
    }).setOrigin(0, 0.5);

    this.createButton(x + 76 * this.uiScale, y, Math.round(62 * this.uiScale), Math.round(42 * this.uiScale), "-", onMinus);
    this.createButton(x + 150 * this.uiScale, y, Math.round(62 * this.uiScale), Math.round(42 * this.uiScale), "+", onPlus);
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    onClick: () => void
  ): UIButton {
    const bg = this.add.rectangle(0, 0, width, height, 0x0b3c66, 0.88).setStrokeStyle(1, 0x38bdf8, 0.65);
    const label = this.add.text(0, 0, text, {
      fontFamily: "Verdana",
      fontSize: `${Math.round(24 * this.uiScale)}px`,
      color: "#dbeafe"
    }).setOrigin(0.5);

    const container = this.add.container(x, y, [bg, label]).setSize(width, height);
    bg.setInteractive({ useHandCursor: true });

    bg.on("pointerover", () => {
      bg.setFillStyle(0x14598c, 0.95);
      label.setColor("#67e8f9");
    });
    bg.on("pointerout", () => {
      bg.setFillStyle(0x0b3c66, 0.88);
      label.setColor("#dbeafe");
    });
    bg.on("pointerdown", () => {
      audioService.playMenuConfirm();
      onClick();
    });

    return { container, label, bg };
  }

  private commitProfile(): void {
    this.profile = ProfileStore.update(() => this.profile);
    this.registry.set("profile", this.profile);
    audioService.setSettings(this.profile.settings);
    this.renderStatus();
  }

  private renderStatus(): void {
    if (!this.statusLabelsText || !this.statusValuesText) {
      return;
    }

    const seconds = this.profile.totalSecondsSurvived;
    this.statusLabelsText.setText([
      "Audio Status",
      "Master Level",
      "Music Level",
      "SFX Level",
      "",
      "Best Score",
      "Lifetime Runs",
      "Survival Time"
    ]);
    this.statusValuesText.setText([
      this.profile.settings.muted ? "MUTED" : "ACTIVE",
      `${Math.round(this.profile.settings.masterVolume * 100)}%`,
      `${Math.round(this.profile.settings.musicVolume * 100)}%`,
      `${Math.round(this.profile.settings.sfxVolume * 100)}%`,
      "",
      `${this.profile.bestScore}`,
      `${this.profile.totalRuns}`,
      `${seconds}s`
    ]);
  }

  private closeSettings(): void {
    if (this.dataSource.returnScene === "game") {
      const state = this.registry.get("state") as RuntimeGameState;
      state.isPaused = false;
      this.registry.set("state", state);
      this.scene.resume("game");
    }
    this.scene.stop();
  }
}
