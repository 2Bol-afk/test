import React, { useEffect, useRef, useState } from 'react';
import { GameStateStatus, GameStats, TMAction } from '../types';
import { AudioEngineInstance } from '../lib/audio';

interface GameCanvasProps {
  externalAction: TMAction | null;
  resetExternalAction: () => void;
  onStatsUpdate: (stats: GameStats) => void;
  onStatusChange: (status: GameStateStatus) => void;
  gameStatus: GameStateStatus;
  soundMuted: boolean;
  scoreMultiplier?: number;
}

// Fixed virtual resolution for game calculations
const V_WIDTH = 800;
const V_HEIGHT = 400;
const GROUND_Y = 320;

// High contrast retro palette colors
const MOOD_THEMES = [
  // 1. Pixel-Motion Cyan Immersive Engine (0 - 499 pts)
  {
    sky: '#050508', // pure dark space
    ground: '#0a0a0c', // deep slate grid floor
    primary: '#06b6d4', // electric cyber cyan
    secondary: '#ffffff', // white goggles and power-ups
    accent: '#22d3ee', // bright neon cyan
    cloud: 'rgba(6, 182, 212, 0.08)',
    mountain: '#0f172a', // sleek dark structures
  },
  // 2. Cosmic Magenta Grid (500 - 1199 pts)
  {
    sky: '#0a0515', // deep neon violet space
    ground: '#05020d', // dark void floor
    primary: '#ec4899', // bright hot magenta
    secondary: '#38bdf8', // radiant cyan stars
    accent: '#facc15', // gold power sparks
    cloud: 'rgba(236, 72, 153, 0.07)',
    mountain: '#1e1135',
  },
  // 3. Cyber Grid Overdrive (1200+ pts)
  {
    sky: '#020617', // deepest obsidian space
    ground: '#020617', // uniform dark infinite floor
    primary: '#10b981', // neon matrix green
    secondary: '#f43f5e', // deep laser rose
    accent: '#fbbf24', // high-voltage orange
    cloud: 'rgba(16, 185, 129, 0.06)',
    mountain: '#0f172a',
  }
];

// 16x16 pixel sprites represented as grids
// Runner Sprite frames
const MASK_RUNNER_1 = [
  "....XXXXXX......",
  "..XXXXXXOOXX....",
  ".XXXOOXXOOXXX...",
  "XXXXOOOOOOOOXX..",
  "XXXXOOOOXXOOXX..",
  "XXXXXXOOOOXXXX..",
  "..XXXXXXXXXX....",
  "...XXXXXXXX.....",
  "..XXXXXXXXXX....",
  ".XXXXXXXXXXXX...",
  "XXXXXXXXXXXXXX..",
  "XX..XXXXXX..XX..",
  "X....XXXX....X..",
  ".....XX.XX......",
  "....XX...X......",
  "....X..........."
];

const MASK_RUNNER_2 = [
  "....XXXXXX......",
  "..XXXXXXOOXX....",
  ".XXXOOXXOOXXX...",
  "XXXXOOOOOOOOXX..",
  "XXXXOOOOXXOOXX..",
  "XXXXXXOOOOXXXX..",
  "..XXXXXXXXXX....",
  "...XXXXXXXX.....",
  "..XXXXXXXXXX....",
  ".XXXXXXXXXXXX...",
  "XXXXXXXXXXXXXX..",
  "....XXXXXX......",
  "....X...XX......",
  "....X...X.......",
  "....XX..XX......",
  ".........X......"
];

const MASK_RUNNER_CROUCH = [
  "................",
  "................",
  "................",
  "................",
  ".....XXXXXX.....",
  "...XXXXXXOOXX...",
  "..XXXOOXXOOXXX..",
  "X.XXOOOOOOOOXX.X",
  "X.XXOOOOXXOOXX.X",
  "XXXXXXOOOOXXXXXX",
  ".XXXXXXXXXXXXXX.",
  "..XXXXXXXXXXXX..",
  "...XX..XXXX..X..",
  "...XX...XX......",
  "...X....X.......",
  "................"
];

// Obstacle Sprites
const SPRITE_CACTUS = [
  "...XX...XX...",
  "..X..X.X..X..",
  "..X..X.X..X..",
  "..XXXX.XXXX..",
  "....X...X....",
  "....X...X....",
  "....XXXXX....",
  "......X......",
  "......X......",
  "......X......",
  "......X......",
  "......X......",
  "......X......",
  "......X......",
  "......X......",
  "......X......"
];

