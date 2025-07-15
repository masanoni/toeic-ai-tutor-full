import React, { useState, useEffect, useRef } from 'react';
import { Level, VocabDBItem, PartOfSpeech } from '../types';
import { GENERATOR_LEVELS, ALL_LEVELS } from '../constants';
import CarIcon from '../components/icons/CarIcon';
import HeadphoneIcon from '../components/icons/HeadphoneIcon';
import SentenceCompletionIcon from '../components/icons/SentenceCompletionIcon';
import TextCompletionIcon from '../components/icons/TextCompletionIcon';
import BookIcon from '../components/icons/BookIcon';
import BookOpenIcon from '../components/icons/BookOpenIcon';
import LayersIcon from '../components/icons/LayersIcon';
import SpellCheckIcon from '../components/icons/SpellCheckIcon';
import SettingsIcon from '../components/icons/SettingsIcon';
import InstallPwaInstructions from '../components/InstallPwaInstructions';
import { setApiKey as setGeminiApiKey } from '../services/geminiService';
import { addVocabularyItems } from '../db';
import ManualIcon from '../components/icons/ManualIcon';


interface HomeScreenProps {
  onStartVocabulary: (level: Level) => void;
  onStartReading: (level: Level) => void;
  onStartDrive: (level: Level) => void;
  onStartListening: (level: Level) => void;
  onStartPart5: (level: Level) => void;
  onStartPart6: (level: Level) => void;
  onStartBasicGrammar: () => void;
  onStartGrammarCheck: () => void;
  onGoToAdmin: () => void;
  onGoToUserManual: () => void;
  dbWordCount: number;
  isInitializing: boolean;
  initStatus: string;
  isApiKeySet: boolean;
  onApiKeyUpdate: (isSet: boolean) => void;
  onViewWordList: () => void;
  onImportJson: () => Promise<any>;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ 
    onStartVocabulary, 
    onStartReading, 
    onStartDrive, 
    onStartListening,
    onStartPart5,
    onStartPart6,
    onStartBasicGrammar,
    onStartGrammarCheck,
    onGoToAdmin,
    onGoToUserManual,
    dbWordCount, 
    isInitializing, 
    initStatus,
    isApiKeySet,
    onApiKeyUpdate,
    onViewWordList,
    onImportJson
}) => {
  const [selectedLevel, setSelectedLevel] = useState<Level>(Level.Beginner);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState('');
  const [showApiKeySetup, setShowApiKeySetup] = useState(false);
  const [showAdminButton, setShowAdminButton] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true') {
        setShowAdminButton(true);
    }
  }, []);

  useEffect(() => {
    const key = localStorage.getItem('gemini-api-key');
    if (key) {
      setApiKeyInput(key);
    }
  }, []);

  const handleSaveApiKey = () => {
    if (!apiKeyInput.trim()) {
        setApiKeyStatus('API Key cannot be empty.');
        setTimeout(() => setApiKeyStatus(''), 3000);
        return;
    }
    localStorage.setItem('gemini-api-key', apiKeyInput);
    setGeminiApiKey(apiKeyInput);
    onApiKeyUpdate(true);
    setApiKeyStatus('API Key saved successfully!');
    setShowApiKeySetup(false); // Hide setup on save
    setTimeout(() => setApiKeyStatus(''), 3000);
  };
  
  const handleClearApiKey = () => {
      localStorage.removeItem('gemini-api-key');
      setGeminiApiKey('');
      onApiKeyUpdate(false);
      setApiKeyInput('');
      setShowApiKeySetup(true); // Show setup when cleared
      setApiKeyStatus('API Key cleared.');
      setTimeout(() => setApiKeyStatus(''), 3000);
  };

  const handleAdminClick = () => {
    const password = prompt("Enter admin password:");
    if (password === "bKDP2b") {
        onGoToAdmin();
    } else if (password !== null) { // Don't alert if user cancels
        alert("Incorrect password.");
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error("File could not be read");
        const data = JSON.parse(text);

        if (!data.vocabulary || !Array.isArray(data.vocabulary)) {
            alert('Invalid JSON format. Expected an object with a "vocabulary" array.');
            return;
        }
        
        const vocabItems: any[] = data.vocabulary;
        
        const validatedItems = vocabItems.filter((item): item is VocabDBItem => {
          if (!item.english || !item.japanese || !item.example_en || !item.example_jp || !item.level || !item.category || !item.type) {
            console.warn('Skipping item with missing core data:', item);
            return false;
          }
          if (item.type === 'word' && (!item.pos || !Object.values(PartOfSpeech).includes(item.pos as any))) {
              console.warn('Skipping word with invalid or missing POS:', item);
              return false;
          }
          return true;
        });

        if (validatedItems.length === 0) {
            alert('No valid vocabulary items found in the file.');
            return;
        }

        const addedCount = await addVocabularyItems(validatedItems);
        alert(`Imported ${addedCount} new items. ${validatedItems.length - addedCount} duplicates were skipped.`);
        await onImportJson();

      } catch (error) {
        console.error(`Error importing JSON:`, error);
        alert(`Failed to import JSON. Please check the file format and console for errors.`);
      } finally {
        if(fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const isDbReady = dbWordCount > 0 && !isInitializing;
  const isAiReady = isApiKeySet && !isInitializing;

  const dbDisabledTitle = isInitializing 
    ? "Please wait for initialization to complete." 
    : "Add vocabulary via Import JSON to enable this mode.";
    
  const aiDisabledTitle = isInitializing
    ? "Please wait for initialization to complete."
    : "Please set your Gemini API Key to use this feature.";

  const renderApiKeySection = () => {
      if (isApiKeySet && !showApiKeySetup) {
          return (
              <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg w-full mb-8 border border-slate-700 flex justify-between items-center">
                  <p className="text-slate-300">
                      <span className="font-bold text-green-400">✓</span> APIキーは設定済みです。
                  </p>
                  <button
                      onClick={() => setShowApiKeySetup(true)}
                      className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2"
                  >
                      <SettingsIcon className="w-5 h-5"/>
                      管理
                  </button>
              </div>
          );
      }
      
      return (
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg w-full mb-8 border border-slate-700">
              <h2 className="text-xl font-bold mb-3 flex items-center gap-2 justify-center">
                  API Key Setup
              </h2>
              <p className="text-slate-400 mb-4 text-sm text-center leading-relaxed">
                {isApiKeySet
                  ? 'APIキーは設定済みです。'
                  : (
                    <>
                      AI機能を利用するには、Google Gemini APIキーが必要です。
                      <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline font-semibold block my-2">
                        Google AI StudioでAPIキーを取得
                      </a>
                      取得したキーを下の入力欄に貼り付けて保存してください。キーはあなたのデバイス（ブラウザ）にのみ保存されます。
                    </>
                  )
                }
              </p>
              <div className="flex items-stretch gap-2 mb-3">
                  <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="Enter your Gemini API Key"
                      className="flex-grow p-3 border border-slate-600 bg-slate-800 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-white"
                      aria-label="API Key Input"
                  />
                  <button 
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="p-3 bg-slate-700 hover:bg-slate-600 rounded-md text-sm w-20"
                      aria-label={showApiKey ? "Hide API Key" : "Show API Key"}
                  >
                      {showApiKey ? 'Hide' : 'Show'}
                  </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                  <button 
                      onClick={handleSaveApiKey}
                      className="flex-1 bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed"
                      disabled={!apiKeyInput.trim()}
                  >
                      Save & Initialize
                  </button>
                  {isApiKeySet && (
                      <button 
                          onClick={handleClearApiKey}
                          className="flex-1 bg-rose-800 text-white font-bold py-3 px-6 rounded-lg hover:bg-rose-700 transition shadow-md"
                      >
                          Clear Key
                      </button>
                  )}
              </div>
              {apiKeyStatus && <p className="text-sm text-center mt-3 text-yellow-300">{apiKeyStatus}</p>}
          </div>
      );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4">
      <div className="w-full max-w-2xl">
        <InstallPwaInstructions />
        <div className="w-full flex justify-end mb-4">
            <button 
                onClick={onGoToUserManual}
                className="bg-white text-slate-600 font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-slate-100 transition flex items-center gap-2 border border-slate-200"
            >
                <ManualIcon className="w-5 h-5"/>
                ユーザーマニュアル
            </button>
        </div>
        <div className="w-full text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-2">TOEIC AI Tutor</h1>
          <p className="text-lg text-slate-600 mb-8">Your personal AI-powered TOEIC study partner.</p>

          {renderApiKeySection()}
          
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg w-full mb-8">
            <div className="mb-6">
              <label htmlFor="level-select" className="block text-xl font-medium text-slate-700 mb-3">
                1. Choose Your Level
              </label>
              <select
                id="level-select"
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value as Level)}
                className="w-full p-4 border border-slate-300 rounded-lg bg-slate-50 text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              >
                {GENERATOR_LEVELS.filter(l => l !== ALL_LEVELS).map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>

            <div>
              <h2 className="text-xl font-medium text-slate-700 mb-4">2. Choose Your Mode</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button onClick={() => onStartVocabulary(selectedLevel)} className="bg-blue-600 text-white font-bold py-3 px-4 rounded-lg text-base hover:bg-blue-700 transition-transform transform hover:scale-105 shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1" disabled={!isDbReady} title={!isDbReady ? dbDisabledTitle : ''}><LayersIcon className="w-7 h-7 mb-1"/>Vocabulary & Idioms</button>
                <button onClick={onStartBasicGrammar} className="bg-rose-500 text-white font-bold py-3 px-4 rounded-lg text-base hover:bg-rose-600 transition-transform transform hover:scale-105 shadow-md flex flex-col items-center justify-center gap-1 disabled:bg-slate-400 disabled:cursor-not-allowed" disabled={!isAiReady} title={!isAiReady ? aiDisabledTitle : ""}><BookIcon className="w-7 h-7 mb-1"/>基礎文法</button>
                <button onClick={onStartGrammarCheck} className="bg-emerald-500 text-white font-bold py-3 px-4 rounded-lg text-base hover:bg-emerald-600 transition-transform transform hover:scale-105 shadow-md flex flex-col items-center justify-center gap-1 disabled:bg-slate-400 disabled:cursor-not-allowed" disabled={!isAiReady} title={!isAiReady ? aiDisabledTitle : ""}><SpellCheckIcon className="w-7 h-7 mb-1"/>AI Grammar Check</button>
                <button onClick={() => onStartListening(selectedLevel)} className="bg-teal-500 text-white font-bold py-3 px-4 rounded-lg text-base hover:bg-teal-600 transition-transform transform hover:scale-105 shadow-md flex flex-col items-center justify-center gap-1 disabled:bg-slate-400 disabled:cursor-not-allowed" disabled={!isAiReady} title={!isAiReady ? aiDisabledTitle : ''}><HeadphoneIcon className="w-7 h-7 mb-1"/>Listening Practice</button>
                <button onClick={() => onStartPart5(selectedLevel)} className="bg-amber-500 text-white font-bold py-3 px-4 rounded-lg text-base hover:bg-amber-600 transition-transform transform hover:scale-105 shadow-md flex flex-col items-center justify-center gap-1 disabled:bg-slate-400 disabled:cursor-not-allowed" disabled={!isAiReady} title={!isAiReady ? aiDisabledTitle : ''}><SentenceCompletionIcon className="w-7 h-7 mb-1"/>Part 5: Completion</button>
                <button onClick={() => onStartPart6(selectedLevel)} className="bg-orange-500 text-white font-bold py-3 px-4 rounded-lg text-base hover:bg-orange-600 transition-transform transform hover:scale-105 shadow-md flex flex-col items-center justify-center gap-1 disabled:bg-slate-400 disabled:cursor-not-allowed" disabled={!isAiReady} title={!isAiReady ? aiDisabledTitle : ''}><TextCompletionIcon className="w-7 h-7 mb-1"/>Part 6: Completion</button>
                <button onClick={() => onStartReading(selectedLevel)} className="bg-violet-500 text-white font-bold py-3 px-4 rounded-lg text-base hover:bg-violet-600 transition-transform transform hover:scale-105 shadow-md flex flex-col items-center justify-center gap-1 disabled:bg-slate-400 disabled:cursor-not-allowed" disabled={!isAiReady} title={!isAiReady ? aiDisabledTitle : ''}><BookOpenIcon className="w-7 h-7 mb-1"/>Part 7: Reading</button>
                <button onClick={() => onStartDrive(selectedLevel)} className="bg-sky-500 text-white font-bold py-3 px-4 rounded-lg text-base hover:bg-sky-600 transition-transform transform hover:scale-105 shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1" disabled={!isDbReady} title={!isDbReady ? dbDisabledTitle : ''}><CarIcon className="w-7 h-7 mb-1"/>Vocabulary Drive</button>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg w-full mb-8">
              <h2 className="text-xl font-bold text-slate-700 mb-4 text-center">単語管理</h2>
              <div className="flex flex-col sm:flex-row gap-4">
                  <button
                      onClick={onViewWordList}
                      className="flex-1 bg-slate-600 text-white font-bold py-3 px-6 rounded-lg text-lg hover:bg-slate-700 transition shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed"
                      disabled={!isDbReady}
                      title={!isDbReady ? dbDisabledTitle : ""}
                  >
                      単語リストの閲覧
                  </button>
                  <label className={`flex-1 text-white font-bold py-3 px-6 rounded-lg text-lg text-center transition shadow-md ${isInitializing ? 'bg-slate-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 cursor-pointer'}`}>
                      単語・熟語のインポート
                      <input
                          type="file"
                          onChange={handleFileChange}
                          className="hidden"
                          accept=".json"
                          disabled={isInitializing}
                          ref={fileInputRef}
                      />
                  </label>
              </div>
          </div>

          {isInitializing && (
            <div className="bg-white p-6 rounded-2xl shadow-lg w-full mb-8">
                <h2 className="text-xl font-bold text-slate-700 mb-2">Database Status</h2>
                <p className="text-blue-600 bg-blue-100 p-3 rounded-md">{initStatus}</p>
            </div>
          )}
          
          {showAdminButton && (
            <div className="mt-8">
                <button
                    onClick={handleAdminClick}
                    className="bg-slate-800 text-white font-mono py-2 px-4 rounded-lg hover:bg-slate-900 transition"
                >
                    &gt; Access Admin Panel
                </button>
            </div>
          )}
        </div>
      </div>
       <footer className="w-full max-w-2xl text-center mt-auto py-6 text-slate-500 text-sm">
          <p>&copy; {new Date().getFullYear()} TOEIC AI Tutor</p>
          <a href="mailto:jenseits.von.gut1010@gmail.com" className="hover:text-blue-600 underline">
              お問い合わせ
          </a>
      </footer>
    </div>
  );
};

export default HomeScreen;