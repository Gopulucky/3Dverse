"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Float, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

function AbstractShape() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.2;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.3;
    }
  });

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={2}>
      <mesh ref={meshRef} castShadow receiveShadow>
        <icosahedronGeometry args={[2, 4]} />
        <MeshDistortMaterial
          color="#8b5cf6"
          envMapIntensity={1}
          clearcoat={1}
          clearcoatRoughness={0.1}
          metalness={0.5}
          roughness={0.2}
          distort={0.4}
          speed={2}
        />
      </mesh>
    </Float>
  );
}

export function Hero3DObject() {
  return (
    <div className="w-full h-full min-h-[400px]">
      <Canvas camera={{ position: [0, 0, 6], fov: 45 }} shadows>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1} castShadow />
        <spotLight position={[-10, -10, -10]} intensity={0.5} color="#ec4899" />
        <AbstractShape />
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
