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
    const panelWidth = Math.min(980, width - 70);
    const panelHeight = Math.min(620, height - 70);
    const panelX = width * 0.5;
    const panelY = height * 0.5;
    const panelTop = panelY - panelHeight * 0.5;
    const statsLabelX = panelX - panelWidth * 0.39;
    const statsValueX = panelX - panelWidth * 0.12;
    const controlsX = panelX + panelWidth * 0.16;

    this.add.rectangle(width * 0.5, height * 0.5, width, height, 0x020617, 0.9);
    this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x0b1730, 0.97).setStrokeStyle(3, 0x0ea5e9, 0.9);
    this.add.rectangle(panelX, panelTop + 64, panelWidth - 28, 94, 0x0f254d, 0.9).setStrokeStyle(1, 0x38bdf8, 0.45);

    this.add.image(panelX - panelWidth * 0.39, panelTop + 64, "logo-mark").setDisplaySize(56, 56);
    this.add.text(panelX - panelWidth * 0.31, panelTop + 64, "STAR DEFENDER", {
      fontFamily: "Verdana",
      fontSize: "36px",
      color: "#38bdf8",
      fontStyle: "bold"
    }).setOrigin(0, 0.5);
    this.add.text(panelX + panelWidth * 0.19, panelTop + 64, "COMMAND", {
      fontFamily: "Verdana",
      fontSize: "40px",
      color: "#22d3ee",
      fontStyle: "bold"
    }).setOrigin(0.5);

    this.statusLabelsText = this.add.text(statsLabelX, panelTop + 138, "", {
      fontFamily: "Verdana",
      fontSize: "23px",
      color: "#e2e8f0",
      lineSpacing: 12
    }).setOrigin(0, 0);
    this.statusValuesText = this.add.text(statsValueX, panelTop + 138, "", {
      fontFamily: "Verdana",
      fontSize: "23px",
      color: "#e2e8f0",
      lineSpacing: 12
    }).setOrigin(0, 0);

    const rowY = {
      mute: panelTop + 238,
      master: panelTop + 305,
      music: panelTop + 372,
      sfx: panelTop + 439,
      reset: panelTop + 506
    };

    this.createButton(controlsX, rowY.mute, 330, 48, "Toggle Mute", () => {
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

    this.createButton(controlsX, rowY.reset, 330, 48, "Reset Save Profile", () => {
      this.profile = ProfileStore.reset();
      this.registry.set("state", createRuntimeGameState(this.profile.bestScore) satisfies RuntimeGameState);
      this.commitProfile();
    });

    this.createButton(panelX, panelTop + panelHeight - 34, 230, 46, "Close (Esc)", () => {
      this.closeSettings();
    });

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
    this.add.text(x - 164, y, `${label} Volume`, {
      fontFamily: "Verdana",
      fontSize: "20px",
      color: "#bfdbfe"
    }).setOrigin(0, 0.5);

    this.createButton(x + 76, y, 62, 42, "-", onMinus);
    this.createButton(x + 150, y, 62, 42, "+", onPlus);
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
      fontSize: "24px",
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
