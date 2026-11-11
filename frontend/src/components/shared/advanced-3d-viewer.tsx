"use client";

import { useEffect, useState, useRef, useMemo, useReducer, type Dispatch } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Stage, Environment, Grid, Html } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Maximize, RotateCcw, BoxSelect, Sun, Moon, Orbit, Grid3X3, SunMedium, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  initialViewerState, modelExtension, SUPPORTED_MODEL_EXTENSIONS, viewerReducer, type ViewerEvent,
} from "@/lib/machines/model-viewer";

function Model({
  url,
  wireframe,
  dispatch
}: {
  url: string;
  wireframe: boolean;
  dispatch: Dispatch<ViewerEvent>;
}) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | THREE.Group | null>(null);

  useEffect(() => {
    if (!url) return;
    // `dispatch` is stable, so this effect re-runs only when the URL changes.
    // `cancelled` stops a slow load of a previous URL from overwriting the new one.
    let cancelled = false;
    dispatch({ type: "LOAD" });
    const extension = modelExtension(url);
    if (!(SUPPORTED_MODEL_EXTENSIONS as readonly string[]).includes(extension)) {
      dispatch({ type: "FAILED", reason: "unsupported" });
      return;
    }
    const fail = () => { if (!cancelled) dispatch({ type: "FAILED", reason: "failed" }); };

    const handleLoaded = (obj: THREE.BufferGeometry | THREE.Group) => {
      let polyCount = 0;
      let vertices = 0;

      if (obj instanceof THREE.BufferGeometry) {
        if (obj.index) {
          polyCount = obj.index.count / 3;
        } else if (obj.attributes.position) {
          polyCount = obj.attributes.position.count / 3;
        }
        vertices = obj.attributes.position ? obj.attributes.position.count : 0;
      } else {
        obj.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const geo = (child as THREE.Mesh).geometry;
            if (geo.index) {
              polyCount += geo.index.count / 3;
            } else if (geo.attributes.position) {
              polyCount += geo.attributes.position.count / 3;
            }
            vertices += geo.attributes.position ? geo.attributes.position.count : 0;
          }
        });
      }

      if (cancelled) return;
      dispatch({ type: "LOADED", stats: { polyCount, vertices } });
      setGeometry(obj);
    };

    if (extension === "stl") {
      const loader = new STLLoader();
      loader.load(url, (geo) => {
        geo.center();
        handleLoaded(geo);
      }, undefined, fail);
    } else if (extension === "obj") {
      const loader = new OBJLoader();
      loader.load(url, (group) => {
        handleLoaded(group);
      }, undefined, fail);
    } else if (extension === "glb" || extension === "gltf") {
      // The public preview mesh the server generates for every upload is a .glb.
      // Without this branch the marketplace viewer showed an empty box for any
      // product whose preview had been generated.
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => {
        // The server shrinks every public preview so its longest side is 1 unit
        // (so it can't be used to recover true dimensions), but this scene's
        // camera and grid are sized for models tens of units across. Without
        // rescaling, the model is a speck. Model files are Z-up, three.js is
        // Y-up, so stand it upright, then scale it to a fixed viewing size.
        const wrapper = new THREE.Group();
        gltf.scene.rotation.x = -Math.PI / 2;
        wrapper.add(gltf.scene);
        const slate = new THREE.MeshStandardMaterial({ color: "#94a3b8", metalness: 0.3, roughness: 0.7 });
        wrapper.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).material = slate;
        });
        wrapper.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(wrapper);
        const size = box.getSize(new THREE.Vector3());
        const k = 60 / (Math.max(size.x, size.y, size.z) || 1);
        wrapper.scale.setScalar(k);
        wrapper.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-k);
        handleLoaded(wrapper);
      }, undefined, fail);
    }
    return () => { cancelled = true; };
  }, [url, dispatch]);

  if (!geometry) return null;

  if (geometry instanceof THREE.BufferGeometry) {
    return (
      <mesh geometry={geometry}>
        <meshStandardMaterial 
          color={wireframe ? "#3b82f6" : "#94a3b8"} 
          metalness={0.3} 
          roughness={0.7} 
          wireframe={wireframe} 
        />
      </mesh>
    );
  }

  // If OBJ Group, we need to traverse to apply wireframe material
  geometry.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (mat) mat.wireframe = wireframe;
    }
  });

  return <primitive object={geometry} />;
}

