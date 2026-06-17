import React, { useEffect, useRef, useState } from 'react';
import { TMAction, TMConfig, PredictionResult } from '../types';
import { Play, Video, VideoOff, Settings, RefreshCw, AlertCircle, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react';

interface TeachableMachineControllerProps {
  onActionTriggered: (action: TMAction) => void;
  config: TMConfig;
  onConfigChange: (newConfig: TMConfig) => void;
}

// CDNs for TensorFlow and Teachable Machine Image
const TFJS_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.11.0/dist/tf.min.js';
const TM_IMAGE_URL = 'https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8.5/dist/teachablemachine-image.min.js';

export const TeachableMachineController: React.FC<TeachableMachineControllerProps> = ({
  onActionTriggered,
  config,
  onConfigChange
}) => {
  // Library load states
  const [libsLoading, setLibsLoading] = useState(false);
  const [libsReady, setLibsReady] = useState(false);
  const [libsError, setLibsError] = useState<string | null>(null);

  // Connection states
  const [modelLoading, setModelLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [classLabels, setClassLabels] = useState<string[]>([]);
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [activeAction, setActiveAction] = useState<TMAction | 'neutral'>('neutral');

  // Simulator helper states (if user has no webcam or TM model)
  const [useSimulator, setUseSimulator] = useState(false);
  const [simulatorPreset, setSimulatorPreset] = useState<'pose' | 'expression'>('pose');
  const [simValues, setSimValues] = useState<{ [key: string]: number }>({
    'Idle': 0.90,
    'Jump': 0.05,
    'Crouch': 0.05
  });

  const changeSimulatorPreset = (preset: 'pose' | 'expression') => {
    setSimulatorPreset(preset);
    if (preset === 'expression') {
      const exprValues = {
        'Neutral Face': 0.90,
        'Smile / Open Mouth': 0.05,
        'Frown / Wink': 0.05
      };
      setSimValues(exprValues);
      setClassLabels(Object.keys(exprValues));
      onConfigChange({
        ...config,
        mappings: {
          neutral: 'Neutral Face',
          jump: 'Smile / Open Mouth',
          crouch: 'Frown / Wink'
        }
      });
    } else {
      const poseValues = {
        'Idle': 0.90,
        'Jump': 0.05,
        'Crouch': 0.05
      };
      setSimValues(poseValues);
      setClassLabels(Object.keys(poseValues));
      onConfigChange({
        ...config,
        mappings: {
          neutral: 'Idle',
          jump: 'Jump',
          crouch: 'Crouch'
        }
      });
    }
  };

  // Refs for tracking active objects across frames
  const webcamContainerRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<any>(null);
  const webcamRef = useRef<any>(null);
  const loopRef = useRef<number | null>(null);

  // Clean script loading helper
  const loadScripts = async (): Promise<boolean> => {
    if ((window as any).tf && (window as any).tmImage) {
      setLibsReady(true);
      return true;
    }

    setLibsLoading(true);
    setLibsError(null);

    try {
      // Load TF.js first
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = TFJS_URL;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load TensorFlow.js from server CDN'));
        document.head.appendChild(script);
      });

      // Load Teachable Machine second
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = TM_IMAGE_URL;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Teachable Machine module'));
        document.head.appendChild(script);
      });

      setLibsReady(true);
      setLibsLoading(false);
      return true;
    } catch (err: any) {
      setLibsError(err.message || 'Script resolution failed');
      setLibsLoading(false);
      return false;
    }
  };

  // Safe loading effect
  useEffect(() => {
    loadScripts();
    return () => {
      // Cleanup Webcams & loops on unmount
      stopPredictor();
    };
  }, []);

  // Simulator loop trigger
  useEffect(() => {
    if (useSimulator) {
      stopPredictor();
      
      const simClassNames = Object.keys(simValues);
      setClassLabels(simClassNames);
      
      // Auto mapping if classes didn't match
      if (simClassNames.includes('Idle') && simClassNames.includes('Jump') && simClassNames.includes('Crouch')) {
        onConfigChange({
          ...config,
          mappings: {
            jump: 'Jump',
            crouch: 'Crouch',
            neutral: 'Idle'
          }
        });
      } else if (simClassNames.includes('Neutral Face') && simClassNames.includes('Smile / Open Mouth') && simClassNames.includes('Frown / Wink')) {
        onConfigChange({
          ...config,
          mappings: {
            jump: 'Smile / Open Mouth',
            crouch: 'Frown / Wink',
            neutral: 'Neutral Face'
          }
        });
      }

      const interval = setInterval(() => {
        const simPreds: PredictionResult[] = Object.entries(simValues).map(([className, probability]) => ({
          className,
          probability: probability as number
        }));
        setPredictions(simPreds);
        evaluatePredictions(simPreds);
      }, 150);

      return () => clearInterval(interval);
    }
  }, [useSimulator, simValues, config.mappings, config.confidenceThreshold]);

  // Model loading handler
  const loadModel = async (url: string) => {
    if (!url) {
      setErrorMsg('Please input your exported Teachable Machine Share URL');
      return;
    }

    // Ensure scripts exist
    const ready = await loadScripts();
    if (!ready) return;

    setModelLoading(true);
    setErrorMsg(null);
    stopPredictor(); // stop previous instances

    try {
      // Standardize the URL directory
      const cleanUrl = url.trim().endsWith('/') ? url.trim() : url.trim() + '/';
      const modelJson = cleanUrl + 'model.json';
      const metadataJson = cleanUrl + 'metadata.json';

      const tmImage = (window as any).tmImage;
      const model = await tmImage.load(modelJson, metadataJson);
      
      modelRef.current = model;
      const labels = model.getClassLabels();
      setClassLabels(labels);

      // Attempt automatic initial mappings based on names
      const mappings = { ...config.mappings };
      labels.forEach((label: string) => {
        const lLower = label.toLowerCase();
        if (
          lLower.includes('jump') || 
          lLower.includes('up') || 
          lLower.includes('raise') || 
          lLower.includes('smile') || 
          lLower.includes('mouth') || 
          lLower.includes('open') || 
          lLower.includes('happy') || 
          lLower.includes('laugh') || 
          lLower.includes('teeth')
        ) {
          mappings.jump = label;
        } else if (
          lLower.includes('crouch') || 
          lLower.includes('down') || 
          lLower.includes('duck') || 
          lLower.includes('squat') || 
          lLower.includes('frown') || 
          lLower.includes('wink') || 
          lLower.includes('blink') || 
          lLower.includes('close') || 
          lLower.includes('squint') || 
          lLower.includes('sad') || 
          lLower.includes('angry')
        ) {
          mappings.crouch = label;
        } else if (
          lLower.includes('idle') || 
          lLower.includes('neutral') || 
          lLower.includes('stand') || 
          lLower.includes('run') || 
          lLower.includes('face') || 
          lLower.includes('normal') || 
          lLower.includes('straight')
        ) {
          mappings.neutral = label;
        }
      });

      // Update Parent settings
      onConfigChange({
        ...config,
        modelUrl: url,
        isModelLoaded: true,
        mappings
      });

      setUseSimulator(false); // turn off simulator
      
      // Attempt camera launch
      await startWebcam(model);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to load Teachable Machine Model. Double-check your URL. Make sure you published/uploaded your model on the Teachable Machine UI!');
      onConfigChange({ ...config, isModelLoaded: false });
    } finally {
      setModelLoading(false);
    }
  };

  // Webcam stream launch
  const startWebcam = async (loadedModel = modelRef.current) => {
    if (!loadedModel) return;
    setErrorMsg(null);

    try {
      const tmImage = (window as any).tmImage;
      
      // Setup webcam (200x200 works perfect, keeping memory overhead small)
      const webcam = new tmImage.Webcam(220, 220, true); // width, height, flip
      await webcam.setup(); // Ask for camera permissions
      await webcam.play();
      webcamRef.current = webcam;

      // Clean webcam element holder
      if (webcamContainerRef.current) {
        webcamContainerRef.current.innerHTML = '';
        webcam.canvas.style.transform = 'scaleX(-1)'; // correct preview mirror
        webcam.canvas.className = "w-full h-full object-cover rounded-lg scale-x-[-1] border-2 border-slate-700 shadow-inner";
        webcamContainerRef.current.appendChild(webcam.canvas);
      }

      onConfigChange({
        ...config,
        isWebcamActive: true
      });

      // Start predicting loop
      startPredicting();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Webcam access was denied or failed to initiate. Please grant page camera permissions and try again.');
      onConfigChange({ ...config, isWebcamActive: false });
    }
  };

  // Predict frames loop
  const startPredicting = () => {
    const loop = async () => {
      const model = modelRef.current;
      const webcam = webcamRef.current;

      if (model && webcam && webcam.canvas) {
        webcam.update(); // draw next frame
        
        try {
          const rawPreds = await model.predict(webcam.canvas);
          const results: PredictionResult[] = rawPreds.map((p: any) => ({
            className: p.className,
            probability: p.probability
          }));

          setPredictions(results);
          evaluatePredictions(results);
        } catch (e) {
          console.error(e);
        }
      }
      loopRef.current = requestAnimationFrame(loop);
    };

    loopRef.current = requestAnimationFrame(loop);
  };

  // Mapping engine triggers the action
  const evaluatePredictions = (preds: PredictionResult[]) => {
    let triggered: TMAction | 'neutral' = 'neutral';
    let maxProb = 0;

    preds.forEach(p => {
      // Check which action this class matches
      if (p.className === config.mappings.jump && p.probability >= config.confidenceThreshold) {
        if (p.probability > maxProb) {
          triggered = 'jump';
          maxProb = p.probability;
        }
      } else if (p.className === config.mappings.crouch && p.probability >= config.confidenceThreshold) {
        if (p.probability > maxProb) {
          triggered = 'crouch';
          maxProb = p.probability;
        }
      } else if (p.className === config.mappings.neutral && p.probability >= config.confidenceThreshold) {
        if (p.probability > maxProb) {
          // Keep neutral/idle if higher prob
          triggered = 'neutral';
          maxProb = p.probability;
        }
      }
    });

    if (triggered !== activeAction) {
      setActiveAction(triggered);
      if (triggered !== 'neutral') {
        onActionTriggered(triggered);
      } else {
        // Triggers standing straight
        onActionTriggered('neutral');
      }
    }
  };

  const stopPredictor = () => {
    if (loopRef.current) {
      cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    }
    if (webcamRef.current) {
      try {
        webcamRef.current.stop();
      } catch (e) {}
      webcamRef.current = null;
    }
    if (webcamContainerRef.current) {
      webcamContainerRef.current.innerHTML = '';
    }
    onConfigChange({ ...config, isWebcamActive: false });
    setActiveAction('neutral');
  };

  const handleMappingChange = (action: TMAction, value: string) => {
    onConfigChange({
      ...config,
      mappings: {
        ...config.mappings,
        [action]: value
      }
    });
  };

  // Mock Simulator triggers
  const setSimConfidence = (pName: string, val: number) => {
    const updated = { ...simValues };
    
    // Distribute other values dynamically
    const rest = Object.keys(updated).filter(k => k !== pName);
    updated[pName] = val;
    
    const remainder = 1 - val;
    if (rest.length === 2) {
      updated[rest[0]] = remainder * 0.5;
      updated[rest[1]] = remainder * 0.5;
    } else if (rest.length === 1) {
      updated[rest[0]] = remainder;
    }

    setSimValues(updated);
  };

  return (
    <div className="w-full flex flex-col gap-6 p-5 rounded-xl bg-black/60 backdrop-blur-md border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]" id="tm-controller">
      {/* Dynamic script states */}
      {libsLoading && (
        <div className="flex items-center gap-2 p-3 text-xs bg-slate-950/80 rounded border border-cyan-500/20 font-mono text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.1)] animate-pulse">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Synchronizing Neural Modules (TFJS)...</span>
        </div>
      )}

      {libsError && (
        <div className="flex items-start gap-3 p-3 text-xs bg-rose-950/20 border border-rose-500/30 rounded font-mono text-rose-300">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <div>
            <div className="font-bold text-rose-400">Module Sync Failure</div>
            <div>{libsError}. Try refreshing or check internet connection.</div>
          </div>
        </div>
      )}

      {/* Controller Section header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-press-start text-cyan-400 flex items-center gap-2 tracking-wider">
            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
            MOTION DETECTOR SETUP
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setUseSimulator(!useSimulator);
                setErrorMsg(null);
              }}
              className={`px-3 py-1 font-mono text-xs rounded border transition-all cursor-pointer ${
                useSimulator 
                  ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]' 
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {useSimulator ? '🔌 USING SIMULATOR' : '🎮 INJECT SIMULATOR'}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-400 font-mono mt-1">
          Hook up standard Teachable Machine output to move the character via webcam.
        </p>
      </div>

      {/* Model Input Matrix */}
      <div className="flex flex-col gap-3">
        <label className="text-xs font-bold text-slate-350 font-mono">Teachable Machine Model URL:</label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="https://teachablemachine.withgoogle.com/models/mY_m0deL/"
            value={config.modelUrl}
            onChange={(e) => onConfigChange({ ...config, modelUrl: e.target.value })}
            className="flex-1 px-3 py-2 bg-slate-950 text-white border border-slate-800 rounded-lg focus:outline-none focus:border-cyan-500 font-mono text-xs placeholder:text-slate-650"
          />
          <button
            onClick={() => loadModel(config.modelUrl)}
            disabled={modelLoading || !libsReady}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-900 font-mono text-xs text-white font-bold cursor-pointer flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all"
          >
            {modelLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            CONNECT
          </button>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2.5 p-3 rounded-md bg-rose-955 border border-rose-900 text-rose-300 text-xs font-mono">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Grid: Camera Preview on Left, Settings Mapping on Right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Left: Camera Feed Viewport */}
        <div className="flex flex-col gap-2 bg-slate-950/70 p-4 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-300 font-mono flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${config.isWebcamActive || useSimulator ? 'bg-emerald-500 animate-ping' : 'bg-slate-650'}`}></span>
              LIVE TRACKING DISPLAY
            </span>
            <div className="flex gap-2">
              {config.isModelLoaded && !useSimulator && (
                <button
                  onClick={config.isWebcamActive ? stopPredictor : () => startWebcam()}
                  className={`p-1.5 rounded cursor-pointer transition-colors ${
                    config.isWebcamActive 
                      ? 'bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900' 
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900'
                  }`}
                  title={config.isWebcamActive ? "Shut down camera" : "Activate camera"}
                >
                  {config.isWebcamActive ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          {useSimulator && (
            <div className="flex flex-col gap-1.5 p-2 rounded bg-cyan-950/20 border border-cyan-500/10 font-mono text-[11px] mb-1">
              <span className="text-cyan-400 font-bold">🎯 CHOOSE TRAINING SIMULATION STYLE:</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => changeSimulatorPreset('pose')}
                  className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all border ${
                    simulatorPreset === 'pose' 
                      ? 'bg-cyan-600 text-white border-cyan-400 font-extrabold shadow-[0_0_8px_rgba(6,182,212,0.3)]' 
                      : 'bg-black/40 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  🚶 BODY POSTURES
                </button>
                <button
                  type="button"
                  onClick={() => changeSimulatorPreset('expression')}
                  className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all border ${
                    simulatorPreset === 'expression' 
                      ? 'bg-cyan-600 text-white border-cyan-400 font-extrabold shadow-[0_0_8px_rgba(6,182,212,0.3)]' 
                      : 'bg-black/40 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  😀 EXPRESSIONS
                </button>
              </div>
            </div>
          )}

          <div className="relative w-full aspect-square max-w-[220px] mx-auto flex items-center justify-center bg-slate-950 rounded-lg border-2 border-slate-800 overflow-hidden shadow-inner">
            {/* Webcam canvas container */}
            <div ref={webcamContainerRef} className="w-full h-full" />

            {/* CRT Phosphor Scan overlay filter effect */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(rgba(18,24,38,0)_40%,rgba(0,0,0,0.5)_100%)] opacity-80" />

            {/* In case webcam is off */}
            {!config.isWebcamActive && !useSimulator && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 gap-1 p-3 text-center">
                <Video className="w-10 h-10 mb-1 opacity-60" />
                <span className="text-xs font-mono">Camera Feed Idle</span>
                <span className="text-[10px] font-mono text-slate-500">Connect a model to activate</span>
              </div>
            )}

            {/* Simulated target feed for offline mode */}
            {useSimulator && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-amber-500/90 bg-amber-970/10 p-4 text-center">
                <Sparkles className="w-10 h-10 mb-2 animate-bounce opacity-70" />
                <span className="text-xs font-mono font-bold">Simulator Feed Active</span>
                <span className="text-[9px] font-mono mt-1 text-slate-400">Drag class sliders below to test!</span>
              </div>
            )}

            {/* Highlighting detected active action directly inside viewport */}
            {activeAction !== 'neutral' && (
              <div className="absolute bottom-2 left-2 right-2 px-2 py-1 bg-black/85 backdrop-blur-md rounded border border-orange-500 text-center select-none animate-bounce font-press-start text-[8px] text-orange-400 shadow-lg">
                🚀 {activeAction.toUpperCase()} TRIGGERED!
              </div>
            )}
          </div>
        </div>

        {/* Right: Class Mapper Selection Settings */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Settings className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-bold text-slate-300 font-mono">CLASS AUTO-MAPPER</h3>
          </div>

          {!config.isModelLoaded && !useSimulator ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-5 rounded-lg border border-dashed border-slate-800 bg-slate-950/20 text-slate-500">
              <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
              <span className="text-xs font-mono">No model loaded. Connect your model URL or click "INJECT SIMULATOR" to assign actions.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-4 font-mono text-xs">
              
              {/* Jump Class */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>1. JUMP ACTION:</span>
                  <span className="text-emerald-400 text-[10px] flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3 h-3" /> MAPS TO
                  </span>
                </div>
                <select
                  value={config.mappings.jump}
                  onChange={(e) => handleMappingChange('jump', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-black/80 text-white border border-slate-800 rounded font-semibold text-xs focus:outline-none focus:border-cyan-400"
                >
                  <option value="">-- Choose Class --</option>
                  {classLabels.map(lbl => (
                    <option key={lbl} value={lbl}>{lbl}</option>
                  ))}
                </select>
              </div>

              {/* Crouch Class */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>2. CROUCH ACTION:</span>
                  <span className="text-cyan-450 text-[10px] flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3 h-3 text-cyan-450" /> MAPS TO
                  </span>
                </div>
                <select
                  value={config.mappings.crouch}
                  onChange={(e) => handleMappingChange('crouch', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-black/80 text-white border border-slate-800 rounded font-semibold text-xs focus:outline-none focus:border-cyan-400"
                >
                  <option value="">-- Choose Class --</option>
                  {classLabels.map(lbl => (
                    <option key={lbl} value={lbl}>{lbl}</option>
                  ))}
                </select>
              </div>

              {/* Neutral Class */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>3. RUN / NEUTRAL ACTION:</span>
                  <span className="text-slate-400 text-[10px] flex items-center gap-1">
                    (Standard state)
                  </span>
                </div>
                <select
                  value={config.mappings.neutral}
                  onChange={(e) => handleMappingChange('neutral', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-black/80 text-slate-350 border border-slate-800 rounded text-xs focus:outline-none focus:border-cyan-450"
                >
                  <option value="">-- Choose Class --</option>
                  {classLabels.map(lbl => (
                    <option key={lbl} value={lbl}>{lbl}</option>
                  ))}
                </select>
              </div>

              {/* Threshold sensitivity */}
              <div className="flex flex-col gap-1.5 mt-2 bg-slate-950 p-3 rounded-lg border border-slate-900">
                <div className="flex justify-between font-bold text-slate-300 text-[11px]">
                  <span>TRIGGER SENSITIVITY:</span>
                  <span className="text-cyan-400 font-mono">{Math.round(config.confidenceThreshold * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.40"
                  max="0.98"
                  step="0.02"
                  value={config.confidenceThreshold}
                  onChange={(e) => onConfigChange({ ...config, confidenceThreshold: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <span className="text-[10px] text-slate-500 leading-tight">
                  High sensitivity requires higher pose precision to avoid accidental jumps.
                </span>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Under Section predictions confidence status list (Vertical Bar Chart Metrics) */}
      {(predictions.length > 0) && (
        <div className="flex flex-col gap-3 p-4 bg-slate-950 rounded-xl border border-slate-850 font-mono text-xs">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
            📊 MODEL CLASSIFICATION PROBABILITIES (LIVE):
          </span>
          <div className="flex flex-col gap-3 py-1">
            {predictions.map((p) => {
              // Highlight the bar if active
              const isMatchJump = p.className === config.mappings.jump;
              const isMatchCrouch = p.className === config.mappings.crouch;
              const isMetThreshold = p.probability >= config.confidenceThreshold;

              let barColor = 'bg-slate-800';
              if (isMatchJump && isMetThreshold) barColor = 'bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.6)]';
              else if (isMatchCrouch && isMetThreshold) barColor = 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]';
              else if (p.probability >= 0.5) barColor = 'bg-cyan-550/50';

              const labelIcon = isMatchJump ? '🦘 [Jump]' : (isMatchCrouch ? '🧘 [Crouch]' : '🏃 [Neutral]');

              return (
                <div key={p.className} className="flex flex-col gap-1">
                  <div className="flex justify-between text-slate-300 text-[11px]">
                    <span className="font-semibold flex items-center gap-1.5">
                      <span>{p.className}</span>
                      <span className="text-slate-500 text-[10px]">{labelIcon}</span>
                    </span>
                    <span className="font-bold text-white font-mono">{Math.round(p.probability * 100)}%</span>
                  </div>
                  
                  {/* Visual Confidence Bar */}
                  <div className="relative w-full h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div 
                      className={`h-full rounded-full transition-all duration-75 ${barColor}`}
                      style={{ width: `${p.probability * 100}%` }}
                    />
                    {/* Confidence Threshold horizontal line */}
                    <div 
                      className="absolute top-0 bottom-0 border-l border-dashed border-rose-500/60 z-10"
                      style={{ left: `${config.confidenceThreshold * 100}%` }}
                      title="Confidence Trigger Level"
                    />
                  </div>

                  {/* Simulator slide-inputs */}
                  {useSimulator && (
                    <div className="flex items-center gap-2 mt-1 px-1">
                      <span className="text-[10px] text-slate-500">Inject:</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={p.probability}
                        onChange={(e) => setSimConfidence(p.className, parseFloat(e.target.value))}
                        className="w-24 h-1 bg-slate-800 roundedappearance-none cursor-pointer accent-orange-500"
                      />
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
