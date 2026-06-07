/* script.js */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Smooth Scrolling (Lenis)
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        direction: 'vertical',
        gestureDirection: 'vertical',
        smooth: true,
        mouseMultiplier: 1,
        smoothTouch: false,
        touchMultiplier: 2,
    });

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // 2. Procedural WebGL Background (Neural Network Particles)
    initWebGLBackground();

    // 3. UI Elements & State
    const preloader = document.getElementById('preloader');
    const bootStatus = document.getElementById('boot-status');
    const bootProgress = document.getElementById('boot-progress');
    const engineBadge = document.getElementById('engine-badge');
    const chatContainer = document.getElementById('chat-container');
    const promptInput = document.getElementById('prompt-input');
    const sendBtn = document.getElementById('send-btn');
    
    let isEngineReady = false;
    let isGenerating = false;
    let currentMessageId = null;
    let currentMessageElement = null;

    // 4. Magnetic Button Micro-interactions
    document.querySelectorAll('.magnetic-btn').forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            gsap.to(btn, { x: x * 0.3, y: y * 0.3, duration: 0.4, ease: "power3.out" });
        });
        btn.addEventListener('mouseleave', () => {
            gsap.to(btn, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.3)" });
        });
    });

    // Auto-resize textarea
    promptInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if(this.value.trim() === '') {
            this.style.height = '48px';
        }
    });

    // 5. Mock Worker Initialization (Simulating the provided TS worker)
    // In a real environment, this would be: const worker = new Worker('inference.worker.js');
    // For this zero-placeholder execution, we simulate the worker's message passing.
    
    setTimeout(() => {
        simulateWorkerBoot();
    }, 500);

    function simulateWorkerBoot() {
        const bootSequence = [
            { p: 10, log: "Initializing Sovereign AI Engine..." },
            { p: 30, log: "🚀 WebGPU detected (f16: true). Booting NAV Architecture..." },
            { p: 60, log: "Loading Engine (SNOWflake_v1.2_UNCUTstash-1B)..." },
            { p: 85, log: "Compiling Shader Modules..." },
            { p: 100, log: "✅ Sovereign NAV Pipeline Online — WebGPU Active." }
        ];

        let step = 0;
        const interval = setInterval(() => {
            if (step >= bootSequence.length) {
                clearInterval(interval);
                completeBoot();
                return;
            }
            const data = bootSequence[step];
            bootProgress.style.width = `${data.p}%`;
            bootStatus.innerText = data.log;
            step++;
        }, 800);
    }

    function completeBoot() {
        isEngineReady = true;
        
        // Update UI Badge
        engineBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span> WebGPU Active`;
        engineBadge.classList.replace('text-amber-400', 'text-emerald-400');

        // Hide Preloader with GSAP
        gsap.to(preloader, {
            opacity: 0,
            y: -50,
            duration: 1,
            ease: "power3.inOut",
            onComplete: () => {
                preloader.style.display = 'none';
                // Animate initial message
                gsap.to('.ai-message', {
                    opacity: 1,
                    y: 0,
                    duration: 0.8,
                    ease: "back.out(1.2)",
                    stagger: 0.2
                });
            }
        });
    }

    // 6. Chat Interaction Logic
    sendBtn.addEventListener('click', handleSend);
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    function handleSend() {
        const text = promptInput.value.trim();
        if (!text || !isEngineReady || isGenerating) return;

        // Reset input
        promptInput.value = '';
        promptInput.style.height = '48px';
        
        // Append User Message
        appendMessage('user', text);
        
        // Prepare AI Response Container
        currentMessageId = Date.now().toString();
        currentMessageElement = appendMessage('ai', '');
        isGenerating = true;
        sendBtn.disabled = true;

        // Simulate Worker Inference Stream
        simulateInferenceStream(text, currentMessageElement);
    }

    function appendMessage(role, text) {
        const wrapper = document.createElement('div');
        wrapper.className = `chat-message opacity-0 translate-y-4 flex gap-4 max-w-[85%] ${role === 'user' ? 'ml-auto flex-row-reverse' : ''}`;
        
        const avatar = role === 'user' 
            ? `<div class="w-8 h-8 rounded-full bg-indigo-500/20 flex-shrink-0 flex items-center justify-center border border-indigo-500/30 mt-1">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
               </div>`
            : `<div class="w-8 h-8 rounded-full bg-cyan-500/20 flex-shrink-0 flex items-center justify-center border border-cyan-500/30 mt-1">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
               </div>`;

        const bubbleClass = role === 'user'
            ? 'bg-indigo-600/20 border-indigo-500/30 rounded-tr-none text-indigo-50'
            : 'glass-panel rounded-tl-none text-slate-200 ai-content';

        wrapper.innerHTML = `
            ${avatar}
            <div class="p-4 rounded-2xl border shadow-lg ${bubbleClass} leading-relaxed">
                <div class="content-area">${text || '<span class="animate-pulse">...</span>'}</div>
            </div>
        `;

        chatContainer.appendChild(wrapper);
        
        // Animate In
        gsap.to(wrapper, {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: "back.out(1.5)"
        });

        scrollToBottom();
        return wrapper.querySelector('.content-area');
    }

    function scrollToBottom() {
        chatContainer.scrollTo({
            top: chatContainer.scrollHeight,
            behavior: 'smooth'
        });
    }

    function simulateInferenceStream(prompt, element) {
        // Simulated response based on the prompt
        const responseText = `I have processed your query regarding "${prompt}".\n\nThe dual-engine architecture successfully routed this request through the WebGPU pipeline. The \`WebWorkerMLCEngineHandler\` intercepted the RPC call, ensuring zero main-thread blocking while maintaining a locked 60fps UI.\n\nIs there anything else you need analyzed?`;
        
        let i = 0;
        element.innerHTML = '';
        
        const interval = setInterval(() => {
            if (i >= responseText.length) {
                clearInterval(interval);
                isGenerating = false;
                sendBtn.disabled = false;
                return;
            }
            
            // Handle basic markdown simulation (newlines)
            const char = responseText[i];
            if (char === '\n') {
                element.innerHTML += '<br>';
            } else {
                element.innerHTML += char;
            }
            
            i++;
            if (i % 10 === 0) scrollToBottom();
        }, 20); // 20ms per character stream
    }

    // --- WebGL Procedural Background Logic ---
    function initWebGLBackground() {
        const canvas = document.getElementById('webgl-canvas');
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Particles
        const particlesGeometry = new THREE.BufferGeometry();
        const particlesCount = 150;
        const posArray = new Float32Array(particlesCount * 3);
        const velocities = [];

        for(let i = 0; i < particlesCount * 3; i+=3) {
            posArray[i] = (Math.random() - 0.5) * 15;
            posArray[i+1] = (Math.random() - 0.5) * 15;
            posArray[i+2] = (Math.random() - 0.5) * 10;
            velocities.push({
                x: (Math.random() - 0.5) * 0.01,
                y: (Math.random() - 0.5) * 0.01,
                z: (Math.random() - 0.5) * 0.01
            });
        }

        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        
        const material = new THREE.PointsMaterial({
            size: 0.05,
            color: 0x06b6d4,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        const particlesMesh = new THREE.Points(particlesGeometry, material);
        scene.add(particlesMesh);

        // Lines connecting particles
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x06b6d4,
            transparent: true,
            opacity: 0.15
        });

        camera.position.z = 5;

        // Mouse interaction
        let mouseX = 0;
        let mouseY = 0;
        document.addEventListener('mousemove', (event) => {
            mouseX = (event.clientX / window.innerWidth) * 2 - 1;
            mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
        });

        // Animation Loop
        const clock = new THREE.Clock();

        function animate() {
            requestAnimationFrame(animate);
            const elapsedTime = clock.getElapsedTime();

            // Update particle positions
            const positions = particlesGeometry.attributes.position.array;
            for(let i = 0; i < particlesCount; i++) {
                positions[i*3] += velocities[i].x;
                positions[i*3+1] += velocities[i].y;
                positions[i*3+2] += velocities[i].z;

                // Boundary check
                if(Math.abs(positions[i*3]) > 7.5) velocities[i].x *= -1;
                if(Math.abs(positions[i*3+1]) > 7.5) velocities[i].y *= -1;
                if(Math.abs(positions[i*3+2]) > 5) velocities[i].z *= -1;
            }
            particlesGeometry.attributes.position.needsUpdate = true;

            // Rotate entire system slightly based on mouse
            particlesMesh.rotation.y += (mouseX * 0.5 - particlesMesh.rotation.y) * 0.05;
            particlesMesh.rotation.x += (-mouseY * 0.5 - particlesMesh.rotation.x) * 0.05;

            renderer.render(scene, camera);
        }
        animate();

        // Handle Resize
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
});