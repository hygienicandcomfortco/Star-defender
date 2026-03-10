import Phaser from "phaser";
import type { PowerUpType, RuntimeGameState } from "../types/game";

interface PowerUpHudSlot {
  icon: Phaser.GameObjects.Image;
  ringBg: Phaser.GameObjects.Graphics;
  ring: Phaser.GameObjects.Graphics;
  timer: Phaser.GameObjects.Text;
}

export class UIScene extends Phaser.Scene {
  private label?: Phaser.GameObjects.Text;
  private pauseLabel?: Phaser.GameObjects.Text;
  private hudPanel?: Phaser.GameObjects.Rectangle;
  private hudLogo?: Phaser.GameObjects.Image;
  private hudTitle?: Phaser.GameObjects.Text;
  private powerUpSlots: Record<PowerUpType, PowerUpHudSlot> | null = null;
  private touchDevice = false;

  public constructor() {
    super("ui");
  }

  public create(): void {
    this.touchDevice = this.sys.game.device.input.touch;

    this.hudPanel = this.add.rectangle(20, 20, 340, 200, 0x020b1d, 0.78)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x0ea5e9, 0.75)
      .setDepth(1000);

    this.hudLogo = this.add.image(46, 46, "logo-mark")
      .setDisplaySize(34, 34)
      .setOrigin(0.5)
      .setDepth(1001);
    this.hudTitle = this.add.text(70, 46, "STAR DEFENDER", {
      fontFamily: "Verdana",
      fontSize: "19px",
      color: "#67e8f9",
      fontStyle: "bold"
    }).setOrigin(0, 0.5).setDepth(1001);

    this.label = this.add.text(34, 76, "", {
      fontFamily: "Verdana",
      fontSize: "18px",
      color: "#e2e8f0"
    }).setDepth(1001);

    this.pauseLabel = this.add.text(this.scale.width * 0.5, this.scale.height * 0.5, "PAUSED", {
      fontFamily: "Verdana",
      fontSize: "64px",
      color: "#22d3ee",
      fontStyle: "bold"
    }).setOrigin(0.5).setVisible(false).setDepth(1200);

    this.powerUpSlots = {
      overdrive: this.createPowerUpSlot(262, 188, "powerup-overdrive"),
      bullet: this.createPowerUpSlot(312, 188, "powerup-bullet")
    };
  }

  public update(): void {
    if (!this.label) {
      return;
    }

    const hideHud = this.scene.isActive("settings");
    this.hudPanel?.setVisible(!hideHud);
    this.hudLogo?.setVisible(!hideHud);
    this.hudTitle?.setVisible(!hideHud);
    this.label.setVisible(!hideHud);

    const state = this.registry.get("state") as RuntimeGameState;
    this.label.setText([
      `Score  ${state.score}`,
      `Lives  ${state.lives}`,
      `Time   ${state.elapsedSeconds}s`,
      `Tier   ${state.difficulty.toUpperCase()}`,
      `Wave   ${state.wave}`,
      this.touchDevice ? "Touch Move + Fire" : "Esc    Command"
    ]);
    this.updatePowerUpSlots(state, hideHud);

    this.pauseLabel?.setVisible(state.isPaused);
  }

  private createPowerUpSlot(x: number, y: number, textureKey: string): PowerUpHudSlot {
    const ringBg = this.add.graphics().setDepth(1001);
    const ring = this.add.graphics().setDepth(1002);
    const icon = this.add.image(x, y, textureKey).setDisplaySize(24, 24).setDepth(1002).setVisible(false);
    const timer = this.add.text(x, y, "", {
      fontFamily: "Verdana",
      fontSize: "10px",
      color: "#e2e8f0",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(1003).setVisible(false);

    return { icon, ringBg, ring, timer };
  }

  private updatePowerUpSlots(state: RuntimeGameState, hideHud: boolean): void {
    if (!this.powerUpSlots) {
      return;
    }

    const byType = new Map(state.activePowerUps.map((entry) => [entry.type, entry]));
    (Object.keys(this.powerUpSlots) as PowerUpType[]).forEach((type) => {
      const slot = this.powerUpSlots![type];
      const active = byType.get(type);
      const visible = !hideHud && !!active;

      slot.icon.setVisible(visible);
      slot.timer.setVisible(visible);
      if (!visible || !active) {
        slot.ring.clear();
        slot.ringBg.clear();
        return;
      }

      const remaining = Math.max(0, active.remainingSeconds);
      const duration = Math.max(1, active.durationSeconds);
      const progress = Phaser.Math.Clamp(remaining / duration, 0, 1);
      const x = slot.icon.x;
      const y = slot.icon.y;
      const radius = 16;
      const startAngle = -Math.PI * 0.5;

      slot.ringBg.clear();
      slot.ringBg.lineStyle(3, 0x334155, 0.95);
      slot.ringBg.strokeCircle(x, y, radius);

      slot.ring.clear();
      slot.ring.lineStyle(3, 0x22d3ee, 1);
      slot.ring.beginPath();
      slot.ring.arc(x, y, radius, startAngle, startAngle + Math.PI * 2 * progress, false);
      slot.ring.strokePath();

      slot.timer.setText(`${remaining}`);
    });
  }
}