export function Advanced3DViewer({ url }: { url: string }) {
  const [viewer, dispatch] = useReducer(viewerReducer, initialViewerState);
  const stats = viewer.status === "ready" ? viewer.stats : { polyCount: 0, vertices: 0 };
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Controls
  const [autoRotate, setAutoRotate] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [lighting, setLighting] = useState<"studio" | "city" | "warehouse">("studio");
  const [showGrid, setShowGrid] = useState(true);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error("Error attempting to enable full-screen mode:", err.message);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  return (
    <div
      ref={containerRef}
      data-flow="model-viewer"
      data-state={viewer.status}
      className={cn(
        "relative rounded-xl overflow-hidden border border-border bg-gradient-to-b from-muted to-background shadow-sm flex flex-col group",
        isFullscreen ? "h-screen w-screen z-50 rounded-none border-none" : "w-full h-full min-h-[400px] lg:min-h-[500px]"
      )}
    >
      {viewer.status === "loading" && (
        <div role="status" className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-sm text-muted-foreground pointer-events-none">
          <Loader2 className="animate-spin" size={18} aria-hidden="true" />
          Loading 3D preview…
        </div>
      )}
      {viewer.status === "error" && (
        <div role="alert" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 p-6 text-center bg-muted/60">
          <p className="font-medium text-foreground">This 3D preview can&apos;t be shown.</p>
          <p className="text-sm text-muted-foreground">
            {viewer.reason === "unsupported"
              ? "This file format can't be previewed in the browser."
              : "The preview didn't load. Refresh to try again."}
          </p>
        </div>
      )}

      {/* HUD Info */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        {stats.polyCount > 0 && (
          <div className="bg-background/80 backdrop-blur text-xs px-2 py-1 rounded-md border border-border/50 text-muted-foreground font-mono">
            Polys: {(stats.polyCount / 1000).toFixed(1)}k
          </div>
        )}
        {stats.vertices > 0 && (
          <div className="bg-background/80 backdrop-blur text-xs px-2 py-1 rounded-md border border-border/50 text-muted-foreground font-mono">
            Verts: {(stats.vertices / 1000).toFixed(1)}k
          </div>
        )}
      </div>

      {/* Floating Toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-background/80 backdrop-blur-md p-1.5 rounded-full border border-border/50 shadow-lg opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <Button
          variant={autoRotate ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={() => setAutoRotate(!autoRotate)}
          title="Toggle Rotation"
        >
          <Orbit size={16} />
        </Button>
        <Button
          variant={wireframe ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={() => setWireframe(!wireframe)}
          title="Toggle Wireframe"
        >
          <BoxSelect size={16} />
        </Button>
        <Button
          variant={showGrid ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={() => setShowGrid(!showGrid)}
          title="Toggle Grid"
        >
          <Grid3X3 size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={() => setLighting(l => l === "studio" ? "city" : "studio")}
          title="Toggle HDRI"
        >
          {lighting === "studio" ? <SunMedium size={16} /> : <Moon size={16} />}
        </Button>
        <div className="w-px h-4 bg-border/50 mx-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={toggleFullscreen}
          title="Fullscreen"
        >
          <Maximize size={16} />
        </Button>
      </div>

      <Canvas camera={{ position: [0, 0, 150], fov: 50 }}>
        <Stage environment={lighting} intensity={0.5}>
          <Model url={url} wireframe={wireframe} dispatch={dispatch} />
        </Stage>
        {showGrid && <Grid infiniteGrid fadeDistance={200} cellColor="#64748b" sectionColor="#94a3b8" position={[0, -0.01, 0]} />}
        <OrbitControls makeDefault autoRotate={autoRotate} autoRotateSpeed={2} />
      </Canvas>
    </div>
  );
}
