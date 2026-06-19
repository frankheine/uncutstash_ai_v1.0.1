### **1\. The Bioluminescent Nebula Ripple**

**The Prompt:**

"Write a WebGL fragment shader for a background canvas. Create a deep space scene featuring a soft, gaseous nebula using multi-octave simplex noise. The color palette should be dark void black with very subtle, muted deep blues and bioluminescent purples. Scatter tiny, low-opacity white pixels to act as distant stars. The animation should be incredibly slow. For the mouse interaction, use `u_mouse` to create a gentle 'ripple' or fluid displacement effect in the nebula gas when the cursor moves, behaving like a hand passing through water. Ensure no flashing, strobing, or fast movements—everything must use smooth interpolation."

**Why it works:** The fluid displacement of the gas gives a 3D tactile feel, while the muted colors keep it entirely headache-free.

### **2\. Multi-Layered Parallax Starfield**

**The Prompt:**

"Generate a GLSL shader that creates a soothing, 3D parallax starfield. Divide the stars into three distinct layers: background (tiny, dim, slow), midground (medium size, slightly brighter, medium speed), and foreground (larger, soft-glow, slightly faster). The base motion should drift slowly to the right. Use the mouse coordinates (`u_mouse`) to offset the camera's X and Y axis slightly, creating a gentle 3D parallax effect as the user moves their cursor. Use smoothstep to give the stars soft, anti-aliased edges so they look like glowing orbs rather than sharp pixels. Keep the background deep space black."

**Why it works:** Parallax is the ultimate way to create depth without chaos. The brain instantly recognizes it as 3D space.

### **3\. The Gravitational Lens**

**The Prompt:**

"Create a Three.js shader material background featuring a dense but static field of tiny, soft-glowing stars against a dark gray-blue cosmic void. Instead of the stars moving on their own, the animation is entirely driven by the cursor. The cursor acts as a micro black hole or gravitational lens. As the mouse moves across the canvas, it gently warps and bends the space (and the stars) around it in a smooth, circular distortion field. Use a cubic easing function so the distortion fades out smoothly at the edges. The visual effect should be mesmerizing, slow, and completely fluid."

**Why it works:** By keeping the background static until interacted with, you eliminate constant motion, making it highly readable for UI elements on top.

### **4\. Cosmic Dust Flow (Boids/Fluid Sim Style)**

**The Prompt:**

"Write a GLSL fragment shader simulating a slow-moving river of cosmic stardust. The particles shouldn't be distinct dots, but rather continuous, softly glowing trails created by directional noise vectors. Use a dark, monochromatic dark-teal theme. As the cursor (`u_mouse`) moves through the canvas, it should act as a gentle obstacle, causing the stardust to smoothly part and flow around the cursor with a delayed easing effect. The movement must be viscous, resembling syrup or smoke in zero gravity, rather than fast-moving sparks."

**Why it works:** Fluid dynamics naturally feel organic and relaxing to the human eye, avoiding the harsh geometries that cause eye strain.

### **5\. The Breathing Galaxy**

**The Prompt:**

"Generate a WebGL shader of a distant, abstract spiral galaxy viewed from a top-down perspective. The galaxy should be composed of thousands of minuscule, soft white and dark violet points of light. Apply a very slow, subtle sinusoidal pulse to the overall opacity and rotation of the galaxy, mimicking a slow 'breathing' rhythm (about 6 seconds per cycle). For mouse interaction, the cursor should emit a very faint, soft-edged spotlight that illuminates the space dust slightly more as it passes over, giving a sense of depth and discovery. Keep the overall brightness very low."

**Why it works:** Tying the animation to a slow respiratory rhythm (4-6 seconds) has a literal psychological calming effect on the user.

### **6\. Interactive Constellation Web**

**The Prompt:**

"Create a shader background featuring a dark cosmic void with a few very faint, slowly drifting stars. When the cursor moves, it connects the nearest stars to the mouse position, and to each other, with very thin, low-opacity, soft-glowing lines, creating an interactive 'constellation' web. The lines should fade in and out very smoothly using distance-based alpha blending. The background color should be a rich, deep midnight blue (\#0a0a1a). Avoid any sharp geometric snapping; the connections should feel elastic and fluid."

**Why it works:** It feels incredibly responsive and 3D, but the minimal amount of moving elements prevents visual clutter.

### **7\. Slow-Motion Stardust Snow**

**The Prompt:**

"Write a GLSL shader that mimics drifting stardust moving toward the viewer in a 3D space, similar to traveling through a starfield, but at an extremely slow, relaxing speed. The stars should be varying shades of dim gray, soft white, and faint gold. As they get closer to the 'camera', they should gently fade out rather than snapping off-screen. The mouse interaction should gently push the stars away from the center of the cursor with a wide, soft radius, creating a tunnel effect as the user moves their mouse. Ensure all edges are blurred using smoothstep."

**Why it works:** Moving through space gives infinite depth. The key here is the *slow speed* instruction, preventing the "warp speed" strobe effect.

### **8\. Magnetic Nebula Strands**

**The Prompt:**

"Generate a shader featuring abstract, softly glowing magnetic field lines in deep space. The lines should look like wispy, auroral nebula strands in very dark, muted cyan and indigo tones. They should wave and undulate incredibly slowly based on fractional Brownian motion (fBm). The cursor should act as a magnetic pole; as it moves, the strands should slowly bend and stretch toward the cursor, but with significant drag and delay so the motion feels heavy and majestic. The overall lighting must remain dim and ambient."

**Why it works:** Auroral movements are naturally soothing. The drag/delay on the cursor interaction prevents jerky, headache-inducing snaps.

### **9\. Depth-of-Field Star Clusters**

**The Prompt:**

"Create a WebGL shader of a dense star cluster with a strong depth-of-field effect. There should be a distinct focal plane: stars in the midground are tiny and sharp, while stars in the deep background and extreme foreground are rendered as large, out-of-focus, soft bokeh circles. The stars should twinkle very slowly (shifting opacity over a few seconds). The mouse movement should subtly shift the focal plane, bringing different layers of stars into sharp focus while blurring the others, simulating a camera lens adjusting in 3D space."

**Why it works:** Bokeh (out-of-focus blur) is inherently soft and cinematic. Shifting focus is a brilliant way to show 3D depth without actually moving objects around the screen.

### **10\. The Quantum Void**

**The Prompt:**

"Write a minimalist GLSL shader for an ultra-dark theme. The background is a pure, abyssal black. There are no distinct stars, but rather a soft, cellular noise pattern that creates a subtle, shifting 'texture' to the dark space, like viewing dark matter. The mouse interaction should be the primary light source: a soft, wide, extremely dim, deep purple ambient glow that follows the cursor, illuminating the dark matter texture beneath it. The glow should have a long fading trail as the mouse moves, like a phantom light in deep space."

**Why it works:** This is the ultimate low-distraction background. It relies entirely on negative space and extremely subtle lighting to create an atmosphere of immense depth.

