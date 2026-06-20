import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export const CubeLoader = ({ variant = 1 }: { variant?: number }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  // We use state to track if WebGL fails so we can render a CSS fallback
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    if (!mountRef.current) return;

    // STRICT MODE FIX: Remove any existing canvases to prevent "two cubes" (cube on the left)
    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }

    // 1. Setup Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.z = 3.5;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(192, 192); // 48rem = 192px
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      mountRef.current.appendChild(renderer.domElement);
    } catch (err) {
      console.error("WebGL failed to initialize in CubeLoader", err);
      setWebglFailed(true);
      return;
    }

    // 2. Setup Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);
    const pointLight = new THREE.PointLight(0x8b5cf6, 5, 10);
    pointLight.position.set(-2, -2, 2);
    scene.add(pointLight);

    // 3. Setup Video Texture
    const video = document.createElement('video');
    video.src = '/logos/uncutstash-logo.mp4';
    video.crossOrigin = 'anonymous';
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;

    // Force load and play
    video.load();
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => {
        if (e.name !== 'AbortError') console.log('Video autoplay blocked:', e);
      });
    }

    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.colorSpace = THREE.SRGBColorSpace;
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;

    // 4. Build the core cube material
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0xaa88ff, // Base violet tint while loading
      map: videoTexture,
      roughness: 0.1,
      metalness: 0.9,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: videoTexture,
      emissiveIntensity: 1.5, // Make the video glow intensely
    });

    // 5. Create the group that will hold the geometry based on variant
    const cubeGroup = new THREE.Group();
    scene.add(cubeGroup);

    // Core Geometry
    const boxGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8, 16, 16, 16);
    const coreMesh = new THREE.Mesh(boxGeo, coreMaterial);
    cubeGroup.add(coreMesh);

    // Variant specifics
    let outerMesh: THREE.Mesh | null = null;
    const initialVertices = boxGeo.attributes.position.array.slice();

    if (variant === 2) {
      // Wireframe Encased
      const wireframeGeo = new THREE.BoxGeometry(2.1, 2.1, 2.1);
      const wireframeMat = new THREE.MeshBasicMaterial({
        color: 0x00f2fe,
        wireframe: true,
        transparent: true,
        opacity: 0.3
      });
      outerMesh = new THREE.Mesh(wireframeGeo, wireframeMat);
      cubeGroup.add(outerMesh);
    } else if (variant === 3) {
      // Glass Encased Tesseract
      const glassGeo = new THREE.BoxGeometry(2.4, 2.4, 2.4);
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0.1,
        roughness: 0.05,
        transmission: 1.0, // glass-like transparency
        thickness: 0.5,
        ior: 1.5,
        transparent: true,
        opacity: 1
      });
      outerMesh = new THREE.Mesh(glassGeo, glassMat);
      cubeGroup.add(outerMesh);
    }

    // 6. Animation Loop & Physics
    let animationId: number;
    const startTime = performance.now();
    let isActive = true;

    // We use GSAP for Variant 1's specific snappy physics
    if (variant === 1) {
      const rotateCube = async () => {
        if (!isActive) return;
        cubeGroup.rotation.set(0, 0, 0);

        await new Promise(r => setTimeout(r, 1200));
        if (!isActive) return;

        const roll = Math.floor(Math.random() * 4);
        let targetX = 0, targetY = 0;
        if (roll === 0) targetY = -Math.PI / 2;
        else if (roll === 1) targetY = Math.PI / 2;
        else if (roll === 2) targetX = -Math.PI / 2;
        else if (roll === 3) targetX = Math.PI / 2;

        import('gsap').then(({ default: gsap }) => {
          gsap.to(cubeGroup.rotation, {
            x: targetX,
            y: targetY,
            duration: 1.0,
            ease: "elastic.out(1, 0.5)", // Spring physics equivalent
            onComplete: () => {
              if (isActive) rotateCube();
            }
          });
        });
      };
      rotateCube();
    }

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const t = (performance.now() - startTime) / 1000;

      // Continuous rotation for variants 2, 3, 4
      if (variant !== 1) {
        cubeGroup.rotation.x = t * 0.5;
        cubeGroup.rotation.y = t * 0.7;
      }

      if (variant === 2 && outerMesh) {
        outerMesh.rotation.x = -t * 0.2;
        outerMesh.rotation.y = -t * 0.3;
      }

      if (variant === 3 && outerMesh) {
        outerMesh.rotation.x = t * 0.1;
        outerMesh.rotation.y = t * 0.1;
      }

      if (variant === 4) {
        // Displaced / Breathing Cube
        const posAttribute = boxGeo.attributes.position;
        const vertex = new THREE.Vector3();
        for (let i = 0; i < posAttribute.count; i++) {
          vertex.fromArray(initialVertices, i * 3);
          const dist = vertex.length();
          const wave = Math.sin(t * 3.0 + vertex.x * 2.0 + vertex.y * 2.0) * 0.15;
          vertex.normalize().multiplyScalar(dist + wave);
          posAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }
        posAttribute.needsUpdate = true;
        boxGeo.computeVertexNormals();
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      isActive = false;
      cancelAnimationFrame(animationId);
      import('gsap').then(({ default: gsap }) => gsap.killTweensOf(cubeGroup.rotation));
      if (playPromise !== undefined) {
        playPromise.then(() => {
          video.pause();
          video.src = '';
        }).catch(() => { });
      } else {
        video.pause();
        video.src = '';
      }
      if (mountRef.current && renderer.domElement) {
        if (mountRef.current.contains(renderer.domElement)) {
          mountRef.current.removeChild(renderer.domElement);
        }
      }
      boxGeo.dispose();
      coreMaterial.dispose();
      videoTexture.dispose();
      renderer.dispose();
    };
  }, [variant]);

  // CSS Fallback if WebGL fails entirely (e.g. in some dev environments)
  if (webglFailed) {
    return (
      <div className="relative w-48 h-48 mb-8 flex items-center justify-center bg-violet-900/20 border border-violet-500 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(139,92,246,0.5)]">
        <video src="/logos/uncutstash-logo.mp4" autoPlay loop muted playsInline className="w-full h-full object-cover mix-blend-screen opacity-80" />
      </div>
    );
  }

  return <div ref={mountRef} data-cube-loader-variant={variant} className="relative w-48 h-48 mb-8 flex items-center justify-center filter drop-shadow-[0_0_15px_rgba(139,92,246,0.6)]" />;
};

export default CubeLoader;
