import { useState, useEffect, useCallback, useRef } from 'react';

// Custom error to distinguish intentional cancellation from other errors.
export class SpeechCancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpeechCancellationError';
  }
}

export const useTextToSpeech = () => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    // Eagerly load voices
    useEffect(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.getVoices();
        }
    }, []);
    
    // Cleanup function to stop speech when the component unmounts
    useEffect(() => {
        return () => {
            if (typeof window !== 'undefined' && window.speechSynthesis) {
                // Remove reference to avoid memory leaks
                if (utteranceRef.current) {
                    utteranceRef.current.onend = null;
                    utteranceRef.current.onerror = null;
                    utteranceRef.current.onstart = null;
                }
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    const speak = useCallback((text: string, lang: 'en-US' | 'ja-JP'): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (!text || typeof window === 'undefined' || !window.speechSynthesis) {
                return resolve();
            }

            const speakLogic = () => {
                const allVoices = window.speechSynthesis.getVoices();
                let voice: SpeechSynthesisVoice | undefined;
                const langPrefix = lang.split('-')[0];

                // Prioritize specific, high-quality voices if available for better pronunciation.
                if (lang === 'en-US') {
                    const preferredEnVoices = [
                        // Premium macOS voice
                        'Alex',
                        // Modern Google voices (Chrome/Android)
                        'Google US English',
                        // Modern Microsoft voices (Windows/Edge)
                        'Microsoft David - English (United States)', 
                        'Microsoft Mark - English (United States)',
                        'Microsoft Zira - English (United States)',
                        // Standard Apple voices
                        'Samantha',
                    ];
                    voice = allVoices.find(v => preferredEnVoices.includes(v.name) && v.lang === 'en-US');
                } else if (lang === 'ja-JP') {
                    const preferredJpVoices = [
                        // Modern Google voice
                        'Google 日本語',
                        // Apple voices
                        'Kyoko', // Standard
                        'Otoya', // Enhanced
                        // Modern Microsoft voices
                        'Microsoft Haruka - Japanese (Japan)',
                        'Microsoft Ayumi - Japanese (Japan)',
                    ];
                    voice = allVoices.find(v => preferredJpVoices.includes(v.name) && v.lang === 'ja-JP');
                }
                
                // Fallback 1: Find a default voice for the exact language
                if (!voice) {
                    voice = allVoices.find(v => v.lang === lang && v.default);
                }
                
                // Fallback 2: Find any voice for the exact language
                if (!voice) {
                    voice = allVoices.find(v => v.lang === lang);
                }
                
                // Fallback 3: Find any voice for the base language (e.g., 'en' for 'en-US')
                if (!voice) {
                    voice = allVoices.find(v => v.lang.startsWith(langPrefix));
                }

                window.speechSynthesis.cancel(); 
                const utterance = new SpeechSynthesisUtterance(text);
                utteranceRef.current = utterance;
                utterance.lang = lang; 

                if (voice) {
                    utterance.voice = voice;
                } else {
                    console.warn(`No specific voice found for lang '${lang}'. Attempting to use browser default.`);
                }
                
                // Slightly reduce rate for clarity, which helps with pronunciation for learners.
                utterance.rate = 0.9;
                utterance.pitch = 1;

                utterance.onstart = () => setIsSpeaking(true);
                
                utterance.onend = () => {
                    utteranceRef.current = null;
                    setIsSpeaking(false);
                    resolve();
                };

                utterance.onerror = (event) => {
                    utteranceRef.current = null;
                    setIsSpeaking(false);
                    if (event.error === 'canceled' || event.error === 'interrupted') {
                        reject(new SpeechCancellationError('Speech was cancelled'));
                    } else {
                        console.error('SpeechSynthesisUtterance.onerror', event);
                        reject(new Error(`Speech synthesis error: ${event.error}`));
                    }
                };

                window.speechSynthesis.speak(utterance);
            };

            const voices = window.speechSynthesis.getVoices();
            if (voices.length === 0 && 'onvoiceschanged' in window.speechSynthesis) {
                window.speechSynthesis.addEventListener('voiceschanged', speakLogic, { once: true });
            } else {
                speakLogic();
            }
        });
    }, []);

    const stop = useCallback(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    }, []);

    return { speak, stop, isSpeaking };
};
