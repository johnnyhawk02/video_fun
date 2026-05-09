import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, FolderOpen, Aperture, Bone, FlipHorizontal, FlipVertical, Volume2 } from 'lucide-react';

const LandscapeWarning = () => (
  <div className="hidden [@media(hover:none)_and_(orientation:landscape)]:flex max-[800px]:landscape:flex fixed inset-0 z-[9999] bg-gray-900 flex-col items-center justify-center p-8 text-center overscroll-none touch-none">
    <div className="w-24 h-24 mb-8 text-pink-500 animate-pulse">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full rotate-[-90deg]">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <path d="M12 18h.01" />
      </svg>
    </div>
    <h2 className="text-3xl font-bold text-white mb-4">Portrait Mode Only</h2>
    <p className="text-xl text-gray-400">Please rotate your device to portrait orientation.</p>
  </div>
);

export default function App() {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [hue, setHue] = useState(0);
  const [xray, setXray] = useState(false);
  const [mirror, setMirror] = useState<'none' | 'v' | 'h'>('none');
  const [volume, setVolume] = useState(100);
  
  const videoRef2 = useRef<HTMLVideoElement>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLInputElement>(null);
  const reqRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setIsPlaying(false); // don't auto-play until user clicks
      setSpeed(1);
    }
  };

  // Setup loop for negative playback rate scrubbing & AB looping
  const loop = (time: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = time;
    const dt = time - lastTimeRef.current;
    lastTimeRef.current = time;
    
    if (videoRef.current) {
      const vid = videoRef.current;
      
      // Sync secondary video
      if (videoRef2.current && !videoRef2.current.seeking) {
         if (Math.abs(videoRef2.current.currentTime - vid.currentTime) > 0.1) {
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
  }, [isPlaying, speed]);

  useEffect(() => {
    if (mirror !== 'none' && videoRef.current && videoRef2.current) {
      videoRef2.current.currentTime = videoRef.current.currentTime;
    }
  }, [mirror]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume / 100;
  }, [volume]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
    if (videoRef2.current) videoRef2.current.playbackRate = speed;
  }, [speed]);

  // Sync native playback state
  useEffect(() => {
    const mediaElements = [videoRef.current, videoRef2.current].filter(Boolean) as HTMLMediaElement[];

    mediaElements.forEach(media => {
      media.muted = media === videoRef2.current; // Mute secondary video
      media.preservesPitch = false;
      (media as any).webkitPreservesPitch = false;
      (media as any).mozPreservesPitch = false;
      
      if (isPlaying) {
        media.playbackRate = speed;
        // ensure sync
        if (media === videoRef2.current && videoRef.current) {
           media.currentTime = videoRef.current.currentTime;
        }
        media.play().catch(e => console.error("Play failed:", e));
      } else {
        media.pause();
      }
    });
  }, [isPlaying, speed, mirror]);

  const togglePlay = () => {
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
        <LandscapeWarning />
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

  const filters = `hue-rotate(${hue}deg) ${xray ? 'invert(100%) grayscale(100%) contrast(200%)' : ''}`;

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col overflow-hidden overscroll-none text-white font-sans select-none">
      <LandscapeWarning />
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
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20">
            <div className="w-24 h-24 bg-pink-500/80 rounded-full flex items-center justify-center text-white shadow-2xl backdrop-blur-sm">
              <Play size={48} fill="currentColor" className="ml-2" />
            </div>
          </div>
        )}
      </div>

      {/* Play Position Slider container placed under the video */}
      <div className="w-full px-6 py-4 bg-gray-900 z-20 relative border-t border-gray-800">
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

      {/* Control Panel */}
      <div className="bg-gray-800 rounded-t-3xl p-4 pb-8 mt-2 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col gap-4 z-10 w-full md:p-6 relative max-h-[50vh] overflow-y-auto">
        <div className="max-w-4xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div className="flex flex-col gap-4">
            {/* Speed Slider */}
            <div className="flex flex-col gap-2 bg-gray-700/50 p-4 rounded-2xl">
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Speed: {speed.toFixed(2)}X</span>
              </div>
              <div className="flex gap-4 items-center">
                <span className="text-xl font-bold text-blue-400">0</span>
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
                  className="w-full h-6 bg-gray-600 rounded-full appearance-none cursor-pointer accent-pink-500"
                />
                <span className="text-xl font-bold text-pink-400">+2</span>
              </div>
            </div>

            {/* Audio Controls */}
            <div className="flex flex-col gap-2 bg-gray-700/50 p-4 rounded-2xl">
              <div className="flex items-center gap-4">
                <Volume2 className="text-white shrink-0" size={24} />
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={volume}
                  onChange={(e) => setVolume(parseInt(e.target.value))}
                  className="w-full h-6 bg-gray-600 rounded-full appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="flex flex-col gap-4">
            {/* Color Sliders */}
            <div className="flex flex-col gap-3 bg-gray-700/50 p-4 rounded-2xl">
              
              <div className="flex items-center gap-4">
                <Aperture className="text-yellow-400 shrink-0" size={24} />
                <input 
                  type="range" 
                  min="0" 
                  max="360" 
                  value={hue}
                  onChange={(e) => setHue(parseInt(e.target.value))}
                  className="hue-track w-full h-6 rounded-full cursor-pointer"
                />
              </div>

            </div>

            {/* Fun FX */}
            <div className="flex flex-col gap-2 bg-gray-700/50 p-4 rounded-2xl">
              <div className="flex gap-2">
                <button 
                  onClick={() => setXray(!xray)}
                  className={`flex-1 py-2 text-xs md:text-sm font-bold flex flex-col items-center justify-center gap-1 rounded-xl active:scale-95 transition-all ${xray ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-gray-600 text-gray-300'}`}
                >
                  <Bone size={20} /> X-Ray
                </button>
                <button 
                  onClick={() => setMirror(mirror === 'v' ? 'none' : 'v')}
                  className={`flex-1 py-2 text-xs md:text-sm font-bold flex flex-col items-center justify-center gap-1 rounded-xl active:scale-95 transition-all ${mirror === 'v' ? 'bg-teal-500 text-white shadow-[0_0_15px_rgba(20,184,166,0.5)]' : 'bg-gray-600 text-gray-300'}`}
                >
                  <FlipHorizontal size={20} /> Mirror V
                </button>
                <button 
                  onClick={() => setMirror(mirror === 'h' ? 'none' : 'h')}
                  className={`flex-1 py-2 text-xs md:text-sm font-bold flex flex-col items-center justify-center gap-1 rounded-xl active:scale-95 transition-all ${mirror === 'h' ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-gray-600 text-gray-300'}`}
                >
                  <FlipVertical size={20} /> Mirror H
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
