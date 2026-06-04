import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';

export function PerimeterHalo({ onTrigger }: { onTrigger: () => void }) {
    const orbRef = useRef<HTMLDivElement>(null);
    const [isActive, setIsActive] = useState(false);
    
    useEffect(() => {
        // Orbit animation along the viewport edges
        const tl = gsap.timeline({ repeat: -1, defaults: { ease: "none" } });
        
        const w = window.innerWidth;
        const h = window.innerHeight;
        const offset = 20; // hide half the orb behind the bezel
        
        tl.to(orbRef.current, { x: w + offset, duration: 4 })
          .to(orbRef.current, { y: h + offset, duration: 3 })
          .to(orbRef.current, { x: -offset, duration: 4 })
          .to(orbRef.current, { y: -offset, duration: 3 });

        // Simulate incoming network/P2P event occasionally to test ambient interaction
        const sim = setInterval(() => {
            setIsActive(true);
            gsap.to(orbRef.current, {
                scale: 2.5,
                boxShadow: '0 0 40px 20px rgba(124, 58, 237, 0.6)',
                duration: 0.8,
                ease: 'elastic.out(1, 0.3)'
            });
            setTimeout(() => setIsActive(false), 5000);
        }, 15000);

        return () => {
            tl.kill();
            clearInterval(sim);
        };
    }, []);

    const handleClick = () => {
        if (!isActive) return;
        setIsActive(false);
        gsap.to(orbRef.current, {
            scale: 1,
            boxShadow: '0 0 15px 5px rgba(124, 58, 237, 0.4)',
            duration: 0.3
        });
        onTrigger();
    };

    return (
        <div 
            ref={orbRef}
            onClick={handleClick}
            className="fixed top-0 left-0 z-50 pointer-events-auto cursor-pointer"
            style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'radial-gradient(circle at center, #c4b5fd, #7c3aed)',
                boxShadow: '0 0 15px 5px rgba(124, 58, 237, 0.4)',
                transform: 'translate(-20px, -20px)',
                filter: 'blur(2px)',
                opacity: isActive ? 1 : 0.6,
                transition: 'opacity 0.3s'
            }}
        />
    );
}
