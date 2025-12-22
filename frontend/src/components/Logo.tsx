import React from 'react';

const Logo = () => {
    return (
        <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <radialGradient id="grad1" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                    <stop offset="0%" stopColor="#0A0A2A" />
                    <stop offset="100%" stopColor="#000033" />
                </radialGradient>
                <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00FFFF" />
                    <stop offset="100%" stopColor="#FF00FF" />
                </linearGradient>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Background Orb */}
            <circle cx="50" cy="50" r="40" fill="url(#grad1)" stroke="url(#neonGrad)" strokeWidth="2" />

            {/* Eclipsing Rings */}
            <path d="M50 10 A40 40 0 0 1 50 90" stroke="#00FFFF" strokeWidth="4" strokeLinecap="round" filter="url(#glow)">
                <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="10s" repeatCount="indefinite" />
            </path>
            <path d="M50 20 A30 30 0 0 0 50 80" stroke="#FF00FF" strokeWidth="3" strokeLinecap="round" filter="url(#glow)">
                <animateTransform attributeName="transform" type="rotate" from="360 50 50" to="0 50 50" dur="15s" repeatCount="indefinite" />
            </path>

            {/* Central Eye/Lens */}
            <circle cx="50" cy="50" r="15" fill="#000" stroke="white" strokeWidth="1" opacity="0.8">
                <animate attributeName="r" values="15;17;15" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle cx="50" cy="50" r="8" fill="#00FFFF" opacity="0.6" filter="url(#glow)" />
        </svg>
    );
};

export default Logo;
