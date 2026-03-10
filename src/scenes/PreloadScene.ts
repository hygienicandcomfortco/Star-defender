import Phaser from "phaser";
import { AUDIO_ASSETS, IMAGE_ASSETS } from "../assets/manifest";

export class PreloadScene extends Phaser.Scene {
  public constructor() {
    super("preload");
  }

  public preload(): void {
    const { width, height } = this.scale;
    const box = this.add.rectangle(width * 0.5, height * 0.5, 520, 28, 0x0f172a);
    box.setStrokeStyle(2, 0x38bdf8, 0.7);

    const bar = this.add.rectangle(width * 0.5 - 258, height * 0.5, 4, 20, 0x22d3ee).setOrigin(0, 0.5);
    this.add.text(width * 0.5, height * 0.5 - 50, "Loading Assets", {
      fontFamily: "Verdana",
      fontSize: "28px",
      color: "#dbeafe"
    }).setOrigin(0.5);

    this.load.on("progress", (value: number) => {
      bar.width = 516 * value;
    });

    IMAGE_ASSETS.forEach((asset) => {
      this.load.image(asset.key, asset.path);
    });

    AUDIO_ASSETS.forEach((asset) => {
      this.load.audio(asset.key, asset.paths);
    });
  }

  public create(): void {
    this.scene.start("main-menu");
  }
}
