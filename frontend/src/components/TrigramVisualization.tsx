import { useEffect, useRef, useMemo, useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Box, Circle, Gauge } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface TrigramVisualizationProps {
  buffer: ArrayBuffer | null;
}

type ShapeMode = "cartesian" | "cylindrical" | "spherical";

interface TrigramData {
  x: number;
  y: number;
  z: number;
  position: number; // 0-1, position in file
}

function calculateTrigrams(buffer: ArrayBuffer, maxSamples: number = 50000): TrigramData[] {
  const view = new Uint8Array(buffer);
  const trigrams: TrigramData[] = [];

  // Calculate step size for sampling if file is large
  const step = Math.max(1, Math.floor((view.length - 2) / maxSamples));

  for (let i = 0; i < view.length - 2; i += step) {
    trigrams.push({
      x: view[i],
      y: view[i + 1],
      z: view[i + 2],
      position: i / view.length, // Normalized position (0-1)
    });
  }

  return trigrams;
}

function cartesianToSpherical(x: number, y: number, z: number): [number, number, number] {
  const r = Math.sqrt(x * x + y * y + z * z);
  const theta = Math.atan2(y, x);
  const phi = Math.acos(z / (r || 1));
  return [r, theta, phi];
}

function cartesianToCylindrical(x: number, y: number, z: number): [number, number, number] {
  const r = Math.sqrt(x * x + y * y);
  const theta = Math.atan2(y, x);
  return [r, theta, z];
}

export function TrigramVisualization({ buffer }: TrigramVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const isRotatingRef = useRef<boolean>(true);

  const { theme, systemTheme } = useTheme();
  const [shapeMode, setShapeMode] = useState<ShapeMode>("cartesian");
  const [isRotating, setIsRotating] = useState(true);

  const trigrams = useMemo(() => {
    if (!buffer) return [];
    return calculateTrigrams(buffer);
  }, [buffer]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current || !trigrams.length) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Determine theme
    const effectiveTheme = theme === "system" ? systemTheme : theme;
    const isDark = effectiveTheme === "dark";

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDark ? 0x0a0a0a : 0xffffff);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 2000);
    camera.position.set(300, 300, 300);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Grid helper
    const gridHelper = new THREE.GridHelper(512, 16, isDark ? 0x444444 : 0xcccccc, isDark ? 0x222222 : 0xeeeeee);
    gridHelper.position.y = -128;
    scene.add(gridHelper);

    // Axes helper
    const axesHelper = new THREE.AxesHelper(300);
    scene.add(axesHelper);

    // Animation loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      if (isRotatingRef.current && pointsRef.current) {
        pointsRef.current.rotation.y += 0.002;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;

      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [trigrams, theme, systemTheme]);

  // Separate effect for rotation control
  useEffect(() => {
    // Update ref when state changes so animation loop sees it
    isRotatingRef.current = isRotating;
  }, [isRotating]);

  // Update points when trigrams or shape mode changes
  useEffect(() => {
    if (!sceneRef.current || !trigrams.length) return;

    const scene = sceneRef.current;

    // Remove old points
    if (pointsRef.current) {
      scene.remove(pointsRef.current);
      pointsRef.current.geometry.dispose();
      (pointsRef.current.material as THREE.Material).dispose();
    }

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];

    const color1 = new THREE.Color(0xffff00); // Yellow (start)
    const color2 = new THREE.Color(0x0088ff); // Blue (end)

    trigrams.forEach((trigram) => {
      let x = trigram.x - 128; // Center around origin (-128 to 127)
      let y = trigram.y - 128;
      let z = trigram.z - 128;

      // Apply coordinate transformation based on shape mode
      if (shapeMode === "spherical") {
        // For spherical, map to surface of sphere
        const r = Math.sqrt(x * x + y * y + z * z);
        if (r > 0) {
          const scale = 100; // Fixed radius for sphere
          x = (x / r) * scale;
          y = (y / r) * scale;
          z = (z / r) * scale;
        }
      } else if (shapeMode === "cylindrical") {
        // For cylindrical, keep z but project x,y to circle
        const r = Math.sqrt(x * x + y * y);
        if (r > 0) {
          const scale = 100; // Fixed radius for cylinder
          x = (x / r) * scale;
          y = (y / r) * scale;
        }
        // z stays as is
      }
      // else cartesian: use x, y, z as is

      positions.push(x, y, z);

      // Color based on position in file
      const color = color1.clone().lerp(color2, trigram.position);
      colors.push(color.r, color.g, color.b);
    });

    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    // Material
    const material = new THREE.PointsMaterial({
      size: 2,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
    });

    // Points
    const points = new THREE.Points(geometry, material);
    pointsRef.current = points;
    scene.add(points);
  }, [trigrams, shapeMode]);

  if (!buffer) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No file loaded
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Trigram Shapes (3D Visualization)</h3>
          <p className="text-xs text-muted-foreground mt-1">
            3-byte sequences visualized in 3D space • {trigrams.length.toLocaleString()} trigrams
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1 border rounded-lg p-1">
            <Button
              size="sm"
              variant={shapeMode === "cartesian" ? "default" : "ghost"}
              onClick={() => setShapeMode("cartesian")}
              className="h-7 px-2"
            >
              <Box className="h-3 w-3 mr-1" />
              <span className="text-xs">Cartesian</span>
            </Button>
            <Button
              size="sm"
              variant={shapeMode === "cylindrical" ? "default" : "ghost"}
              onClick={() => setShapeMode("cylindrical")}
              className="h-7 px-2"
            >
              <Gauge className="h-3 w-3 mr-1" />
              <span className="text-xs">Cylindrical</span>
            </Button>
            <Button
              size="sm"
              variant={shapeMode === "spherical" ? "default" : "ghost"}
              onClick={() => setShapeMode("spherical")}
              className="h-7 px-2"
            >
              <Circle className="h-3 w-3 mr-1" />
              <span className="text-xs">Spherical</span>
            </Button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsRotating(!isRotating)}
            className="h-7 px-3"
          >
            <span className="text-xs">{isRotating ? "⏸ Pause" : "▶ Rotate"}</span>
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 rounded-lg border bg-muted/20 relative overflow-hidden"
        style={{ minHeight: "500px" }}
      />

      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="font-semibold text-yellow-600 dark:text-yellow-400 mb-1">
            🟡 Yellow Points
          </p>
          <p className="text-muted-foreground">
            Trigrams from the <strong>beginning</strong> of the file
          </p>
        </div>

        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="font-semibold text-blue-600 dark:text-blue-400 mb-1">
            🔵 Blue Points
          </p>
          <p className="text-muted-foreground">
            Trigrams from the <strong>end</strong> of the file
          </p>
        </div>

        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
          <p className="font-semibold text-purple-600 dark:text-purple-400 mb-1">
            🎮 Controls
          </p>
          <p className="text-muted-foreground">
            <strong>Drag</strong> to rotate • <strong>Scroll</strong> to zoom
          </p>
        </div>
      </div>
    </div>
  );
}
