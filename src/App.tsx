/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameCanvas } from './components/GameCanvas';
import { TeachableMachineController } from './components/TeachableMachineController';
import { GameStateStatus, GameStats, TMAction, TMConfig } from './types';
import { Volume2, VolumeX, Flame, Zap, Trophy, Gamepad2, Info, ArrowUpCircle, Sparkles, BookOpen, ExternalLink, HelpCircle } from 'lucide-react';

export default function App() {
  const [gameStatus, setGameStatus] = useState<GameStateStatus>('idle');
  const [externalAction, setExternalAction] = useState<TMAction | null>(null);
  
  // Dynamic Score Statistics
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    highScore: 0,
    obstaclesDodged: 0,
    speedMultiplier: 1.0,
  });

  // Sound Config
  const [soundMuted, setSoundMuted] = useState(false);

  // Score Multiplier / Difficulty Level
  const [difficulty, setDifficulty] = useState<'normal' | 'hard' | 'overdrive'>('normal');

  // Teachable Machine Configuration State
  const [tmConfig, setTmConfig] = useState<TMConfig>({
    modelUrl: '',
    isModelLoaded: false,
    isWebcamActive: false,
    mappings: {
      jump: 'Jump',
      crouch: 'Crouch',
      neutral: 'Idle'
    },
    confidenceThreshold: 0.85
  });

  // Dynamic Instructions Dialog Toggle
  const [showGuide, setShowGuide] = useState(false);

  // Convert Difficulty to Score Multiplier
  const getScoreMultiplier = () => {
    switch (difficulty) {
      case 'hard': return 1.5;
      case 'overdrive': return 2.2;
      default: return 1.0;
    }
  };

  const handleActionTriggered = (action: TMAction) => {
    setExternalAction(action);
  };

  const resetExternalAction = () => {
    setExternalAction(null);
  };

  return (
    <div 
      className="min-h-screen text-slate-100 font-sans relative overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-300"
      style={{ 
        backgroundColor: '#030305',
        backgroundImage: 'radial-gradient(circle at center, #10101e 0%, #030305 100%)' 
      }}
    >
      
      {/* Parallax Cyber Background Grid lines */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-cyan-500/5 blur-[140px] rounded-full pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-10 flex flex-col min-h-screen relative z-10">
        
        {/* Header Ribbon bar */}
        <header className="flex justify-between items-center bg-black/60 backdrop-blur-md px-6 py-4 rounded-2xl border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)] mb-8 flex-wrap gap-4">
          
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-950/40 text-cyan-400 rounded-xl border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.15)]">
              <Gamepad2 className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-press-start text-cyan-400 animate-pulse">● PIXEL-MOTION ENGINE</span>
                <span className="px-2 py-0.5 bg-cyan-950 text-cyan-400 text-[10px] font-mono border border-cyan-800 rounded font-bold">LIVE-V1.3</span>
              </div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight font-sans text-white mt-0.5 flex items-center gap-1.5 uppercase italic">
                8-Bit <span className="font-press-start text-xs font-normal tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-300">MOTION</span> Platformer
              </h1>
            </div>
          </div>

          {/* Quick Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            
            {/* Difficulty Pill Selectors */}
            <div className="flex bg-slate-950/90 p-1 rounded-lg border border-cyan-950/60 text-xs font-mono">
              <button
                onClick={() => setDifficulty('normal')}
                className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                  difficulty === 'normal' ? 'bg-cyan-600 text-white font-bold shadow-[0_0_8px_rgba(6,182,212,0.4)]' : 'text-slate-400 hover:text-white'
                }`}
              >
                EASY
              </button>
              <button
                onClick={() => setDifficulty('hard')}
                className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                  difficulty === 'hard' ? 'bg-cyan-600 text-white font-bold shadow-[0_0_8px_rgba(6,182,212,0.4)]' : 'text-slate-400 hover:text-white'
                }`}
              >
                HARD (1.5x)
              </button>
              <button
                onClick={() => setDifficulty('overdrive')}
                className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                  difficulty === 'overdrive' ? 'bg-rose-600 text-white font-bold shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'text-slate-400 hover:text-white'
                }`}
              >
                TURBO (2.2x)
              </button>
            </div>

            {/* Mute Synth Button */}
            <button
              onClick={() => setSoundMuted(!soundMuted)}
              style={{ contentVisibility: 'auto' }}
              className={`p-2 rounded-xl border cursor-pointer transition-colors ${
                soundMuted 
                  ? 'bg-rose-950/40 text-rose-450 border-rose-900/50 hover:bg-rose-900/30' 
                  : 'bg-cyan-950/40 text-cyan-400 border-cyan-900/50 hover:bg-cyan-900/30 shadow-[0_0_8px_rgba(6,182,212,0.15)]'
              }`}
              title={soundMuted ? "Unmute Retro Synth" : "Mute Retro Synth"}
            >
              {soundMuted ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5 animate-bounce" />}
            </button>

            {/* Guide Button */}
            <button
              onClick={() => setShowGuide(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white transition-all shadow-[0_0_12px_rgba(6,182,212,0.3)] cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>HOW TO PLAY</span>
            </button>
          </div>
        </header>

        {/* Dynamic score header if in session */}
        <AnimatePresence>
          {stats.score > 0 && gameStatus === 'playing' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex justify-between items-center p-3 mb-6 bg-black/60 border border-cyan-500/20 rounded-xl overflow-hidden font-mono text-xs shadow-[0_0_10px_rgba(6,182,212,0.08)]"
            >
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-cyan-400 animate-bounce" />
                <span className="text-slate-400">SESSION ACHIEVEMENTS:</span>
              </div>
              <div className="flex gap-4">
                <span className="text-cyan-400 font-bold">DODGED: {stats.obstaclesDodged}</span>
                <span className="text-rose-400 font-bold">MULTIPLIER: {getScoreMultiplier()}x</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grid Area: Game on left, Controller Setup on right */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-10">
          
          {/* Left Panel: Primary Game Display Arcade Station */}
          <section className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="p-6 rounded-2xl bg-black/60 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)] relative">
              {/* Outer decorative cabinet stickers */}
              <div className="absolute top-0 left-6 -translate-y-1/2 px-3 py-0.5 rounded bg-cyan-600 border border-cyan-400 text-[9px] font-press-start text-white shadow-[0_0_8px_rgba(6,182,212,0.4)]">
                RETRO ARCADE CABINET SYSTEM
              </div>
              
              <GameCanvas
                externalAction={externalAction}
                resetExternalAction={resetExternalAction}
                onStatsUpdate={setStats}
                onStatusChange={setGameStatus}
                gameStatus={gameStatus}
                soundMuted={soundMuted}
                scoreMultiplier={getScoreMultiplier()}
              />
            </div>

            {/* Quick calibration help box */}
            <div className="p-5 rounded-2xl bg-black/60 border border-cyan-500/20 backdrop-blur-md flex gap-4 shadow-[0_0_10px_rgba(6,182,212,0.05)]">
              <Info className="w-5 h-5 text-cyan-450 shrink-0 mt-0.5" />
              <div className="text-xs font-mono text-slate-400 leading-relaxed">
                <span className="font-bold text-slate-200 block mb-1">PRO-TIPS FOR BEST MOTION CONTROLS:</span>
                1. <span className="text-cyan-400 font-bold">FACIAL EXPRESSIONS:</span> Train your model on face poses! Map a <span className="text-cyan-400 font-bold">Smile or Open Mouth</span> to JUMP, and a <span className="text-rose-400 font-bold">Wink or Frown</span> to CROUCH.<br />
                2. <span className="text-cyan-400 font-bold">BODY POSTURES:</span> Stand 1-2 meters back. Use fast movements like hands raised high to JUMP and bowing down to CROUCH.<br />
                3. Set the sensitivity threshold slider to 80-85% to filter out tracking jitter.
              </div>
            </div>

          </section>

          {/* Right Panel: Teachable Machine webcam & classifier settings */}
          <section className="lg:col-span-5 flex flex-col gap-6">
            <TeachableMachineController
              onActionTriggered={handleActionTriggered}
              config={tmConfig}
              onConfigChange={setTmConfig}
            />

            {/* Quick link guide */}
            <div className="p-5 rounded-2xl bg-black/60 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.12)] flex flex-col gap-3 font-mono text-xs">
              <span className="text-slate-300 font-bold flex items-center gap-1">
                <HelpCircle className="w-4 h-4 text-cyan-450" />
                CREATE YOUR OWN MODEL?
              </span>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Create dynamic classes named "Idle", "Jump", and "Crouch" on Teachable Machine, export using raw TFJS cloud links, paste it into our connector, and you can play instantly using your body movements!
              </p>
              <a
                href="https://teachablemachine.withgoogle.com/train/image"
                target="_blank"
                rel="noreferrer noopener"
                className="self-start text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 font-bold pt-1"
              >
                <span>OPEN TEACHABLE MACHINE</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </section>

        </main>

        {/* Explanatory Walkthrough Overlay modal */}
        <AnimatePresence>
          {showGuide && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              id="guide-modal"
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="bg-slate-950 border border-cyan-500/30 rounded-2xl p-6 max-w-2xl w-full shadow-[0_0_30px_rgba(6,182,212,0.25)] relative"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-md font-press-start text-cyan-400 flex items-center gap-2 tracking-wide">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    GAME SETUP GUIDE
                  </h3>
                  <button
                    onClick={() => setShowGuide(false)}
                    className="p-1 px-2.5 rounded bg-slate-900 border border-slate-800 hover:border-cyan-500/30 text-xs font-mono text-slate-400 hover:text-white cursor-pointer transition-colors"
                  >
                    CLOSE [Esc]
                  </button>
                </div>

                <div className="font-mono text-xs text-slate-300 flex flex-col gap-5 leading-relaxed overflow-y-auto max-h-[70vh] pr-2">
                  <div>
                    <span className="font-bold text-cyan-400 block mb-1 font-sans text-sm">🎮 KEYBOARD PLAY (IMMEDIATE)</span>
                    No camera or model ready? No worries! Just click <span className="text-cyan-400 font-bold">PLAY START MATCH</span> inside the game window. Use:
                    <ul className="list-disc pl-5 mt-1.5 space-y-1">
                      <li><kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-white text-[10px]">SPACE</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-white text-[10px]">↑</kbd> row to JUMP.</li>
                      <li><kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-white text-[10px]">↓</kbd> row to CROUCH.</li>
                    </ul>
                  </div>

                  <hr className="border-cyan-500/10" />

                  <div>
                    <span className="font-bold text-cyan-400 block mb-1 font-sans text-sm">🤖 TEACHABLE MACHINE POSE CONTROL</span>
                    To activate state-of-the-art interactive motion controls:
                    
                    <ol className="list-decimal pl-5 mt-2 space-y-3">
                      <li>
                        <strong className="text-white font-sans">Train Poses or Expressions:</strong> Open <a href="https://teachablemachine.withgoogle.com/" target="_blank" rel="noreferrer noopener" className="text-cyan-400 hover:underline inline-flex items-center gap-0.5">Teachable Machine <ExternalLink className="w-3 h-3" /></a> and choose "Image Project". Create three classes (e.g. "Happy", "Sad", "Angry" or "Idle", "Jump", "Crouch"). Record several webcam snapshots of your face or body postures for each.
                      </li>
                      <li>
                        <strong className="text-white font-sans">Export Link:</strong> Click "Export Model", select "Tensorflow.js" and submit "Upload my model" to obtain the hosted share URL (looks like <code className="text-cyan-300">https://teachablemachine.withgoogle.com/models/ab12XY/</code>).
                      </li>
                      <li>
                        <strong className="text-white font-sans">Load & Map:</strong> Paste your URL in the input box on the right and click Connect. Once loaded, our Class Auto-Mapper will let you easily choose which classes map to game actions!
                      </li>
                      <li>
                        <strong className="text-white font-sans">Play:</strong> Move in front of your camera and watch the character jump and slide relative to your poses! Use the trigger sensitivity slider to adjust delay offsets.
                      </li>
                    </ol>
                  </div>

                  <div className="p-3 bg-cyan-950/20 border border-cyan-900/60 rounded text-cyan-300 text-[11px]">
                    ⚠️ Note: Camera frame tracking is computed entirely locally in your secure browser. None of your video feeds or pixel metrics are transmitted or stored on remote cloud nodes.
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowGuide(false)}
                    className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-sans text-xs font-bold text-white shadow-[0_0_12px_rgba(6,182,212,0.4)] cursor-pointer transition-all"
                  >
                    GOT IT! LET'S PLAY
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer info brand */}
        <footer className="mt-auto border-t border-cyan-500/20 pt-8 pb-4 text-center font-mono text-[10px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span>Developed via secure sandboxed AI container. All computations kept 100% server-side or local.</span>
          </div>
          <div className="flex items-center gap-2 text-cyan-500">
            <span>Retro CRT filter and audio engine included.</span>
          </div>
        </footer>

      </div>
    </div>
  );
}
