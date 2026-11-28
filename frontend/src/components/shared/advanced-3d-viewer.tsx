"use client";

import { useEffect, useState, useRef, useReducer, type Dispatch, type ElementRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stage, Grid } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Maximize, Minimize, RotateCcw, BoxSelect, Moon, Orbit, Grid3X3, SunMedium, Loader2, Settings2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  controlsReducer, initialControls, initialViewerState, modelExtension, SUPPORTED_MODEL_EXTENSIONS, viewerReducer,
  type ViewerEvent,
} from "@/lib/machines/model-viewer";

/** How close and how far the camera may go from the model, so a shopper cannot zoom inside it or lose it. */
const MIN_DISTANCE = 30;
const MAX_DISTANCE = 320;

/**
 * Models are framed for a roughly square picture. In a narrower one (a phone) the
 * view pulls back so a wide object is not cut off at the sides. Applied every frame
 * because refitting and "Reset view" both put the lens zoom back to 1.
 */
function FitToFrame() {
  useFrame(({ camera, size }) => {
    const zoom = Math.min(1, size.width / size.height / 1.15);
    if (camera.zoom !== zoom) {
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}

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
        const slate = new THREE.MeshStandardMaterial({ color: "#52666f", metalness: 0.3, roughness: 0.7 });
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
          color={wireframe ? "#0e5e6f" : "#52666f"} 
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
  const controlsRef = useRef<ElementRef<typeof OrbitControls>>(null);

  // The spin stops at the first touch and scroll-zoom wakes up only after a click (see machines/model-viewer).
  const [controls, controlsDispatch] = useReducer(controlsReducer, undefined, () =>
    initialControls(typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  );
  const [hintSeen, setHintSeen] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [lighting, setLighting] = useState<"studio" | "city" | "warehouse">("studio");
  // Off to begin with, so the object stands on a clean backdrop.
  const [showGrid, setShowGrid] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const touch = () => {
    controlsDispatch({ type: "TOUCH" });
    setHintSeen(true);
  };

  const zoomBy = (factor: number) => {
    const orbit = controlsRef.current;
    if (!orbit) return;
    touch();
    const camera = orbit.object;
    const offset = camera.position.clone().sub(orbit.target).multiplyScalar(factor)
      .clampLength(MIN_DISTANCE, MAX_DISTANCE);
    camera.position.copy(orbit.target).add(offset);
    orbit.update();
  };

  const resetView = () => {
    controlsRef.current?.reset();
    touch();
  };

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

  // Fullscreen has the whole screen to itself, so the wheel can always zoom there.
  const wheelZoom = controls.zoomLive || isFullscreen;

  return (
    <div
      ref={containerRef}
      data-flow="model-viewer"
      data-state={viewer.status}
      data-zoom={wheelZoom ? "live" : "locked"}
      data-spin={controls.autoRotate ? "on" : "off"}
      onPointerDown={touch}
      onPointerLeave={(event) => {
        // A finger lifting is not "leaving"; only a mouse pointer leaving gives the page its wheel back.
        if (event.pointerType === "mouse") controlsDispatch({ type: "LEAVE" });
      }}
      onDoubleClick={resetView}
      className={cn(
        "relative overflow-hidden bg-muted flex flex-col",
        isFullscreen ? "h-screen w-screen z-50" : "w-full h-full"
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

      {/* Tells a first-time visitor what their hands can do, then gets out of the way. */}
      {viewer.status === "ready" && !hintSeen && (
        <p className="absolute top-4 right-4 z-10 max-w-[60%] text-right text-xs px-2 py-1 rounded-md bg-background/80 backdrop-blur border border-border/50 text-muted-foreground pointer-events-none">
          <span className="pointer-coarse:hidden">Drag to rotate · click, then scroll to zoom</span>
          <span className="hidden pointer-coarse:inline">Drag to rotate · pinch to zoom</span>
        </p>
      )}

      {/* Everyday controls stay on show; the technical ones wait behind Settings. */}
      <div
        onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => { if (event.key === "Escape") setSettingsOpen(false); }}
        className="absolute bottom-3 right-3 z-10 flex flex-col items-end gap-2"
      >
        {settingsOpen && (
          <div id="viewer-settings" className="w-52 rounded-lg border border-border bg-background p-1">
            {([
              ["Spin automatically", "Auto-spin", Orbit, controls.autoRotate, () => controlsDispatch({ type: "TOGGLE_ROTATE" })],
              ["Wireframe", "Wireframe", BoxSelect, wireframe, () => setWireframe(!wireframe)],
              ["Grid", "Grid", Grid3X3, showGrid, () => setShowGrid(!showGrid)],
              ["Change lighting", lighting === "studio" ? "Lighting: studio" : "Lighting: city", lighting === "studio" ? SunMedium : Moon, undefined, () => setLighting(l => l === "studio" ? "city" : "studio")],
            ] as const).map(([name, text, Icon, pressed, act]) => (
              <button key={name} type="button" aria-label={name} aria-pressed={pressed} onClick={act}
                className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-muted aria-pressed:text-primary-ink aria-pressed:font-medium">
                <Icon size={16} aria-hidden="true" />{text}
              </button>
            ))}
            <button type="button" aria-label="Reset view" onClick={resetView} className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-muted">
              <RotateCcw size={16} aria-hidden="true" />Reset view
            </button>
            {stats.polyCount > 0 && (
              <p className="border-t border-border px-2 py-2 text-xs text-muted-foreground">
                Preview mesh: {stats.polyCount.toLocaleString("en-IN")} polygons, {stats.vertices.toLocaleString("en-IN")} vertices
              </p>
            )}
          </div>
        )}
        <div className="flex items-center gap-0.5 rounded-full border border-border bg-background p-1">
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => zoomBy(0.8)} aria-label="Zoom in" title="Zoom in">
            <ZoomIn size={16} />
          </Button>
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => zoomBy(1.25)} aria-label="Zoom out" title="Zoom out">
            <ZoomOut size={16} />
          </Button>
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </Button>
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setSettingsOpen(open => !open)}
            aria-label="Viewer settings" title="Viewer settings" aria-expanded={settingsOpen} aria-controls="viewer-settings">
            <Settings2 size={16} />
          </Button>
        </div>
      </div>

      <Canvas camera={{ position: [0, 0, 150], fov: 50 }} style={{ touchAction: wheelZoom ? "none" : "pan-y" }}>
        <Stage environment={lighting} intensity={0.5}>
          <Model url={url} wireframe={wireframe} dispatch={dispatch} />
        </Stage>
        <FitToFrame />
        {showGrid && <Grid infiniteGrid fadeDistance={200} cellColor="#64748b" sectionColor="#94a3b8" position={[0, -0.01, 0]} />}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          autoRotate={controls.autoRotate}
          autoRotateSpeed={1.5}
          enableDamping
          dampingFactor={0.08}
          enableZoom={wheelZoom}
          zoomToCursor
          minDistance={MIN_DISTANCE}
          maxDistance={MAX_DISTANCE}
          onStart={touch}
        />
      </Canvas>
    </div>
  );
}
