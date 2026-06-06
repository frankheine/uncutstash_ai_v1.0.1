import React from 'react';

// Highly-stylized, procedural SVG logos constructed without external image assets.
// Designed with separate path nodes to allow GSAP staggered stroke drawing and fills.

export function UncutStashLogo({ className = "w-32 h-32" }: { className?: string }) {
  return (
    <svg 
      className={`procedural-logo uncut-logo ${className}`}
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="uncut-glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="50%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <filter id="neon-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* The abstract 'U' and 'S' interlocked geometry */}
      <path 
        className="logo-track"
        d="M20,30 L20,70 C20,85 40,85 40,70 L40,40 C40,25 60,25 60,40 L60,80" 
        stroke="url(#uncut-glow)" 
        strokeWidth="6" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        filter="url(#neon-blur)"
      />
      
      {/* Precision cut lines representing 'UNCUT' */}
      <line x1="10" y1="50" x2="90" y2="50" stroke="#ffffff" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
      <circle cx="50" cy="50" r="40" stroke="url(#uncut-glow)" strokeWidth="1" opacity="0.5" strokeDasharray="1 10" />
      
      {/* Typographical Mark */}
      <text x="50" y="95" fontFamily="monospace" fontSize="8" fill="#ffffff" fontWeight="bold" textAnchor="middle" letterSpacing="2">
        UNCUTstash
      </text>
    </svg>
  );
}

export function DataCartelLogo({ className = "w-32 h-32" }: { className?: string }) {
  return (
    <svg 
      className={`procedural-logo cartel-logo ${className}`}
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="cartel-glow" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="50%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#facc15" />
        </linearGradient>
      </defs>

      {/* Hexagonal data node structure representing a 'Cartel' network */}
      <polygon 
        points="50,10 85,30 85,70 50,90 15,70 15,30" 
        stroke="url(#cartel-glow)" 
        strokeWidth="2" 
        fill="rgba(244, 63, 94, 0.05)"
      />
      
      {/* Inner Data Flow Triangle representing 'D' and 'C' integration */}
      <path 
        d="M50,25 L70,60 L30,60 Z" 
        stroke="#ffffff" 
        strokeWidth="2" 
        strokeLinejoin="round"
      />
      
      <circle cx="50" cy="25" r="4" fill="#ffffff" />
      <circle cx="70" cy="60" r="4" fill="#ffffff" />
      <circle cx="30" cy="60" r="4" fill="#ffffff" />
      
      {/* Connection Lines */}
      <line x1="50" y1="25" x2="50" y2="45" stroke="#f43f5e" strokeWidth="2" opacity="0.8" />
      
      {/* Typographical Mark */}
      <text x="50" y="105" fontFamily="monospace" fontSize="7" fill="#ffffff" fontWeight="bold" textAnchor="middle" letterSpacing="1">
        DATAcartel Collective
      </text>
    </svg>
  );
}
