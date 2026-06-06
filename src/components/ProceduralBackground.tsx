import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// ── Vertex Shader ─────────────────────────────────────────────────────────────
// Passes each star's size and colour to the fragment shader.
// Stars closer to the camera appear larger (perspective sizing).
const VERT = /* glsl */`
  attribute float aSize;
  attribute vec3  aColor;
  attribute float aTwinkle;   // per-star random phase offset for twinkle
  uniform   float uTime;
  varying   vec3  vColor;
  varying   float vAlpha;

  void main() {
    vColor = aColor;

    // Twinkle: each star oscillates between 0.4 and 1.0 opacity
    float flicker = 0.4 + 0.6 * (0.5 + 0.5 * sin(uTime * 1.8 + aTwinkle * 6.2831));
    vAlpha = flicker;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Perspective size: bigger = closer feel
    gl_PointSize = aSize * (400.0 / -mvPosition.z);
    gl_Position  = projectionMatrix * mvPosition;
  }
`;

// ── Fragment Shader ───────────────────────────────────────────────────────────
// Renders each point as a soft radial disc — no squares ever.
// The falloff is quadratic so the glow bleeds outward naturally.
const FRAG = /* glsl */`
  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    // gl_PointCoord is (0,0)→(1,1) within the point sprite quad
    vec2  uv   = gl_PointCoord - 0.5;        // centre at (0,0)
    float dist = dot(uv, uv);                 // squared distance from centre
    if (dist > 0.25) discard;                // hard clip to circle

    // Soft Gaussian-like radial falloff: bright core, fading halo
    float alpha = vAlpha * exp(-dist * 14.0);
    gl_FragColor = vec4(vColor, alpha);
  }
`;

// ── Star Field Layer Config ───────────────────────────────────────────────────
interface LayerConfig {
  count:   number;
  spread:  number;   // XYZ bounding box half-size
  minSize: number;
  maxSize: number;
  speed:   number;   // drift speed
  colors:  number[]; // pairs: hex color A, hex color B — lerped per star
}

const LAYERS: LayerConfig[] = [
  // Distant dust — tiny, dense, slow
  { count: 2000, spread: 400, minSize: 1.0,  maxSize: 3.0,  speed: 0.012, colors: [0x0f172a, 0x1e3a8a] },
  // Mid field — medium, blue/cyan mix
  { count: 800,  spread: 250, minSize: 3.0,  maxSize: 7.0,  speed: 0.022, colors: [0x2563eb, 0x60a5fa] },
  // Foreground bright orbs — sparse, large, vivid
  { count: 200,  spread: 150, minSize: 8.0,  maxSize: 16.0, speed: 0.035, colors: [0x93c5fd, 0xeff6ff] },
  // Occasional massive blue/white giants
  { count: 40,   spread: 120, minSize: 18.0, maxSize: 35.0, speed: 0.018, colors: [0xffffff, 0xdbeafe] },
];

function buildLayer(cfg: LayerConfig) {
  const { count, spread, minSize, maxSize, colors } = cfg;
  const positions = new Float32Array(count * 3);
  const sizes     = new Float32Array(count);
  const colorsArr = new Float32Array(count * 3);
  const twinkles  = new Float32Array(count);

  const colorA = new THREE.Color(colors[0]);
  const colorB = new THREE.Color(colors[1]);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    // Random position in a sphere-ish volume (reject corners for rounder galaxy)
    let x, y, z;
    do {
      x = (Math.random() - 0.5) * 2 * spread;
      y = (Math.random() - 0.5) * 2 * spread;
      z = (Math.random() - 0.5) * 2 * spread;
    } while (x * x + y * y + z * z > spread * spread);

    positions[i3]     = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;

    sizes[i] = minSize + Math.random() * (maxSize - minSize);

    const c = colorA.clone().lerp(colorB, Math.random());
    colorsArr[i3]     = c.r;
    colorsArr[i3 + 1] = c.g;
    colorsArr[i3 + 2] = c.b;

    twinkles[i] = Math.random(); // unique phase per star
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aColor',   new THREE.BufferAttribute(colorsArr, 3));
  geo.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkles, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader:   VERT,
    fragmentShader: FRAG,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  });

  return { points: new THREE.Points(geo, mat), mat, speed: cfg.speed };
}

