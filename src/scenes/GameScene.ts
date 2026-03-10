import Phaser from "phaser";
import { audioService } from "../core/audio";
import { ProfileStore, type GameProfile } from "../core/profile";
import {
  createRuntimeGameState,
  type DifficultyTier,
  type PowerUpType,
  type RuntimeGameState
} from "../types/game";

type EnemyType = "ufo-scout" | "ufo-raider" | "ufo-mothership";
type ActivePowerUps = Partial<Record<PowerUpType, number>>;

const PLAYER_BASE_SPEED = 350;
const OVERDRIVE_SPEED_MULTIPLIER = 1.45;
const POWER_UP_SPAWN_INTERVAL_MS = 4500;
const POWER_UP_DURATION_MS = 7000;
const POWER_UP_DESPAWN_MS = 5000;
const BULLET_FIRE_INTERVAL_MS = 220;
const BULLET_SPEED = 680;
const BULLET_LIFETIME_MS = 1300;
const OVERDRIVE_FLAME_INTERVAL_MS = 75;
const POWER_UP_TEXTURE_KEYS: Record<PowerUpType, string> = {
  overdrive: "powerup-overdrive",
  bullet: "powerup-bullet"
};
const PLAYER_BULLET_TEXTURE_KEY = "player-bullet";

interface EnemyBody extends Phaser.Physics.Arcade.Image {
  speed: number;
  enemyType: EnemyType;
  scoreValue: number;
  steerCooldownMs: number;
  lifeTimeMs: number;
  baseVelocityX: number;
  baseVelocityY: number;
  hasCollided: boolean;
}

interface EnemyConfig {
  textureKey: string;
  speedRange: [number, number];
  size: number;
  scoreValue: number;
}

interface PowerUpBody extends Phaser.Physics.Arcade.Image {
  powerUpType: PowerUpType;
  lifeTimeMs: number;
}

interface BulletBody extends Phaser.Physics.Arcade.Image {
  lifeTimeMs: number;
}

const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  "ufo-scout": { textureKey: "enemy", speedRange: [150, 220], size: 34, scoreValue: 1 },
  "ufo-raider": { textureKey: "enemy-dasher", speedRange: [240, 330], size: 30, scoreValue: 2 },
  "ufo-mothership": { textureKey: "enemy-tank", speedRange: [100, 155], size: 46, scoreValue: 3 }
};

export class GameScene extends Phaser.Scene {
  private player?: Phaser.Physics.Arcade.Sprite;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<"w" | "a" | "s" | "d", Phaser.Input.Keyboard.Key>;
  private enemies?: Phaser.Physics.Arcade.Group;
  private state!: RuntimeGameState;
  private profile!: GameProfile;
  private spawnTimer = 0;
  private waveStartSeconds = 0;
  private spawnBudget = 0;
  private pauseKey?: Phaser.Input.Keyboard.Key;
  private fireKey?: Phaser.Input.Keyboard.Key;
  private damageLocked = false;
  private powerUps?: Phaser.Physics.Arcade.Group;
  private bullets?: Phaser.Physics.Arcade.Group;
  private powerUpSpawnTimer = 0;
  private activePowerUps: ActivePowerUps = {};
  private bulletFireTimer = 0;
  private overdriveFlameTimer = 0;
  private readonly mobileMove = new Phaser.Math.Vector2(0, 0);
  private touchControlsEnabled = false;
  private joystickBase?: Phaser.GameObjects.Arc;
  private joystickKnob?: Phaser.GameObjects.Arc;
  private joystickTouchArea?: Phaser.GameObjects.Zone;
  private fireButton?: Phaser.GameObjects.Arc;
  private fireTouchArea?: Phaser.GameObjects.Zone;
  private joystickPointerId: number | null = null;
  private firePointerId: number | null = null;
  private mobileFireDown = false;
  private mouseFireDown = false;
  private mouseFirePointerId: number | null = null;
  private pauseButton?: Phaser.GameObjects.Container;
  private pauseButtonBg?: Phaser.GameObjects.Arc;
  private joystickCenter = new Phaser.Math.Vector2(0, 0);
  private readonly joystickRadius = 58;
  private readonly joystickKnobTravel = 34;
  private readonly fireButtonRadius = 48;

