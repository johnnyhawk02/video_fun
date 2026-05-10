import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';

interface VisualSynthProps {
  analyser: AnalyserNode | null;
  videoElement: HTMLVideoElement | null;
  brightness?: number;
  lightBrightness?: number;
  roughness?: number;
  metalness?: number;
}

const AudioReactVideoSphere = ({ 
  analyser, 
  videoElement,
  brightness = 1,
  roughness = 0.2,
  metalness = 0.8
}: { 
  analyser: AnalyserNode | null;
  videoElement: HTMLVideoElement | null;
  brightness?: number;
  roughness?: number;
  metalness?: number;
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const dataArray = useRef(new Uint8Array(128)); 
  const [videoTexture, setVideoTexture] = useState<THREE.VideoTexture | null>(null);
  const lastVideoTime = useRef(0);
  const joltAmount = useRef(0);

  useEffect(() => {
    if (videoElement) {
      const texture = new THREE.VideoTexture(videoElement);
      texture.colorSpace = THREE.SRGBColorSpace;
      setVideoTexture(texture);
    }
  }, [videoElement]);

  const numSpheres = 15;
  const spheresData = useMemo(() => {
    return Array.from({ length: numSpheres }).map(() => ({
      position: new THREE.Vector3(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 20
      ),
      baseScale: Math.random() * 2 + 1,
      rotationSpeed: new THREE.Vector3(
        Math.random() * 0.02 - 0.01,
        Math.random() * 0.02 - 0.01,
        Math.random() * 0.02 - 0.01
      ),
      bandIndex: Math.floor(Math.random() * 3) // 0: bass, 1: mid, 2: treble
    }));
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    
    let bass = 0, mid = 0, treble = 0;
    
    if (analyser) {
      analyser.getByteFrequencyData(dataArray.current);
      
      let bassSum = 0, midSum = 0, trebleSum = 0;
      for (let i = 0; i < 10; i++) bassSum += dataArray.current[i];
      for (let i = 10; i < 40; i++) midSum += dataArray.current[i];
      for (let i = 40; i < 120; i++) trebleSum += dataArray.current[i];
      
      bass = bassSum / 10 / 255;
      mid = midSum / 30 / 255;
      treble = trebleSum / 80 / 255;
    }

    const t = state.clock.elapsedTime;
    
    if (videoElement) {
      const timeDiff = Math.abs(videoElement.currentTime - lastVideoTime.current);
      if (timeDiff > 0.2) {
        joltAmount.current = 1.0;
      }
      lastVideoTime.current = videoElement.currentTime;
    }
    joltAmount.current *= 0.92; // decay jolt
    
    groupRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const data = spheresData[i];
      
      mesh.rotation.x = t * data.rotationSpeed.x * 60;
      mesh.rotation.y = t * data.rotationSpeed.y * 60;
      mesh.rotation.z = t * data.rotationSpeed.z * 60;
      
      const joltX = (Math.random() - 0.5) * 10 * joltAmount.current;
      const joltY = (Math.random() - 0.5) * 10 * joltAmount.current;
      const joltZ = (Math.random() - 0.5) * 10 * joltAmount.current;
      
      mesh.position.x = data.position.x + joltX;
      mesh.position.y = data.position.y + Math.sin(t + i) * 2 + joltY; // floating effect + jolt
      mesh.position.z = data.position.z + joltZ;
      
      let reactVal = 0;
      if (data.bandIndex === 0) reactVal = bass;
      else if (data.bandIndex === 1) reactVal = mid;
      else reactVal = treble;
      
      const targetScale = data.baseScale * (1 + reactVal * 1.5);
      mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
      
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (material) {
        material.emissiveIntensity = reactVal * 1.2 * brightness;
        material.roughness = roughness;
        material.metalness = metalness;
      }
    });
    
    // Slowly rotate the entire group
    groupRef.current.rotation.y = t * 0.05;
    groupRef.current.rotation.x = Math.sin(t * 0.1) * 0.2;
  });

  return (
    <group ref={groupRef}>
      {spheresData.map((data, i) => (
        <mesh key={i} position={data.position}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial 
            map={videoTexture}
            emissiveMap={videoTexture} // Ensures it renders the video colors, not white
            emissive={new THREE.Color(0xffffff)}
            emissiveIntensity={0}
            roughness={0.2} 
            metalness={0.8} 
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
};

const AudioReactLights = ({ analyser, lightBrightness = 1 }: { analyser: AnalyserNode | null, lightBrightness?: number }) => {
  const bassLightRef = useRef<THREE.PointLight>(null);
  const midLightRef = useRef<THREE.PointLight>(null);
  const trebleLightRef = useRef<THREE.PointLight>(null);
  const dataArray = useRef(new Uint8Array(128));

  useFrame((state) => {
    if (!analyser) return;
    analyser.getByteFrequencyData(dataArray.current);
    
    // Calculate bands (0-10 bass, 10-40 mid, 40-120 treble)
    let bassSum = 0, midSum = 0, trebleSum = 0;
    for (let i = 0; i < 10; i++) bassSum += dataArray.current[i];
    for (let i = 10; i < 40; i++) midSum += dataArray.current[i];
    for (let i = 40; i < 120; i++) trebleSum += dataArray.current[i];
    
    const bass = bassSum / 10 / 255;
    const mid = midSum / 30 / 255;
    const treble = trebleSum / 80 / 255;

    const t = state.clock.elapsedTime;

    if (bassLightRef.current) {
      bassLightRef.current.intensity = THREE.MathUtils.lerp(bassLightRef.current.intensity, (5 + bass * 30) * lightBrightness, 0.2);
      bassLightRef.current.position.set(Math.sin(t * 0.5) * 15, -8, Math.cos(t * 0.5) * 15);
      // Optional: cycle color based on bass
      bassLightRef.current.color.setHSL((t * 0.1) % 1, 1, 0.5);
    }
    
    if (midLightRef.current) {
      midLightRef.current.intensity = THREE.MathUtils.lerp(midLightRef.current.intensity, (2 + mid * 20) * lightBrightness, 0.2);
      midLightRef.current.position.set(Math.sin(t * 0.8) * 12, 10, Math.cos(t * 1.2) * 12);
    }
    
    if (trebleLightRef.current) {
      trebleLightRef.current.intensity = THREE.MathUtils.lerp(trebleLightRef.current.intensity, (1 + treble * 40) * lightBrightness, 0.3);
      trebleLightRef.current.position.set(Math.cos(t * 1.5) * -10, Math.sin(t * 2) * 12, Math.sin(t) * 15);
    }
  });

  return (
    <group>
      <pointLight ref={bassLightRef} color="#ff0055" distance={100} decay={1.5} />
      <pointLight ref={midLightRef} color="#00ffff" distance={80} decay={1.5} />
      <pointLight ref={trebleLightRef} color="#aa00ff" distance={80} decay={1.5} />
    </group>
  );
};

export default function VisualSynth({ 
  analyser, 
  videoElement,
  brightness = 1,
  lightBrightness = 1,
  roughness = 0.2,
  metalness = 0.8
}: VisualSynthProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-20 mix-blend-screen opacity-90">
      <Canvas camera={{ position: [0, 0, 15] }} gl={{ antialias: true, alpha: true }}>
        <color attach="background" args={['#000000']} />
        <ambientLight intensity={0.5 * lightBrightness} />
        <AudioReactLights analyser={analyser} lightBrightness={lightBrightness} />
        <AudioReactVideoSphere 
          analyser={analyser} 
          videoElement={videoElement} 
          brightness={brightness}
          roughness={roughness}
          metalness={metalness}
        />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={1} fade speed={2} />
      </Canvas>
    </div>
  );
}
