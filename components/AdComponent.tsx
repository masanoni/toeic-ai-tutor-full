import React from 'react';

const AdComponent: React.FC = () => {
    // This container will be populated by the ad scripts in index.html.
    // The specific ad script (e.g., admax) will find this location.
    return (
        <div id="ad-container-shinobi" className="w-full max-w-2xl mx-auto my-4 text-center">
            {/* Ad script from index.html will target this area */}
        </div>
    );
};

export default AdComponent;
