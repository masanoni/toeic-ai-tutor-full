import React, { useState, useEffect } from 'react';

const AdComponent: React.FC = () => {
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Check for iOS PWA standalone mode
        const isIosPwa = ('standalone' in window.navigator) && (window.navigator as any).standalone;
        // A more modern check that also works on Android
        const isModernPwa = window.matchMedia('(display-mode: standalone)').matches;

        if (isIosPwa || isModernPwa) {
            setIsStandalone(true);
        }
    }, []);

    if (isStandalone) {
        return (
            <div className="w-full max-w-2xl mx-auto my-6 text-center">
                <div className="bg-slate-800 text-white p-4 rounded-xl shadow-md text-sm">
                    <p className="font-semibold">アプリのご利用ありがとうございます！</p>
                    <p className="mt-1">
                        アプリ版（ホーム画面に追加した場合）では、OSの仕様により広告が表示されません。
                    </p>
                    <p className="mt-2">
                        もしこのアプリを応援してくださる方は、データセットの購入をご検討いただけますと幸いです。
                    </p>
                    <a
                        href="https://note.com/degu_masa/n/nf13fc397a9b2"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-3 bg-blue-500 hover:bg-blue-400 text-white font-bold py-2 px-4 rounded-lg text-sm"
                    >
                        データセット購入ページへ
                    </a>
                </div>
            </div>
        );
    }

    // This container will be populated by the ad scripts in index.html when in browser mode.
    // The specific ad script (e.g., admax) will find this location.
    return (
        <div id="ad-container-shinobi" className="w-full max-w-2xl mx-auto my-4 text-center">
            {/* Ad script from index.html will target this area */}
        </div>
    );
};

export default AdComponent;