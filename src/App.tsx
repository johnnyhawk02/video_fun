import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, FolderOpen, Sun, Aperture, Droplet, Repeat, Eraser, Bone, FlipHorizontal, FlipVertical, Volume2, Waves, Github } from 'lucide-react';

export default function App() {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [brightness, setBrightness] = useState(100);
  const [xray, setXray] = useState(false);
  const [mirror, setMirror] = useState<'none' | 'v' | 'h'>('none');
  const [volume, setVolume] = useState(100);
  const [reverb, setReverb] = useState(0);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const hasInitAudioRef = useRef(false);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);

  const videoRef2 = useRef<HTMLVideoElement>(null);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLInputElement>(null);
  const reqRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      initAudioContext();
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setIsPlaying(true);
      setSpeed(1);
      setLoopA(null);
      setLoopB(null);
      setTimeout(() => {
        if (videoRef.current) {
          (videoRef.current as any).preservesPitch = false;
        }
      }, 0);
    }
  };

  // Setup loop for negative playback rate scrubbing & AB looping
  const loop = (time: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = time;
    const dt = time - lastTimeRef.current;
    lastTimeRef.current = time;
    
    if (videoRef.current) {
      const vid = videoRef.current;
      const startBound = loopA !== null ? loopA : 0;
      const endBound = loopB !== null ? loopB : (vid.duration || 0);

      // Handle forward native playback looping
      if (isPlaying && speed > 0 && loopB !== null) {
        if (vid.currentTime >= endBound) {
          vid.currentTime = startBound;
        }
      }

      // Handle negative manual playback & looping
      // (Removed as requested via smooth 0.1 slider)
      
      // Sync secondary video
      if (videoRef2.current) {
         if (Math.abs(videoRef2.current.currentTime - vid.currentTime) > 0.05) {
            videoRef2.current.currentTime = vid.currentTime;
         }
      }

      // Update progress slider
      if (progressRef.current && vid.duration) {
        const pct = (vid.currentTime / vid.duration) * 100;
        progressRef.current.value = String(pct);
        progressRef.current.style.setProperty('--progress', `${pct}%`);
      }
    }
    
    reqRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    reqRef.current = requestAnimationFrame(loop);
    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [isPlaying, speed, loopA, loopB]);

  useEffect(() => {
    if (mirror !== 'none' && videoRef.current && videoRef2.current) {
      videoRef2.current.currentTime = videoRef.current.currentTime;
    }
  }, [mirror]);

  const initAudioContext = () => {
    if (hasInitAudioRef.current || !videoRef.current) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaElementSource(videoRef.current);
      const convolver = ctx.createConvolver();
      const dryGain = ctx.createGain();
      const wetGain = ctx.createGain();

      dryGainRef.current = dryGain;
      wetGainRef.current = wetGain;

      // Generate algorithmic impulse response
      const length = ctx.sampleRate * 2.5; 
      const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const channelData = impulse.getChannelData(c);
        for (let i = 0; i < length; i++) {
          channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3.0);
        }
      }
      convolver.buffer = impulse;

      source.connect(dryGain);
      dryGain.connect(ctx.destination);

      source.connect(convolver);
      convolver.connect(wetGain);
      wetGain.connect(ctx.destination);

      hasInitAudioRef.current = true;
      
      if (videoRef.current) videoRef.current.volume = volume / 100;
      const normalizedReverb = reverb / 100;
      wetGainRef.current.gain.value = normalizedReverb * 1.5;
      dryGainRef.current.gain.value = 1 - (normalizedReverb * 0.3);

    } catch (e) {
      console.error("Audio Context Init Failed", e);
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume / 100;
    }
  }, [volume, videoSrc]);

  useEffect(() => {
    if (!dryGainRef.current || !wetGainRef.current) return;
    const normalized = reverb / 100;
    wetGainRef.current.gain.value = normalized * 1.5;
    dryGainRef.current.gain.value = 1 - (normalized * 0.3);
  }, [reverb]);

  // Sync native playback state
  useEffect(() => {
    const videos = [videoRef.current, videoRef2.current].filter(Boolean) as HTMLVideoElement[];

    videos.forEach(video => {
      video.preservesPitch = false;
      (video as any).webkitPreservesPitch = false;
      (video as any).mozPreservesPitch = false;
      
      if (isPlaying) {
        video.playbackRate = speed;
        video.play().catch(e => console.error("Play failed:", e));
      } else {
        video.pause();
      }
    });
  }, [isPlaying, speed, mirror]);

  const togglePlay = () => {
    initAudioContext();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    setIsPlaying(!isPlaying);
  };

  const handleVideoEnded = () => {
    if (videoRef.current) {
      // loop natively for forward play
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(e => console.error(e));
    }
  };

  if (!videoSrc) {
    return (
      <div className="min-h-screen bg-pink-100 flex flex-col items-center justify-center p-8 relative">
        <div className="bg-white rounded-3xl p-12 shadow-2xl text-center max-w-lg w-full flex flex-col items-center gap-8">
          <div className="w-32 h-32 bg-pink-500 rounded-full flex items-center justify-center shadow-lg text-white mb-4 animate-bounce">
            <Play size={64} fill="currentColor" />
          </div>
          <h1 className="text-4xl font-bold text-gray-800">Video Player</h1>
          <p className="text-xl text-gray-600 font-medium">Let's pick a fun video to play!</p>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 bg-pink-500 hover:bg-pink-600 active:scale-95 transition-all text-white text-2xl font-bold py-6 px-12 rounded-full shadow-xl flex items-center justify-center gap-4"
          >
            <FolderOpen size={32} />
            Choose a Video
          </button>
          <input 
            type="file" 
            accept="video/*" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileChange}
          />
        </div>
      </div>
    );
  }

  const filters = `hue-rotate(${hue}deg) saturate(${saturation}%) brightness(${brightness}%) ${xray ? 'invert(100%) grayscale(100%) contrast(200%)' : ''}`;

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col overflow-hidden overscroll-none text-white font-sans select-none">
      {/* Top Bar - Hidden file input trigger */}
      <div className="absolute top-4 left-4 z-50">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="bg-white/20 backdrop-blur-md p-4 rounded-full text-white shadow-lg active:scale-90 transition-transform"
        >
          <FolderOpen size={32} />
        </button>
        <input 
          type="file" 
          accept="video/*" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileChange}
        />
      </div>

      {/* Main Video Area */}
      <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden" onClick={togglePlay}>
        <video 
          ref={videoRef}
          src={videoSrc}
          className="absolute w-full h-full object-contain cursor-pointer"
          style={{ filter: filters, clipPath: mirror === 'v' ? 'inset(0 50% 0 0)' : mirror === 'h' ? 'inset(0 0 50% 0)' : 'none' }}
          onEnded={handleVideoEnded}
          playsInline
        />
        {mirror !== 'none' && (
          <video 
            ref={videoRef2}
            src={videoSrc}
            muted
            className="absolute w-full h-full object-contain pointer-events-none cursor-pointer"
            style={{ 
              filter: filters, 
              clipPath: mirror === 'v' ? 'inset(0 50% 0 0)' : 'inset(0 0 50% 0)',
              transform: mirror === 'v' ? 'scaleX(-1)' : 'scaleY(-1)'
            }}
            playsInline
          />
        )}
        
        {/* Play Position Slider container placed explicitly over the video bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" onClick={(e) => e.stopPropagation()}>
          <input 
            ref={progressRef}
            type="range" 
            min="0" 
            max="100" 
            step="0.01"
            defaultValue="0"
            onInput={(e) => {
               if (videoRef.current && videoRef.current.duration) {
                  const targetTime = (parseFloat((e.target as HTMLInputElement).value) / 100) * videoRef.current.duration;
                  videoRef.current.currentTime = targetTime;
                  if (videoRef2.current) {
                    videoRef2.current.currentTime = targetTime;
                  }
               }
            }}
            className="pos-track w-full h-12 rounded-full cursor-pointer accent-pink-500 touch-pan-x"
          />
        </div>
      </div>

      {/* Control Panel */}
      <div className="bg-gray-800 rounded-t-[3rem] p-6 pb-12 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col gap-6 z-10 w-full md:p-8">
        
        {/* Play/Pause Button Area */}
        <div className="flex justify-center -mt-16 mb-4">
          <button 
            onClick={togglePlay}
            className="w-32 h-32 bg-pink-500 text-white rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(236,72,153,0.6)] active:scale-90 transition-transform border-4 border-white/20"
          >
            {isPlaying ? <Pause size={64} fill="currentColor" /> : <Play size={64} fill="currentColor" className="ml-4" />}
          </button>
        </div>

        <div className="max-w-4xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
          <div className="flex flex-col gap-6">
            {/* Speed Slider */}
            <div className="flex flex-col gap-4 bg-gray-700/50 p-6 rounded-3xl">
              <div className="flex justify-between items-center text-xl font-bold">
                <span>Speed: {speed.toFixed(2)}X</span>
              </div>
              <div className="flex gap-4 items-center">
                <span className="text-2xl font-bold text-blue-400">0</span>
                <input 
                  type="range" 
                  min="0.1" 
                  max="2" 
                  step="0.01"
                  value={speed}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setSpeed(val);
                  }}
                  className="w-full h-8 bg-gray-600 rounded-full appearance-none cursor-pointer accent-pink-500"
                />
                <span className="text-2xl font-bold text-pink-400">+2</span>
              </div>
            </div>

            {/* AB Loop Points */}
            <div className="flex flex-col gap-4 bg-gray-700/50 p-6 rounded-3xl">
              <div className="flex justify-between items-center text-xl font-bold">
                <span className="flex items-center gap-2"><Repeat size={24}/> Loop Clip</span>
                {(loopA !== null || loopB !== null) && (
                  <button onClick={() => { setLoopA(null); setLoopB(null); }} className="text-red-400 p-2 bg-gray-800 rounded-full active:scale-95">
                    <Eraser size={24} />
                  </button>
                )}
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setLoopA(videoRef.current?.currentTime || 0)}
                  className={`flex-1 py-4 text-2xl font-bold rounded-2xl active:scale-95 transition-all ${loopA !== null ? 'bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'bg-gray-600 text-gray-300'}`}
                >
                  Set A
                </button>
                <button 
                  onClick={() => setLoopB(videoRef.current?.currentTime || 0)}
                  className={`flex-1 py-4 text-2xl font-bold rounded-2xl active:scale-95 transition-all ${loopB !== null ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-gray-600 text-gray-300'}`}
                >
                  Set B
                </button>
              </div>
            </div>

            {/* Audio Controls */}
            <div className="flex flex-col gap-4 bg-gray-700/50 p-6 rounded-3xl">
              <div className="flex items-center text-xl font-bold">
                <span>Audio</span>
              </div>
              <div className="flex items-center gap-4">
                <Volume2 className="text-white shrink-0" size={32} />
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={volume}
                  onChange={(e) => setVolume(parseInt(e.target.value))}
                  className="w-full h-8 bg-gray-600 rounded-full appearance-none cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-4">
                <Waves className="text-cyan-400 shrink-0" size={32} />
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={reverb}
                  onChange={(e) => setReverb(parseInt(e.target.value))}
                  className="w-full h-8 bg-gray-600 rounded-full appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="flex flex-col gap-6">
            {/* Color Sliders */}
            <div className="flex flex-col gap-5 bg-gray-700/50 p-6 rounded-3xl">
              
              <div className="flex items-center gap-4">
                <Aperture className="text-yellow-400 shrink-0" size={32} />
                <input 
                  type="range" 
                  min="0" 
                  max="360" 
                  value={hue}
                  onChange={(e) => setHue(parseInt(e.target.value))}
                  className="hue-track w-full h-8 rounded-full cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-4">
                <Droplet className="text-blue-400 shrink-0" size={32} />
                <input 
                  type="range" 
                  min="0" 
                  max="200" 
                  value={saturation}
                  onChange={(e) => setSaturation(parseInt(e.target.value))}
                  className="sat-track w-full h-8 rounded-full cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-4">
                <Sun className="text-orange-400 shrink-0" size={32} />
                <input 
                  type="range" 
                  min="50" 
                  max="150" 
                  value={brightness}
                  onChange={(e) => setBrightness(parseInt(e.target.value))}
                  className="bright-track w-full h-8 rounded-full cursor-pointer"
                />
              </div>

            </div>

            {/* Fun FX */}
            <div className="flex flex-col gap-4 bg-gray-700/50 p-6 rounded-3xl">
              <div className="flex items-center text-xl font-bold">
                <span>Fun Effects</span>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setXray(!xray)}
                  className={`flex-1 py-3 text-sm md:text-lg font-bold flex flex-col items-center justify-center gap-1 rounded-2xl active:scale-95 transition-all ${xray ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-gray-600 text-gray-300'}`}
                >
                  <Bone size={24} /> X-Ray
                </button>
                <button 
                  onClick={() => setMirror(mirror === 'v' ? 'none' : 'v')}
                  className={`flex-1 py-3 text-sm md:text-lg font-bold flex flex-col items-center justify-center gap-1 rounded-2xl active:scale-95 transition-all ${mirror === 'v' ? 'bg-teal-500 text-white shadow-[0_0_15px_rgba(20,184,166,0.5)]' : 'bg-gray-600 text-gray-300'}`}
                >
                  <FlipHorizontal size={24} /> Mirror V
                </button>
                <button 
                  onClick={() => setMirror(mirror === 'h' ? 'none' : 'h')}
                  className={`flex-1 py-3 text-sm md:text-lg font-bold flex flex-col items-center justify-center gap-1 rounded-2xl active:scale-95 transition-all ${mirror === 'h' ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-gray-600 text-gray-300'}`}
                >
                  <FlipVertical size={24} /> Mirror H
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
