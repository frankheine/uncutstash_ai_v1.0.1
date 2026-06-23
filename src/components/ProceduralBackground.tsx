import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';

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

const getLayersForVariant = (variant: number): LayerConfig[] => {
  // Variant 2: Real stars in space (the user's favorite)
  if (variant === 2) {
    return [
      { count: 2000, spread: 400, minSize: 1.0,  maxSize: 3.0,  speed: 0.012, colors: [0x0f172a, 0x1e3a8a] },
      { count: 800,  spread: 250, minSize: 3.0,  maxSize: 7.0,  speed: 0.022, colors: [0x2563eb, 0x60a5fa] },
      { count: 200,  spread: 150, minSize: 8.0,  maxSize: 16.0, speed: 0.035, colors: [0x93c5fd, 0xeff6ff] },
      { count: 40,   spread: 120, minSize: 18.0, maxSize: 35.0, speed: 0.018, colors: [0xffffff, 0xdbeafe] },
    ];
  }
  // Variants 1, 3-10: Different color palettes and densities
  const palettes = [
    // 1: Emerald/Teal
    [0x022c22, 0x065f46, 0x10b981, 0x34d399, 0xa7f3d0, 0xffffff],
    // 3: Amethyst/Purple
    [0x2e1065, 0x4c1d95, 0x7c3aed, 0xa78bfa, 0xddd6fe, 0xffffff],
    // 4: Crimson/Red
    [0x450a0a, 0x7f1d1d, 0xdc2626, 0xf87171, 0xfecaca, 0xffffff],
    // 5: Amber/Gold
    [0x451a03, 0x78350f, 0xd97706, 0xfbbf24, 0xfde68a, 0xffffff],
    // 6: Deep Space Black & White
    [0x000000, 0x171717, 0x525252, 0xa3a3a3, 0xe5e5e5, 0xffffff],
    // 7: Rose/Pink
    [0x4c0519, 0x881337, 0xe11d48, 0xfb7185, 0xfecdd3, 0xffffff],
    // 8: Cyan/Neon Blue
    [0x083344, 0x164e63, 0x0891b2, 0x22d3ee, 0xcffafe, 0xffffff],
    // 9: Matrix Green
    [0x052e16, 0x14532d, 0x15803d, 0x4ade80, 0xbbf7d0, 0xffffff],
    // 10: Sunset Orange/Purple
    [0x2e1065, 0x7c3aed, 0xc026d3, 0xe11d48, 0xf97316, 0xffffff],
  ];
  
  let paletteIdx = variant - 1;
  if (variant > 2) paletteIdx = variant - 2;
  const p = palettes[paletteIdx % palettes.length];

  return [
    { count: 2000, spread: 400, minSize: 1.0,  maxSize: 3.0,  speed: 0.012, colors: [p[0], p[1]] },
    { count: 800,  spread: 250, minSize: 3.0,  maxSize: 7.0,  speed: 0.022, colors: [p[2], p[3]] },
    { count: 200,  spread: 150, minSize: 8.0,  maxSize: 16.0, speed: 0.035, colors: [p[4], p[5]] },
    { count: 40,   spread: 120, minSize: 18.0, maxSize: 35.0, speed: 0.018, colors: [p[5], p[5]] },
  ];
};

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

export default function ProceduralBackground({ slowMode = false, variant = 2 }: { slowMode?: boolean, variant?: number }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [webGlFailed, setWebGlFailed] = useState(false);
  const motionRef = useRef(motionEnabled);

  useEffect(() => {
    motionRef.current = motionEnabled;
  }, [motionEnabled]);

  const slowModeRef = useRef(slowMode);
  useEffect(() => {
    slowModeRef.current = slowMode;
  }, [slowMode]);

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
      setWebGlFailed(true);
      return;
    }

    // ── Build star field layers ─────────────────────────────────────────────
    const layers = getLayersForVariant(variant).map(cfg => {
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
    const animate = () => {
      const t = performance.now() * 0.001;

      let scrollOffset = 0;
      if ((window as any).activeLenis) {
        scrollOffset = (window as any).activeLenis.scroll || 0;
      }

      // Update each layer's time uniform (for twinkle) and make drift rotation visible
      layers.forEach(({ points, mat, speed }) => {
        mat.uniforms.uTime.value = t;
        if (motionRef.current) {
          const currentSpeed = slowModeRef.current ? speed * 0.05 : speed * 0.5;
          points.rotation.y += currentSpeed * 2.0;
          points.rotation.x += currentSpeed * 1.5;
        }
      });

      if (motionRef.current) {
        camera.position.x += (targetX * 120 - camera.position.x) * 0.04;
        
        // Target Y is a combination of mouse parallax and scroll position
        const targetCameraY = (-targetY * 80) - (scrollOffset * 0.1);
        
        // Instantly snap to the target if we want zero latency, or slightly smooth it
        camera.position.y += (targetCameraY - camera.position.y) * 0.1;
      }
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };
    
    let animId = requestAnimationFrame(animate);

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
  }, [variant]);

  if (webGlFailed) {
    return (
      <div className="fixed inset-0 z-[-2] bg-gradient-to-br from-[#0f172a] to-[#1e3a8a] overflow-hidden pointer-events-none">
        <div className="absolute inset-0 opacity-30 mix-blend-screen bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.5),transparent_50%)] animate-pulse" />
        <div className="absolute inset-0 opacity-20 mix-blend-screen bg-[radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.6),transparent_40%)]" style={{ animation: "pulse 4s infinite alternate" }} />
      </div>
    );
  }

  return (
    <>
      <div ref={mountRef} className="fixed inset-0 z-[-2] pointer-events-none transition-opacity duration-1000" />
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        <label className="text-white/50 text-xs font-mono uppercase tracking-widest pointer-events-auto">Motion</label>
        <button 
          onClick={() => setMotionEnabled(!motionEnabled)}
          className={`w-12 h-6 rounded-full p-1 transition-colors pointer-events-auto ${motionEnabled ? 'bg-emerald-500' : 'bg-white/20'}`}
        >
          <div className={`w-4 h-4 bg-white rounded-full transition-transform ${motionEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
      </div>
    </>
  );
}