export default function ProceduralBackground() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const motionRef = useRef(motionEnabled);

  useEffect(() => {
    motionRef.current = motionEnabled;
  }, [motionEnabled]);

  useEffect(() => {
    if (!mountRef.current) return;

    // ── Scene ───────────────────────────────────────────────────────────────
    const scene    = new THREE.Scene();
    scene.fog      = new THREE.FogExp2(0x000008, 0.0008); // deep-space blue-black

    const camera   = new THREE.PerspectiveCamera(
      70, window.innerWidth / window.innerHeight, 0.1, 2000
    );
    camera.position.z = 375; // Zoomed in to 375 per user request

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true, antialias: true, powerPreference: 'high-performance',
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.25;
      mountRef.current.appendChild(renderer.domElement);
    } catch (err) {
      console.warn("WebGL not supported, falling back to static background.", err);
      return;
    }

    // ── Build star field layers ─────────────────────────────────────────────
    const layers = LAYERS.map(cfg => {
      const layer = buildLayer(cfg);
      scene.add(layer.points);
      return layer;
    });

    // ── Nebula: large soft colour blobs behind the stars ───────────────────
    // Done with additive-blended sprite-like PlaneGeometry + ShaderMaterial
    const nebulaMat = new THREE.MeshBasicMaterial({
      color: 0x1e0a4e, transparent: true, opacity: 0.06,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    for (let n = 0; n < 4; n++) {
      const geo = new THREE.PlaneGeometry(300, 300);
      const mesh = new THREE.Mesh(geo, nebulaMat.clone());
      mesh.position.set(
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 100 - 100
      );
      mesh.rotation.z = Math.random() * Math.PI;
      scene.add(mesh);
    }

    // ── Mouse parallax ──────────────────────────────────────────────────────
    let targetX = 0, targetY = 0;
    const halfW = window.innerWidth  / 2;
    const halfH = window.innerHeight / 2;

    const onMouseMove = (e: MouseEvent) => {
      targetX = (e.clientX - halfW) / halfW;  // -1 → +1
      targetY = (e.clientY - halfH) / halfH;
    };
    document.addEventListener('mousemove', onMouseMove);

    // ── Animation ───────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Update each layer's time uniform (for twinkle) and make drift rotation visible
      layers.forEach(({ points, mat, speed }) => {
        mat.uniforms.uTime.value = t;
        if (motionRef.current) {
          points.rotation.y += speed * 2.0; // Extremely slow soothing rotation
          points.rotation.x += speed * 1.5;
        }
      });

      // Smooth spring interpolation toward mouse — much wider tracking range
      if (motionRef.current) {
        camera.position.x += (targetX * 120 - camera.position.x) * 0.04;
        camera.position.y += (-targetY * 80 - camera.position.y) * 0.04;
      }
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
    };
    animate();

    // ── Resize ──────────────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    ro.observe(document.body);

    // ── Cleanup ─────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener('mousemove', onMouseMove);
      ro.disconnect();
      mountRef.current?.removeChild(renderer.domElement);
      layers.forEach(({ points }) => {
        points.geometry.dispose();
        (points.material as THREE.ShaderMaterial).dispose();
      });
      renderer.dispose();
    };
  }, []);

  return (
    <>
      <div ref={mountRef} className="absolute inset-0 z-0 pointer-events-none" />
      <button 
        onClick={() => setMotionEnabled(!motionEnabled)}
        className="fixed bottom-4 right-4 z-50 text-white/40 hover:text-white/90 bg-black/30 hover:bg-black/50 rounded-full px-3 py-1.5 text-xs border border-white/5 transition-all backdrop-blur-md cursor-pointer pointer-events-auto flex items-center gap-2 font-mono"
      >
        <div className={`w-2 h-2 rounded-full ${motionEnabled ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`} />
        MOTION
      </button>
    </>
  );
}