const SPRITE_BIRD_UP = [
  "......XXX......",
  "....XXOXOXX....",
  "..XXXXOOOOXX...",
  "XXXXXXOOOOXXX..",
  "XXXXXX..XXXXX..",
  ".XXX......XX..X",
  "..X...........X",
  "..............X"
];

const SPRITE_BIRD_DOWN = [
  "......XXX......",
  "....XXOXOXX....",
  "..XXXXOOOOXX...",
  "XXXXXXOOOOXXX..",
  "XXXXXX..XXXXX..",
  "..X...........X",
  ".XXX......XX..X",
  "..X...........X"
];

export const GameCanvas: React.FC<GameCanvasProps> = ({
  externalAction,
  resetExternalAction,
  onStatsUpdate,
  onStatusChange,
  gameStatus,
  soundMuted,
  scoreMultiplier = 1
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Stats
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('retro_tm_high_score');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    highScore: 0,
    obstaclesDodged: 0,
    speedMultiplier: 1.0,
  });

  // Keep references of crucial states for the requestAnimationFrame loop
  const stateRef = useRef({
    status: gameStatus,
    score: 0,
    highScore: 0,
    obstaclesDodged: 0,
    speed: 6.0,
    // Player physics
    playerY: 0,
    playerX: 80,
    playerWidth: 48,
    playerHeight: 48,
    velocityY: 0,
    isJumping: false,
    isCrouching: false,
    animationFrameTimer: 0,
    runFrame: 0,
    // Background objects
    stars: [] as Array<{ x: number; y: number; r: number; speed: number }>,
    clouds: [] as Array<{ x: number; y: number; scale: number; speed: number }>,
    mountains: [] as Array<{ x: number; height: number; width: number }>,
    groundPebbles: [] as Array<{ x: number; y: number; size: number }>,
    // Obstacles
    obstacles: [] as Array<{
      id: number;
      type: 'cactus' | 'cactus_double' | 'bird_high' | 'bird_low' | 'star';
      x: number;
      y: number;
      width: number;
      height: number;
      speed: number;
      isCollected?: boolean;
      animFrame?: number;
    }>,
    obstacleIdCounter: 0,
    nextObstacleTimer: 0,
    lastFrameTime: 0,
    dayNightCycleTimer: 0,
    isMuted: soundMuted
  });

  // Sync basic states to stateRef
  useEffect(() => {
    stateRef.current.status = gameStatus;
    stateRef.current.isMuted = soundMuted;
    AudioEngineInstance.setMute(soundMuted);

    if (gameStatus === 'playing') {
      // Audio starts
      AudioEngineInstance.startThemeSong();
    } else {
      AudioEngineInstance.stopThemeSong();
    }
  }, [gameStatus, soundMuted]);

  // Sync highscore
  useEffect(() => {
    stateRef.current.highScore = highScore;
  }, [highScore]);

  // Actions listener (Webcam movement trigger)
  useEffect(() => {
    if (!externalAction || gameStatus !== 'playing') return;

    if (externalAction === 'jump') {
      triggerJump();
    } else if (externalAction === 'crouch') {
      triggerCrouch(true);
    } else if (externalAction === 'neutral') {
      triggerCrouch(false);
    }
    resetExternalAction();
  }, [externalAction, gameStatus]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      
      if (stateRef.current.status === 'idle' || stateRef.current.status === 'gameover') {
        if (e.key === 'Space' || e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter') {
          startGame();
        }
        return;
      }

      if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w' || e.key === 'W') {
        triggerJump();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        triggerCrouch(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (stateRef.current.status !== 'playing') return;

      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        triggerCrouch(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const startGame = () => {
    // Reset state values
    const state = stateRef.current;
    state.status = 'playing';
    state.score = 0;
    state.obstaclesDodged = 0;
    state.speed = 6.0;
    state.playerY = 0;
    state.velocityY = 0;
    state.isJumping = false;
    state.isCrouching = false;
    state.obstacles = [];
    state.nextObstacleTimer = 90; // Wait a bit before first obstacle
    setScore(0);
    onStatusChange('playing');
    AudioEngineInstance.playCoin();
    AudioEngineInstance.startThemeSong();
  };

  const triggerJump = () => {
    const state = stateRef.current;
    if (state.isJumping || state.isCrouching) return;
    state.velocityY = -13.5; // Jump strength
    state.isJumping = true;
    AudioEngineInstance.playJump();
  };

  const triggerCrouch = (isCrouching: boolean) => {
    const state = stateRef.current;
    if (isCrouching) {
      if (state.isJumping) return; // Cannot crouch mid-air
      if (!state.isCrouching) {
        state.isCrouching = true;
        // Adjust bounds
        state.playerHeight = 32;
        AudioEngineInstance.playCrouch();
      }
    } else {
      if (state.isCrouching) {
        state.isCrouching = false;
        state.playerHeight = 48;
      }
    }
  };

  // Run resize handler
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      // Make canvas size fit container cleanly with 2:1 aspect ratio
      const width = container.clientWidth;
      const height = container.clientHeight || (width / 2);
      
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => {
      observer.disconnect();
    };
  }, []);

  // Initialize background parallax layers once
  useEffect(() => {
    const state = stateRef.current;
    
    // Far stars (neon glowing dots)
    state.stars = Array.from({ length: 30 }, () => ({
      x: Math.random() * V_WIDTH,
      y: Math.random() * (GROUND_Y - 120),
      r: Math.random() * 2 + 1,
      speed: Math.random() * 0.15 + 0.05
    }));

    // Far pixel clouds
    state.clouds = Array.from({ length: 5 }, (_, i) => ({
      x: (i * (V_WIDTH / 4)) + Math.random() * 100,
      y: 40 + Math.random() * 80,
      scale: Math.random() * 1.5 + 0.8,
      speed: Math.random() * 0.3 + 0.15
    }));

    // Mountain silhouettes
    state.mountains = Array.from({ length: 4 }, (_, i) => ({
      x: i * 260,
      height: 60 + Math.random() * 70,
      width: 180 + Math.random() * 100
    }));

    // Ground pebbles texture
    state.groundPebbles = Array.from({ length: 25 }, () => ({
      x: Math.random() * V_WIDTH,
      y: GROUND_Y + 5 + Math.random() * (V_HEIGHT - GROUND_Y - 15),
      size: Math.random() * 4 + 2
    }));
  }, []);

  // Primary animation game loop
  useEffect(() => {
    let animationId: number;

    const gameLoop = (timestamp: number) => {
      const state = stateRef.current;
      if (!state.lastFrameTime) state.lastFrameTime = timestamp;
      const delta = Math.min((timestamp - state.lastFrameTime) / 16.666, 3); // cap delta lag
      state.lastFrameTime = timestamp;

      updateData(delta);
      drawGame();

      animationId = requestAnimationFrame(gameLoop);
    };

    // Update coordinates and physics
    const updateData = (delta: number) => {
      const state = stateRef.current;

      if (state.status === 'playing') {
        // Increment Score gently
        state.score += 0.15 * delta * scoreMultiplier;
        const currentRoundedScore = Math.floor(state.score);
        if (currentRoundedScore > 0 && currentRoundedScore % 100 === 0 && currentRoundedScore !== score) {
          setScore(currentRoundedScore);
          AudioEngineInstance.playCoin(); 
        }

        // Speed increases continuously but slowly
        state.speed = 6.0 + Math.min(state.score / 200, 7.5);

        // Update stats
        if (Math.floor(state.score) !== stats.score) {
          const finishedScore = Math.floor(state.score);
          const newHigh = finishedScore > state.highScore ? finishedScore : state.highScore;
          if (newHigh > state.highScore) {
            setHighScore(newHigh);
            localStorage.setItem('retro_tm_high_score', newHigh.toString());
          }

          const currentStats = {
            score: finishedScore,
            highScore: newHigh,
            obstaclesDodged: state.obstaclesDodged,
            speedMultiplier: parseFloat((state.speed / 6.0).toFixed(2)),
          };
          setStats(currentStats);
          onStatsUpdate(currentStats);
        }
      }

      // 1. Gravity and Player Physics
      if (state.isJumping) {
        state.velocityY += 0.58 * delta; // Gravity pull
        state.playerY += state.velocityY * delta;
        if (state.playerY >= 0) {
          state.playerY = 0;
          state.velocityY = 0;
          state.isJumping = false;
        }
      } else if (state.isCrouching) {
        // Player height and crouch properties handled inside triggerCrouch
      }

      // Animated sprite legs run frames timer
      state.animationFrameTimer += delta;
      if (state.animationFrameTimer >= 8) {
        state.runFrame = (state.runFrame + 1) % 2;
        state.animationFrameTimer = 0;

        // Animate birds wings flap if any are in rendering
        state.obstacles.forEach(obs => {
          if (obs.animFrame !== undefined) {
            obs.animFrame = (obs.animFrame + 1) % 2;
          }
        });
      }

      // Parallax scrolls
      const currentScrollSpeed = state.status === 'playing' ? state.speed : 1.2;

      // Scroll Background Stars
      state.stars.forEach(star => {
        star.x -= star.speed * currentScrollSpeed * delta;
        if (star.x < -20) star.x = V_WIDTH + 20;
      });

      // Scroll Background Clouds
      state.clouds.forEach(cloud => {
        cloud.x -= cloud.speed * currentScrollSpeed * delta;
        if (cloud.x < -150) {
          cloud.x = V_WIDTH + 50;
          cloud.y = 40 + Math.random() * 80;
        }
      });

      // Scroll Mountain bases
      state.mountains.forEach(mtn => {
        mtn.x -= 0.1 * currentScrollSpeed * delta;
        if (mtn.x < -mtn.width) {
          mtn.x = V_WIDTH + Math.random() * 50;
          mtn.height = 60 + Math.random() * 70;
        }
      });

      // Scroll ground pebbles texture
      state.groundPebbles.forEach(peb => {
        peb.x -= currentScrollSpeed * delta;
        if (peb.x < -10) peb.x = V_WIDTH + 10;
      });

      // 2. Obstacles spawn & move
      if (state.status === 'playing') {
        state.nextObstacleTimer -= delta;
        if (state.nextObstacleTimer <= 0) {
          spawnObstacle();
          // Spawn frequency increases/decreases dynamically
          state.nextObstacleTimer = 90 + Math.random() * 120 - Math.min(state.score / 25, 45);
        }

        // Move obstacle array & process logic
        const playerScreenY = GROUND_Y + state.playerY - state.playerHeight;
        
        state.obstacles.forEach((obs) => {
          obs.x -= state.speed * delta;

          // Check collisions with player bounding box
          if (!obs.isCollected) {
            const collisionX = (state.playerX < obs.x + obs.width) && (state.playerX + state.playerWidth > obs.x);
            const collisionY = (playerScreenY < obs.y + obs.height) && (playerScreenY + state.playerHeight > obs.y);

            if (collisionX && collisionY) {
              if (obs.type === 'star') {
                // Collectible clean coin feedback!
                obs.isCollected = true;
                state.score += 75 * scoreMultiplier; // Reward bonus points
                AudioEngineInstance.playCoin(); 
              } else {
                // CRASH! GameOver triggers
                state.status = 'gameover';
                onStatusChange('gameover');
                AudioEngineInstance.playGameOver();
                AudioEngineInstance.stopThemeSong();
              }
            }
          }
        });

        // Filter out past screen obstacles
        const startLen = state.obstacles.length;
        state.obstacles = state.obstacles.filter(obs => {
          const offscreen = obs.x < -100 || obs.isCollected;
          if (obs.x < -100 && obs.type !== 'star') {
            state.obstaclesDodged += 1;
          }
          return !offscreen;
        });
      }
    };

    const spawnObstacle = () => {
      const state = stateRef.current;
      const typeRand = Math.random();
      
      let type: 'cactus' | 'cactus_double' | 'bird_high' | 'bird_low' | 'star';
      let obsWidth = 24;
      let obsHeight = 36;
      let obsY = GROUND_Y - obsHeight;

      if (typeRand < 0.35) {
        // Cactus Spiky bush
        type = 'cactus';
        obsWidth = 24;
        obsHeight = 44;
        obsY = GROUND_Y - obsHeight;
      } else if (typeRand < 0.55) {
        // Double combined cactus size
        type = 'cactus_double';
        obsWidth = 44;
        obsHeight = 44;
        obsY = GROUND_Y - obsHeight;
      } else if (typeRand < 0.70) {
        // High sweeping bird (Must CROUCH under)
        type = 'bird_high';
        obsWidth = 40;
        obsHeight = 24;
        obsY = GROUND_Y - 70; // High sweep bird (Must duck)
      } else if (typeRand < 0.85) {
        // Low bird (Must JUMP over)
        type = 'bird_low';
        obsWidth = 40;
        obsHeight = 24;
        obsY = GROUND_Y - 26; // Floats right above grass
      } else {
        // Spinning Collectible neon score energy star
        type = 'star';
        obsWidth = 20;
        obsHeight = 20;
        obsY = GROUND_Y - 80 - Math.random() * 50; // High in the sky
      }

      state.obstacles.push({
        id: state.obstacleIdCounter++,
        type,
        x: V_WIDTH + 10,
        y: obsY,
        width: obsWidth,
        height: obsHeight,
        speed: state.speed,
        animFrame: 0,
      });
    };

    // Procedure dynamic vector frame draw calculations
    const drawGame = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      const state = stateRef.current;

      // 1. Theme and color selection based on scores
      const themeIndex = Math.min(Math.floor(state.score / 500), MOOD_THEMES.length - 1);
      const theme = MOOD_THEMES[themeIndex];

      // Clear Canvas with Sky Color
      ctx.fillStyle = theme.sky;
      ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

      // Draw background decorations (Stars & Space Dust in Cosmic Themes)
      if (themeIndex >= 1) {
        ctx.fillStyle = theme.accent;
        state.stars.forEach(star => {
          ctx.fillRect(star.x, star.y, star.r, star.r);
        });
      }

      // Parallax: Draw pixel Clouds
      state.clouds.forEach(cloud => {
        ctx.fillStyle = theme.cloud;
        const cx = cloud.x;
        const cy = cloud.y;
        const cl = 20 * cloud.scale;
        
        ctx.fillRect(cx, cy, cl * 2, cl);
        ctx.fillRect(cx - cl * 0.5, cy + cl * 0.2, cl * 3, cl * 0.8);
      });

      // Parallax: Mountains silhouettes
      ctx.fillStyle = theme.mountain;
      state.mountains.forEach(mtn => {
        ctx.beginPath();
        ctx.moveTo(mtn.x, GROUND_Y);
        ctx.lineTo(mtn.x + mtn.width / 2, GROUND_Y - mtn.height);
        ctx.lineTo(mtn.x + mtn.width, GROUND_Y);
        ctx.closePath();
        ctx.fill();
        
        // Add minimalist shadow strip to retro mountain
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.beginPath();
        ctx.moveTo(mtn.x + mtn.width / 2, GROUND_Y - mtn.height);
        ctx.lineTo(mtn.x + mtn.width, GROUND_Y);
        ctx.lineTo(mtn.x + mtn.width / 2, GROUND_Y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = theme.mountain; // Reset
      });

      // 2. Draw ground platform
      ctx.fillStyle = theme.ground;
      ctx.fillRect(0, GROUND_Y, V_WIDTH, V_HEIGHT - GROUND_Y);

      // Draw horizontal neon grid line separating ground and sky
      ctx.fillStyle = theme.primary;
      ctx.fillRect(0, GROUND_Y - 2, V_WIDTH, 4);

      // Draw pebbles texture
      ctx.fillStyle = theme.secondary;
      state.groundPebbles.forEach(peb => {
        ctx.fillRect(peb.x, peb.y, peb.size, 2);
      });

      // 3. Draw Runner Player (Procedural Custom Pixel Block Array Layout)
      const px = state.playerX;
      // Adjust standard crouch frame coordinates
      const py = GROUND_Y + state.playerY - state.playerHeight;
      const pixelSize = state.isCrouching ? state.playerHeight / 16 : state.playerHeight / 16;
      
      const runnerSprite = state.isCrouching 
        ? MASK_RUNNER_CROUCH 
        : (state.isJumping ? MASK_RUNNER_1 : (state.runFrame === 0 ? MASK_RUNNER_1 : MASK_RUNNER_2));

      // Iterative block drawing for retro authentic feeling
      for (let row = 0; row < runnerSprite.length; row++) {
        for (let col = 0; col < runnerSprite[row].length; col++) {
          const char = runnerSprite[row][col];
          if (char === 'X') {
            ctx.fillStyle = theme.primary; // body neon silhouette
            ctx.fillRect(px + col * pixelSize, py + row * pixelSize, pixelSize, pixelSize);
          } else if (char === 'O') {
            ctx.fillStyle = theme.secondary; // visor goggles
            ctx.fillRect(px + col * pixelSize, py + row * pixelSize, pixelSize, pixelSize);
          }
        }
      }

      // Draw a cool motion blur trails behind the player if speeding fast!
      if (state.speed > 9.0 && !state.isCrouching) {
        ctx.fillStyle = theme.primary + '33'; // transparent trail
        for (let row = 0; row < runnerSprite.length; row++) {
          for (let col = 0; col < runnerSprite[row].length; col++) {
            if (runnerSprite[row][col] === 'X') {
              ctx.fillRect(px - 15 + col * pixelSize, py + row * pixelSize, pixelSize, pixelSize);
              ctx.fillRect(px - 30 + col * pixelSize, py + row * pixelSize, pixelSize, pixelSize);
            }
          }
        }
      }

      // 4. Draw Obstacles Custom Sprites
      state.obstacles.forEach((obs) => {
        if (obs.isCollected) return;

        const oX = obs.x;
        const oY = obs.y;
        
        if (obs.type === 'cactus' || obs.type === 'cactus_double') {
          // Green Cactus spiky texture
          ctx.fillStyle = theme.accent;
          const spr = SPRITE_CACTUS;
          const obsPixelSizeY = obs.height / 16;
          const obsPixelSizeX = obs.width / (obs.type === 'cactus_double' ? 24 : 12);
          
          const repeatCount = obs.type === 'cactus_double' ? 2 : 1;
          for (let r = 0; r < repeatCount; r++) {
            const shiftX = r * 18;
            for (let row = 0; row < spr.length; row++) {
              for (let col = 0; col < spr[row].length; col++) {
                if (spr[row][col] === 'X') {
                  ctx.fillRect(oX + shiftX + col * obsPixelSizeX, oY + row * obsPixelSizeY, obsPixelSizeX + 0.5, obsPixelSizeY + 0.5);
                }
              }
            }
          }
        } else if (obs.type === 'bird_high' || obs.type === 'bird_low') {
          // Retro neon bat shadow
          ctx.fillStyle = theme.secondary;
          const spr = obs.animFrame === 0 ? SPRITE_BIRD_UP : SPRITE_BIRD_DOWN;
          const obsPixelY = obs.height / 8;
          const obsPixelX = obs.width / 15;

          for (let row = 0; row < spr.length; row++) {
            for (let col = 0; col < spr[row].length; col++) {
              const char = spr[row][col];
              if (char === 'X') {
                ctx.fillRect(oX + col * obsPixelX, oY + row * obsPixelY, obsPixelX + 0.2, obsPixelY + 0.2);
              } else if (char === 'O') {
                ctx.fillStyle = theme.primary; // neon bird eye glow
                ctx.fillRect(oX + col * obsPixelX, oY + row * obsPixelY, obsPixelX + 0.2, obsPixelY + 0.2);
                ctx.fillStyle = theme.secondary;
              }
            }
          }
        } else if (obs.type === 'star') {
          // Rotational yellow glowing coin star
          const angle = (Date.now() / 100) % (Math.PI * 2);
          const cx = oX + obs.width / 2;
          const cy = oY + obs.height / 2;
          const r = obs.width / 2;

          ctx.fillStyle = theme.accent;
          ctx.shadowColor = theme.accent;
          ctx.shadowBlur = 8;
          
          // Outer retro pixel cross star
          ctx.fillRect(cx - 2, cy - r, 4, r * 2);
          ctx.fillRect(cx - r, cy - 2, r * 2, 4);
          
          // Inner core
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(cx - 3, cy - 3, 6, 6);
          
          // Clear shadow effects for other renders
          ctx.shadowBlur = 0;
        }
      });

      // 5. Overlays (Menus / Retro scanline effects)
      // Screen frame CRT style scans
      ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
      for (let y = 0; y < V_HEIGHT; y += 4) {
        ctx.fillRect(0, y, V_WIDTH, 1.5);
      }

      // Draw Idle screen
      if (state.status === 'idle') {
        drawBlinkingText(ctx, "8-BIT MOTION RUNNER", V_WIDTH / 2, 130, "400 24px 'Press Start 2P'", theme.primary, true);
        drawBlinkingText(ctx, "INSERT COIN TO PLAY", V_WIDTH / 2, 190, "400 13px 'Press Start 2P'", '#FFFFFF', false, 1000);
        
        ctx.fillStyle = theme.secondary;
        ctx.font = "400 11px 'Press Start 2P'";
        ctx.textAlign = 'center';
        ctx.fillText("SPACEBAR / UP TO JUMP", V_WIDTH / 2, 240);
        ctx.fillText("DOWN ARROW TO CROUCH", V_WIDTH / 2, 265);
        ctx.fillText("OR INTEGRATE TEACHABLE MACHINE!", V_WIDTH / 2, 290);
      }

      // Draw GameOver Screen
      if (state.status === 'gameover') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

        drawBlinkingText(ctx, "GAME OVER", V_WIDTH / 2, 150, "400 32px 'Press Start 2P'", theme.primary, true);
        
        ctx.fillStyle = '#FFFFFF';
        ctx.font = "400 14px 'Press Start 2P'";
        ctx.textAlign = 'center';
        ctx.fillText(`SCORE: ${Math.floor(state.score)}`, V_WIDTH / 2, 205);
        if (state.score >= state.highScore && state.score > 10) {
          ctx.fillStyle = theme.accent;
          ctx.fillText("NEW HIGH SCORE!", V_WIDTH / 2, 235);
        } else {
          ctx.fillText(`HIGH SCORE: ${Math.floor(state.highScore)}`, V_WIDTH / 2, 235);
        }

        drawBlinkingText(ctx, "PRESS ENTER or SPACE TO RESTART", V_WIDTH / 2, 295, "400 12px 'Press Start 2P'", '#FFFFFF', false, 1200);
      }
    };

    // Keep blink intervals steady
    const drawBlinkingText = (
      ctx: CanvasRenderingContext2D,
      text: string,
      x: number,
      y: number,
      font: string,
      color: string,
      shadow: boolean,
      interval: number = 800
    ) => {
      const state = stateRef.current;
      const themeIndex = Math.min(Math.floor(state.score / 500), MOOD_THEMES.length - 1);
      const theme = MOOD_THEMES[themeIndex];
      
      const isVisible = Math.floor(performance.now() / interval) % 2 === 0;
      if (isVisible || shadow) {
        ctx.font = font;
        ctx.textAlign = 'center';
        
        if (shadow) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillText(text, x + 3, y + 3);
        }
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
      }
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [stats.score, scoreMultiplier]);

  return (
    <div className="relative w-full h-full flex flex-col items-center">
      {/* 8-bit Screen container */}
      <div 
        ref={containerRef} 
        className="relative w-full aspect-[2/1] overflow-hidden rounded-lg bg-black border-4 border-slate-700 shadow-2xl shadow-black"
        id="arcade-monitor"
      >
        {/* Crisp static canvas pixel scales */}
        <canvas
          ref={canvasRef}
          width={V_WIDTH}
          height={V_HEIGHT}
          className="block h-full w-full select-none"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* Dynamic Game Overlay details while playing */}
        {gameStatus === 'playing' && (
          <div className="absolute top-4 left-4 right-4 flex justify-between select-none font-press-start text-xs text-white p-2 bg-black/45 backdrop-blur-xs rounded pointer-events-none">
            <div className="flex flex-col gap-1 items-start">
              <span>HI: {String(highScore).padStart(5, '0')}</span>
              <span className="text-emerald-400">SCORE: {String(score).padStart(5, '0')}</span>
            </div>
            <div className="flex flex-col gap-1 items-end">
              <span>DODGED: {stats.obstaclesDodged}</span>
              <span className="text-amber-400">SPEED: {stats.speedMultiplier}x</span>
            </div>
          </div>
        )}
      </div>

      {/* Under Screen HUD Info and controls */}
      <div className="w-full flex flex-wrap justify-between items-center gap-3 mt-4 px-2">
        <div className="flex gap-2 text-xs font-mono text-slate-400">
          <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700 font-bold text-white shadow">Space</kbd> / <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700 font-bold text-white shadow">↑</kbd> Jump
          <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700 font-bold text-white shadow ml-2">↓</kbd> Crouch
        </div>
        
        {gameStatus === 'idle' && (
          <button
            onClick={startGame}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 font-press-start text-xs text-white border-b-4 border-orange-850 hover:-translate-y-px active:translate-y-0.5 active:border-b-0 transition-all cursor-pointer shadow-md shadow-orange-950/50"
            id="start-arcade-btn"
          >
            PLAY START MATCH 🕹️
          </button>
        )}

        {gameStatus === 'gameover' && (
          <button
            onClick={startGame}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 font-press-start text-xs text-white border-b-4 border-rose-800 hover:-translate-y-px active:translate-y-0.5 active:border-b-0 transition-all cursor-pointer shadow-md shadow-rose-950/50"
            id="restart-arcade-btn"
          >
            INSERT COIN / RESTART 💸
          </button>
        )}
      </div>
    </div>
  );
};
