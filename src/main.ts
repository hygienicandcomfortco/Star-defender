import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { MainMenuScene } from "./scenes/MainMenuScene";
import { GameScene } from "./scenes/GameScene";
import { UIScene } from "./scenes/UIScene";
import { SettingsScene } from "./scenes/SettingsScene";

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#020617",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    expandParent: true,
    autoRound: true,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    min: {
      width: 480,
      height: 270
    },
    max: {
      width: 2560,
      height: 1440
    }
  },
  input: {
    activePointers: 3
  },
  physics: {
    default: "arcade",
    arcade: {
      debug: false
    }
  },
  scene: [BootScene, PreloadScene, MainMenuScene, GameScene, UIScene, SettingsScene]
});
