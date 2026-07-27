"use client";

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { Box, File, FileCode, FileVideo } from 'lucide-react';

interface ModelViewerProps {
  url: string;
  extension: string;
  className?: string;
}

const STLModel = ({ url }: { url: string }) => {
  const geom = useLoader(STLLoader, url);
  return (
    <mesh geometry={geom}>
      <meshStandardMaterial color="#888888" />
    </mesh>
  );
};

const OBJModel = ({ url }: { url: string }) => {
  const obj = useLoader(OBJLoader, url);
  return <primitive object={obj} />;
};

export default function ModelViewer({ url, extension, className = "w-full h-96 bg-card rounded-lg" }: ModelViewerProps) {
  const is3DSupported = ['stl', 'obj'].includes(extension.toLowerCase());

  if (!is3DSupported) {
    return (
      <div className={`flex flex-col items-center justify-center text-muted-foreground ${className}`}>
        <Box size={48} className="mb-2" />
        <p className="text-sm">Preview not available for .{extension} files.</p>
        <p className="text-xs text-muted-foreground">Download to view</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0, 150], fov: 50 }}>
        <Suspense fallback={null}>
          <Stage environment="city" intensity={0.5}>
            {extension.toLowerCase() === 'stl' && <STLModel url={url} />}
            {extension.toLowerCase() === 'obj' && <OBJModel url={url} />}
          </Stage>
        </Suspense>
        <OrbitControls makeDefault autoRotate autoRotateSpeed={1.0} />
      </Canvas>
    </div>
  );
}
