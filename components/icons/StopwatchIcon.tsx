
import React from 'react';

const StopwatchIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className={className}
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    >
        <circle cx="12" cy="13" r="8"></circle>
        <polyline points="12 9 12 13 15 14"></polyline>
        <line x1="12" y1="2" x2="12" y2="5"></line>
        <line x1="18" y1="5" x2="16" y2="7"></line>
        <line x1="6" y1="5" x2="8" y2="7"></line>
    </svg>
);

export default StopwatchIcon;