  public constructor() {
    super("game");
  }

  public create(): void {
    audioService.bind(this);
    audioService.playMusic();

    // Reset transient combat state every run. Scene instances are reused.
    this.damageLocked = false;
    this.spawnTimer = 0;
    this.waveStartSeconds = 0;
    this.spawnBudget = 0;
    this.powerUpSpawnTimer = 0;
    this.activePowerUps = {};
    this.bulletFireTimer = 0;
    this.overdriveFlameTimer = 0;
    this.mouseFireDown = false;
    this.mouseFirePointerId = null;

    this.profile = this.registry.get("profile") as GameProfile;
    this.profile = ProfileStore.update((profile) => ({
      ...profile,
      totalRuns: profile.totalRuns + 1
    }));
    this.registry.set("profile", this.profile);

    this.state = createRuntimeGameState(this.profile.bestScore);
    this.registry.set("state", this.state);

    this.createArena();
    this.ensureGameplayTextures();
    this.createActors();
    this.createInput();
    this.createMobileControls();

    this.enemies = this.physics.add.group();
    this.powerUps = this.physics.add.group();
    this.bullets = this.physics.add.group();
    this.physics.add.overlap(this.player!, this.enemies, (_player, enemy) => {
      this.onPlayerHit(enemy as EnemyBody);
    });
    this.physics.add.overlap(this.player!, this.powerUps, (_player, powerUp) => {
      this.onPowerUpCollected(powerUp as PowerUpBody);
    });
    this.physics.add.overlap(this.bullets, this.enemies, (bullet, enemy) => {
      this.onBulletHitEnemy(bullet as BulletBody, enemy as EnemyBody);
    });
    this.physics.add.collider(this.enemies, this.enemies, (first, second) => {
      this.onEnemyCollision(first as EnemyBody, second as EnemyBody);
    });

    this.startWave(1);
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.state.isPaused) {
          return;
        }
        this.state.elapsedSeconds += 1;
        this.state.score += 5;
        this.state.difficulty = this.computeDifficulty(this.state.elapsedSeconds);
      }
    });
  }

  public update(_: number, delta: number): void {
    if (!this.player || !this.cursors || !this.wasd || !this.enemies) {
      return;
    }
    if (this.state.isPaused) {
      this.player.setVelocity(0, 0);
      return;
    }

    this.handlePlayerMovement();
    this.updatePowerUps(delta);
    this.updateOverdriveFlame(delta);
    this.handleBulletFireInput();
    this.handleSpawning(delta);
    this.updateEnemies(delta);
    this.updateBullets(delta);
    this.checkWaveAdvance();
    this.syncPowerUpStateToHud();
    this.registry.set("state", this.state);
  }

  private createArena(): void {
    this.add.tileSprite(
      this.scale.width * 0.5,
      this.scale.height * 0.5,
      this.scale.width,
      this.scale.height,
      "arena-tile"
    ).setAlpha(0.6);

    this.add.rectangle(this.scale.width * 0.5, this.scale.height * 0.5, this.scale.width, this.scale.height)
      .setStrokeStyle(4, 0x0ea5e9, 0.35);
  }

  private createActors(): void {
    this.player = this.physics.add.sprite(this.scale.width * 0.5, this.scale.height * 0.5, "player");
    this.player.setDisplaySize(38, 38);
    this.player.setCollideWorldBounds(true);
  }

  private createInput(): void {
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.wasd = this.input.keyboard?.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D
    }) as Record<"w" | "a" | "s" | "d", Phaser.Input.Keyboard.Key>;

    this.pauseKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.fireKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.pauseKey?.on("down", () => {
      this.togglePauseMenu();
    });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.pauseKey?.removeAllListeners();
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
      this.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
      this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
      this.pauseButtonBg?.off(Phaser.Input.Events.POINTER_DOWN);
    });
  }

  private handlePlayerMovement(): void {
    if (!this.player || !this.cursors || !this.wasd) {
      return;
    }

    const speed = this.getCurrentPlayerSpeed();
    let inputX = 0;
    let inputY = 0;

    if (this.cursors.left.isDown || this.wasd.a.isDown) inputX = -1;
    if (this.cursors.right.isDown || this.wasd.d.isDown) inputX = 1;
    if (this.cursors.up.isDown || this.wasd.w.isDown) inputY = -1;
    if (this.cursors.down.isDown || this.wasd.s.isDown) inputY = 1;

    if (inputX === 0 && inputY === 0 && this.mobileMove.lengthSq() > 0.0001) {
      inputX = this.mobileMove.x;
      inputY = this.mobileMove.y;
    }

    const vx = inputX * speed;
    const vy = inputY * speed;

    this.player.setVelocity(vx, vy);
    if (vx !== 0 || vy !== 0) {
      this.player.setRotation(Math.atan2(vy, vx) + Math.PI * 0.5);
    }
  }

  private updatePowerUps(delta: number): void {
    if (!this.powerUps) {
      return;
    }

    this.powerUps.getChildren().forEach((child) => {
      const powerUp = child as PowerUpBody;
      powerUp.lifeTimeMs += delta;
      if (powerUp.lifeTimeMs >= POWER_UP_DESPAWN_MS) {
        powerUp.destroy();
      }
    });

    const now = this.time.now;
    (Object.keys(this.activePowerUps) as PowerUpType[]).forEach((type) => {
      const expiresAtMs = this.activePowerUps[type];
      if (expiresAtMs !== undefined && now >= expiresAtMs) {
        delete this.activePowerUps[type];
      }
    });

    if (!this.isPowerUpActive("bullet")) {
      this.bulletFireTimer = 0;
    }

    this.bulletFireTimer += delta;

    this.powerUpSpawnTimer += delta;
    if (this.powerUpSpawnTimer < POWER_UP_SPAWN_INTERVAL_MS) {
      return;
    }

    this.powerUpSpawnTimer = 0;
    if (this.powerUps.countActive(true) > 0) {
      return;
    }

    this.spawnPowerUp(this.pickPowerUpType());
  }

  private handleBulletFireInput(): void {
    if (!this.isPowerUpActive("bullet")) {
      return;
    }
    const isFiring = !!this.fireKey?.isDown || this.mobileFireDown || this.mouseFireDown;
    if (!isFiring) {
      return;
    }
    if (this.bulletFireTimer < BULLET_FIRE_INTERVAL_MS) {
      return;
    }

    this.bulletFireTimer = 0;
    this.firePlayerBullet();
  }

  private handleSpawning(delta: number): void {
    if (this.spawnBudget <= 0) {
      return;
    }

    this.spawnTimer += delta;
    const spawnRate = this.getSpawnRate(this.state.difficulty);
    if (this.spawnTimer < spawnRate) {
      return;
    }

    this.spawnTimer = 0;
    const type = this.pickEnemyType();
    this.spawnEnemy(type);
    this.spawnBudget -= 1;
  }

  private updateEnemies(delta: number): void {
    if (!this.enemies || !this.player) {
      return;
    }

    this.enemies.getChildren().forEach((child) => {
      const enemy = child as EnemyBody;
      enemy.lifeTimeMs += delta;

      if (enemy.enemyType === "ufo-scout") {
        enemy.steerCooldownMs -= delta;
        if (enemy.steerCooldownMs <= 0) {
          enemy.steerCooldownMs = 220;
          this.physics.moveToObject(enemy, this.player!, enemy.speed);
        }
      }

      if (enemy.enemyType === "ufo-raider") {
        const curve = Math.sin(enemy.lifeTimeMs * 0.01) * 32;
        const base = new Phaser.Math.Vector2(enemy.baseVelocityX, enemy.baseVelocityY).normalize();
        const side = new Phaser.Math.Vector2(-base.y, base.x);
        enemy.setVelocity(base.x * enemy.speed + side.x * curve, base.y * enemy.speed + side.y * curve);
      }

      if (enemy.x < -90 || enemy.x > this.scale.width + 90 || enemy.y < -90 || enemy.y > this.scale.height + 90) {
        enemy.destroy();
        this.state.score += enemy.scoreValue;
      }
    });
  }

  private updateBullets(delta: number): void {
    if (!this.bullets) {
      return;
    }

    this.bullets.getChildren().forEach((child) => {
      const bullet = child as BulletBody;
      bullet.lifeTimeMs += delta;
      if (bullet.lifeTimeMs >= BULLET_LIFETIME_MS) {
        bullet.destroy();
      }
    });
  }

  private checkWaveAdvance(): void {
    if (!this.enemies) {
      return;
    }

    const waveDuration = this.state.elapsedSeconds - this.waveStartSeconds;
    const noEnemies = this.enemies.countActive(true) === 0;
    if ((this.spawnBudget <= 0 && noEnemies) || waveDuration >= 28) {
      this.startWave(this.state.wave + 1);
    }
  }

  private startWave(wave: number): void {
    this.state.wave = wave;
    this.waveStartSeconds = this.state.elapsedSeconds;
    this.spawnBudget = 8 + wave * 2;
    this.state.score += 10 + wave * 2;
    audioService.playWaveAdvance();
  }

  private togglePauseMenu(): void {
    if (this.state.lives <= 0) {
      return;
    }

    if (!this.state.isPaused) {
      this.state.isPaused = true;
      this.registry.set("state", this.state);
      this.scene.launch("settings", { returnScene: "game" });
      this.scene.pause();
    }
  }

  private spawnEnemy(type: EnemyType): void {
    if (!this.enemies || !this.player) {
      return;
    }

    const side = Phaser.Math.Between(0, 3);
    let x = 0;
    let y = 0;

    if (side === 0) {
      x = Phaser.Math.Between(0, this.scale.width);
      y = -30;
    } else if (side === 1) {
      x = this.scale.width + 30;
      y = Phaser.Math.Between(0, this.scale.height);
    } else if (side === 2) {
      x = Phaser.Math.Between(0, this.scale.width);
      y = this.scale.height + 30;
    } else {
      x = -30;
      y = Phaser.Math.Between(0, this.scale.height);
    }

    const config = ENEMY_CONFIGS[type];
    const enemy = this.enemies.create(x, y, config.textureKey) as EnemyBody;
    const difficultyMultiplier = this.getEnemySpeedMultiplier(this.state.difficulty);
    const speed = Phaser.Math.Between(config.speedRange[0], config.speedRange[1]) * difficultyMultiplier;

    enemy.enemyType = type;
    enemy.speed = speed;
    enemy.scoreValue = config.scoreValue;
    enemy.steerCooldownMs = 0;
    enemy.lifeTimeMs = 0;
    enemy.hasCollided = false;
    enemy.setDisplaySize(config.size, config.size);

    const direction = new Phaser.Math.Vector2(this.player.x - x, this.player.y - y).normalize();
    enemy.baseVelocityX = direction.x;
    enemy.baseVelocityY = direction.y;

    if (type === "ufo-mothership") {
      this.physics.moveToObject(enemy, this.player, speed);
    } else {
      enemy.setVelocity(direction.x * speed, direction.y * speed);
    }
  }

  private spawnPowerUp(type: PowerUpType): void {
    if (!this.powerUps) {
      return;
    }

    const x = Phaser.Math.Between(70, this.scale.width - 70);
    const y = Phaser.Math.Between(70, this.scale.height - 70);
    const powerUp = this.powerUps.create(x, y, POWER_UP_TEXTURE_KEYS[type]) as PowerUpBody;
    powerUp.powerUpType = type;
    powerUp.lifeTimeMs = 0;
    powerUp.setDisplaySize(28, 28);
    powerUp.setDepth(940);
  }

  private pickPowerUpType(): PowerUpType {
    const roll = Phaser.Math.Between(1, 100);
    return roll <= 55 ? "overdrive" : "bullet";
  }

  private onPowerUpCollected(powerUp: PowerUpBody): void {
    powerUp.destroy();

    // Multiple power-ups can run together; collecting same type refreshes duration.
    this.activePowerUps[powerUp.powerUpType] = this.time.now + POWER_UP_DURATION_MS;
    this.bulletFireTimer = 0;
    this.state.score += 20;
  }

  private firePlayerBullet(): void {
    if (!this.player || !this.bullets) {
      return;
    }

    const bullet = this.bullets.create(this.player.x, this.player.y - 20, PLAYER_BULLET_TEXTURE_KEY) as BulletBody;
    bullet.lifeTimeMs = 0;
    bullet.setDisplaySize(8, 18);
    bullet.setDepth(942);
    const rotation = this.player.rotation;
    const dirX = Math.sin(rotation);
    const dirY = -Math.cos(rotation);
    bullet.setVelocity(dirX * BULLET_SPEED, dirY * BULLET_SPEED);
    bullet.setRotation(rotation);
  }

  private onBulletHitEnemy(bullet: BulletBody, enemy: EnemyBody): void {
    if (!bullet.active || !enemy.active) {
      return;
    }
    bullet.destroy();
    enemy.destroy();
    this.spawnEnemyBlast(enemy.x, enemy.y);
    audioService.playEnemyBlast();
    this.state.score += enemy.scoreValue;
  }

  private onPlayerHit(enemy: EnemyBody): void {
    if (!this.player || this.damageLocked || this.state.lives <= 0) {
      return;
    }

    this.damageLocked = true;
    const hitX = enemy.x;
    const hitY = enemy.y;
    enemy.destroy();
    this.spawnEnemyBlast(hitX, hitY);
    audioService.playEnemyBlast();

    this.state.lives -= 1;
    const crashStage = 3 - this.state.lives;

    this.player.setTint(0xfca5a5);
    this.cameras.main.shake(130, 0.0035);

    this.time.delayedCall(120, () => {
      this.player?.clearTint();
    });

    if (crashStage === 1) {
      this.spawnJetSmoke(false);
      audioService.playHit();
      this.releaseDamageLock(420);
      return;
    }

    if (crashStage === 2) {
      this.spawnJetSmoke(true);
      audioService.playHit();
      this.releaseDamageLock(520);
      return;
    }

    this.spawnJetBlast();
    audioService.playGameOver();
    this.time.delayedCall(520, () => {
      this.onGameOver();
    });
  }

  private onGameOver(): void {
    this.damageLocked = false;

    const bestScore = Math.max(this.state.score, this.profile.bestScore);
    this.profile = ProfileStore.update((profile) => ({
      ...profile,
      bestScore,
      totalScore: profile.totalScore + this.state.score,
      totalSecondsSurvived: profile.totalSecondsSurvived + this.state.elapsedSeconds
    }));

    this.registry.set("profile", this.profile);
    this.registry.set("state", {
      ...this.state,
      bestScore
    } satisfies RuntimeGameState);

    this.scene.stop("ui");
    this.scene.stop("settings");
    this.scene.start("main-menu");
  }

  private pickEnemyType(): EnemyType {
    const wave = this.state.wave;
    const roll = Phaser.Math.Between(1, 100);

    if (wave <= 2) {
      return roll <= 80 ? "ufo-scout" : "ufo-raider";
    }
    if (wave <= 4) {
      if (roll <= 55) return "ufo-scout";
      if (roll <= 85) return "ufo-raider";
      return "ufo-mothership";
    }
    if (roll <= 35) return "ufo-scout";
    if (roll <= 70) return "ufo-raider";
    return "ufo-mothership";
  }

  private onEnemyCollision(first: EnemyBody, second: EnemyBody): void {
    if (!first.active || !second.active || first === second) {
      return;
    }
    if (first.hasCollided || second.hasCollided) {
      return;
    }

    first.hasCollided = true;
    second.hasCollided = true;

    const blastX = (first.x + second.x) * 0.5;
    const blastY = (first.y + second.y) * 0.5;
    first.destroy();
    second.destroy();

    this.spawnEnemyBlast(blastX, blastY);
    audioService.playEnemyBlast();
  }

  private computeDifficulty(elapsedSeconds: number): DifficultyTier {
    if (elapsedSeconds < 25) return "rookie";
    if (elapsedSeconds < 60) return "pro";
    return "elite";
  }

  private getSpawnRate(difficulty: DifficultyTier): number {
    if (difficulty === "rookie") return 860;
    if (difficulty === "pro") return 620;
    return 460;
  }

  private getEnemySpeedMultiplier(difficulty: DifficultyTier): number {
    if (difficulty === "rookie") return 1;
    if (difficulty === "pro") return 1.2;
    return 1.42;
  }

  private releaseDamageLock(delayMs: number): void {
    this.time.delayedCall(delayMs, () => {
      this.damageLocked = false;
    });
  }

  private spawnEnemyBlast(x: number, y: number): void {
    const flash = this.add.circle(x, y, 14, 0xfb923c, 0.85);
    flash.setDepth(950);
    this.tweens.add({
      targets: flash,
      scale: 2.2,
      alpha: 0,
      duration: 180,
      onComplete: () => flash.destroy()
    });

    for (let i = 0; i < 10; i += 1) {
      const spark = this.add.circle(x, y, Phaser.Math.Between(2, 4), 0xfef08a, 1);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(24, 54);
      spark.setDepth(948);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        duration: Phaser.Math.Between(160, 260),
        onComplete: () => spark.destroy()
      });
    }
  }

  private spawnJetSmoke(dark: boolean): void {
    if (!this.player) {
      return;
    }

    const baseX = this.player.x;
    const baseY = this.player.y + 16;
    const color = dark ? 0x1f2937 : 0x64748b;

    for (let i = 0; i < 7; i += 1) {
      const puff = this.add.circle(
        baseX + Phaser.Math.Between(-10, 10),
        baseY + Phaser.Math.Between(-4, 4),
        Phaser.Math.Between(6, 12),
        color,
        dark ? 0.7 : 0.55
      );
      puff.setDepth(945);
      this.tweens.add({
        targets: puff,
        x: puff.x + Phaser.Math.Between(-18, 18),
        y: puff.y - Phaser.Math.Between(26, 58),
        alpha: 0,
        scale: Phaser.Math.FloatBetween(1.4, 2),
        duration: Phaser.Math.Between(450, 760),
        onComplete: () => puff.destroy()
      });
    }
  }

  private spawnJetBlast(): void {
    if (!this.player) {
      return;
    }

    const x = this.player.x;
    const y = this.player.y;
    this.spawnEnemyBlast(x, y);

    const ring = this.add.circle(x, y, 18, 0xf97316, 0.25);
    ring.setStrokeStyle(4, 0xfacc15, 0.95).setDepth(951);
    this.tweens.add({
      targets: ring,
      scale: 3.2,
      alpha: 0,
      duration: 320,
      onComplete: () => ring.destroy()
    });

    this.spawnJetSmoke(true);
    this.spawnJetSmoke(true);
    this.player.setVisible(false);
  }

  private getCurrentPlayerSpeed(): number {
    if (this.isPowerUpActive("overdrive")) {
      return PLAYER_BASE_SPEED * OVERDRIVE_SPEED_MULTIPLIER;
    }
    return PLAYER_BASE_SPEED;
  }

  private syncPowerUpStateToHud(): void {
    this.state.activePowerUps = (Object.keys(this.activePowerUps) as PowerUpType[])
      .map((type) => {
        const expiresAtMs = this.activePowerUps[type];
        if (expiresAtMs === undefined) {
          return null;
        }
        const remainingMs = Math.max(0, expiresAtMs - this.time.now);
        return {
          type,
          remainingSeconds: Math.ceil(remainingMs / 1000),
          durationSeconds: Math.ceil(POWER_UP_DURATION_MS / 1000)
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }

  private isPowerUpActive(type: PowerUpType): boolean {
    const expiresAtMs = this.activePowerUps[type];
    if (expiresAtMs === undefined) {
      return false;
    }
    return expiresAtMs > this.time.now;
  }

  private ensureGameplayTextures(): void {
    if (!this.textures.exists(POWER_UP_TEXTURE_KEYS.overdrive)) {
      const graphic = this.make.graphics({ x: 0, y: 0 }, false);
      graphic.fillStyle(0x22d3ee, 1);
      graphic.fillCircle(14, 14, 14);
      graphic.fillStyle(0xfef08a, 1);
      graphic.fillCircle(14, 14, 6);
      graphic.lineStyle(2, 0xffffff, 0.9);
      graphic.strokeCircle(14, 14, 12);
      graphic.generateTexture(POWER_UP_TEXTURE_KEYS.overdrive, 28, 28);
      graphic.destroy();
    }

    if (!this.textures.exists(POWER_UP_TEXTURE_KEYS.bullet)) {
      const graphic = this.make.graphics({ x: 0, y: 0 }, false);
      graphic.fillStyle(0xf97316, 1);
      graphic.fillCircle(14, 14, 14);
      graphic.fillStyle(0xfef08a, 1);
      graphic.fillRect(12, 6, 4, 16);
      graphic.fillStyle(0xffffff, 1);
      graphic.fillRect(11, 4, 6, 4);
      graphic.lineStyle(2, 0xffedd5, 0.95);
      graphic.strokeCircle(14, 14, 12);
      graphic.generateTexture(POWER_UP_TEXTURE_KEYS.bullet, 28, 28);
      graphic.destroy();
    }

    if (!this.textures.exists(PLAYER_BULLET_TEXTURE_KEY)) {
      const graphic = this.make.graphics({ x: 0, y: 0 }, false);
      graphic.fillStyle(0xfef08a, 1);
      graphic.fillRoundedRect(2, 0, 4, 18, 2);
      graphic.fillStyle(0xffffff, 1);
      graphic.fillRoundedRect(2, 0, 4, 6, 2);
      graphic.generateTexture(PLAYER_BULLET_TEXTURE_KEY, 8, 18);
      graphic.destroy();
    }
  }

  private createMobileControls(): void {
    this.touchControlsEnabled = this.sys.game.device.input.touch;
    if (!this.touchControlsEnabled) {
      return;
    }

    this.input.addPointer(2);

    this.joystickBase = this.add.circle(0, 0, this.joystickRadius, 0x0f172a, 0.35)
      .setStrokeStyle(2, 0x38bdf8, 0.7)
      .setDepth(960);
    this.joystickKnob = this.add.circle(0, 0, 26, 0x67e8f9, 0.62)
      .setStrokeStyle(2, 0xffffff, 0.45)
      .setDepth(961);
    this.joystickTouchArea = this.add.zone(0, 0, 170, 170)
      .setDepth(959)
      .setInteractive();

    this.fireButton = this.add.circle(0, 0, this.fireButtonRadius, 0xf97316, 0.52)
      .setStrokeStyle(2, 0xffedd5, 0.8)
      .setDepth(960);
    this.fireTouchArea = this.add.zone(0, 0, 170, 170)
      .setDepth(959)
      .setInteractive();

    const pauseBg = this.add.circle(0, 0, 32, 0x0f172a, 0.52)
      .setStrokeStyle(2, 0x93c5fd, 0.85)
      .setDepth(963)
      .setInteractive();
    const pauseIcon = this.add.text(0, 0, "II", {
      fontFamily: "Verdana",
      fontSize: "26px",
      color: "#e2e8f0",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(964);
    this.pauseButtonBg = pauseBg;
    this.pauseButton = this.add.container(0, 0, [pauseBg, pauseIcon]).setDepth(963);
    pauseBg.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.togglePauseMenu();
    });

    this.layoutMobileControls();

    this.joystickTouchArea.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (this.joystickPointerId !== null) {
        return;
      }
      this.joystickPointerId = pointer.id;
      this.updateJoystick(pointer);
    });

    this.fireTouchArea.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (this.firePointerId !== null) {
        return;
      }
      this.firePointerId = pointer.id;
      this.mobileFireDown = true;
      this.fireButton?.setScale(0.9).setFillStyle(0xf97316, 0.82);
    });

    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const isMouseInput = pointer.event instanceof MouseEvent;
    if (!isMouseInput || pointer.button !== 0) {
      return;
    }
    this.mouseFireDown = true;
    this.mouseFirePointerId = pointer.id;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.joystickPointerId) {
      this.updateJoystick(pointer);
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.joystickPointerId) {
      this.joystickPointerId = null;
      this.mobileMove.set(0, 0);
      this.joystickKnob?.setPosition(this.joystickCenter.x, this.joystickCenter.y);
    }
    if (pointer.id === this.firePointerId) {
      this.firePointerId = null;
      this.mobileFireDown = false;
      this.fireButton?.setScale(1).setFillStyle(0xf97316, 0.52);
    }
    if (pointer.id === this.mouseFirePointerId) {
      this.mouseFirePointerId = null;
      this.mouseFireDown = false;
    }
  }

  private updateJoystick(pointer: Phaser.Input.Pointer): void {
    const deltaX = pointer.x - this.joystickCenter.x;
    const deltaY = pointer.y - this.joystickCenter.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const limited = Math.min(distance, this.joystickKnobTravel);
    const normalizedX = distance === 0 ? 0 : deltaX / distance;
    const normalizedY = distance === 0 ? 0 : deltaY / distance;

    this.mobileMove.set(
      Phaser.Math.Clamp(deltaX / this.joystickKnobTravel, -1, 1),
      Phaser.Math.Clamp(deltaY / this.joystickKnobTravel, -1, 1)
    );
    this.joystickKnob?.setPosition(
      this.joystickCenter.x + normalizedX * limited,
      this.joystickCenter.y + normalizedY * limited
    );
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    this.physics.world.setBounds(0, 0, gameSize.width, gameSize.height);
    if (this.touchControlsEnabled) {
      this.layoutMobileControls();
    }
  }

  private layoutMobileControls(): void {
    if (!this.touchControlsEnabled) {
      return;
    }

    const margin = 86;
    this.joystickCenter.set(margin, this.scale.height - margin);
    const fireX = this.scale.width - margin;
    const fireY = this.scale.height - margin;

    this.joystickBase?.setPosition(this.joystickCenter.x, this.joystickCenter.y);
    this.joystickKnob?.setPosition(this.joystickCenter.x, this.joystickCenter.y);
    this.joystickTouchArea?.setPosition(this.joystickCenter.x, this.joystickCenter.y);

    this.fireButton?.setPosition(fireX, fireY);
    this.fireTouchArea?.setPosition(fireX, fireY);
    this.pauseButton?.setPosition(this.scale.width - 62, 62);
  }

  private updateOverdriveFlame(delta: number): void {
    if (!this.player || !this.isPowerUpActive("overdrive")) {
      this.overdriveFlameTimer = 0;
      return;
    }

    if (this.player.body && this.player.body.velocity.lengthSq() < 64) {
      this.overdriveFlameTimer = 0;
      return;
    }

    this.overdriveFlameTimer += delta;
    if (this.overdriveFlameTimer < OVERDRIVE_FLAME_INTERVAL_MS) {
      return;
    }
    this.overdriveFlameTimer = 0;
    this.spawnOverdriveFlame();
  }

  private spawnOverdriveFlame(): void {
    if (!this.player) {
      return;
    }

    const rotation = this.player.rotation;
    const backwardX = -Math.sin(rotation);
    const backwardY = Math.cos(rotation);
    const sideX = -backwardY;
    const sideY = backwardX;
    const originX = this.player.x + backwardX * 18;
    const originY = this.player.y + backwardY * 18;

    const flame = this.add.circle(originX, originY, Phaser.Math.Between(4, 7), 0xf97316, 0.88);
    flame.setDepth(944);
    this.tweens.add({
      targets: flame,
      x: originX + backwardX * Phaser.Math.Between(28, 52) + sideX * Phaser.Math.Between(-8, 8),
      y: originY + backwardY * Phaser.Math.Between(28, 52) + sideY * Phaser.Math.Between(-8, 8),
      scale: Phaser.Math.FloatBetween(0.45, 0.8),
      alpha: 0,
      duration: Phaser.Math.Between(120, 190),
      onComplete: () => flame.destroy()
    });

    const core = this.add.circle(originX, originY, Phaser.Math.Between(2, 4), 0xfef08a, 0.95);
    core.setDepth(945);
    this.tweens.add({
      targets: core,
      x: originX + backwardX * Phaser.Math.Between(18, 36) + sideX * Phaser.Math.Between(-5, 5),
      y: originY + backwardY * Phaser.Math.Between(18, 36) + sideY * Phaser.Math.Between(-5, 5),
      scale: 0.4,
      alpha: 0,
      duration: Phaser.Math.Between(90, 150),
      onComplete: () => core.destroy()
    });
  }
}
