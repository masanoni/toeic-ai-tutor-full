
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
import { addVocabularyItems } from '../db';
import ManualIcon from '../components/icons/ManualIcon';
import AdComponent from '../components/AdComponent';


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
  onViewWordList: () => void;
  onImportJson: () => Promise<any>;
  isDbReady: boolean;
  isAiReady: boolean;
  onOpenApiKeyModal: () => void;
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
    onViewWordList,
    onImportJson,
    isDbReady,
    isAiReady,
    onOpenApiKeyModal
}) => {
  const [selectedLevel, setSelectedLevel] = useState<Level>(Level.Beginner);
  const [showAdminButton, setShowAdminButton] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true') {
        setShowAdminButton(true);
    }
  }, []);

  const handleAdminClick = () => {
    const password = prompt("管理者パスワードを入力してください:");
    if (password === "bKDP2b") {
        onGoToAdmin();
    } else if (password !== null) { // Don't alert if user cancels
        alert("パスワードが違います。");
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
            alert('無効なJSON形式です。"vocabulary"というキーの配列を持つオブジェクトが必要です。');
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
            alert('ファイル内に有効な語彙項目が見つかりませんでした。');
            return;
        }

        const addedCount = await addVocabularyItems(validatedItems);
        alert(`${addedCount}件の新しい単語をインポートしました。${validatedItems.length - addedCount}件の重複はスキップされました。`);
        await onImportJson();

      } catch (error) {
        console.error(`Error importing JSON:`, error);
        alert(`JSONのインポートに失敗しました。ファイル形式を確認し、コンソールでエラーを確認してください。`);
      } finally {
        if(fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };
    
  const dbDisabledTitle = isInitializing 
    ? "初期化が完了するまでお待ちください。" 
    : "このモードを有効にするには、単語管理から単語をインポートしてください。";
    
  const aiDisabledTitle = isInitializing
    ? "初期化が完了するまでお待ちください。"
    : !isAiReady 
    ? "AI機能を使用するにはAPIキーの設定が必要です。右上の設定ボタンからキーを入力してください。"
    : "";


  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4">
      <div className="w-full max-w-2xl">
        <div className="w-full flex justify-end mb-4 gap-2">
            <button 
                onClick={onGoToUserManual}
                className="bg-white text-slate-600 font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-slate-100 transition flex items-center gap-2 border border-slate-200"
            >
                <ManualIcon className="w-5 h-5"/>
                ユーザーマニュアル
            </button>
            <button 
                onClick={onOpenApiKeyModal}
                className="bg-white text-slate-600 p-2 rounded-lg shadow-md hover:bg-slate-100 transition flex items-center border border-slate-200"
                aria-label="APIキー設定"
            >
                <SettingsIcon className="w-6 h-6"/>
            </button>
        </div>
        <div className="w-full text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-2">TOEIC AI Tutor</h1>
          <p className="text-lg text-slate-600 mb-8">あなたのパーソナルAI学習パートナー</p>
          
          <div className="relative">
            <div className={`bg-white p-6 md:p-8 rounded-2xl shadow-lg w-full mb-8`}>
              <div className="mb-6">
                <label htmlFor="level-select" className="block text-xl font-medium text-slate-700 mb-3">
                  1. レベルを選択
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
                <h2 className="text-xl font-medium text-slate-700 mb-4">2. 学習モードを選択</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <button onClick={() => onStartVocabulary(selectedLevel)} className="md:col-span-1 bg-blue-600 text-white font-bold py-3 px-4 rounded-lg text-base hover:bg-blue-700 transition-transform transform hover:scale-105 shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1" disabled={!isDbReady} title={!isDbReady ? dbDisabledTitle : ''}><LayersIcon className="w-7 h-7 mb-1"/>単語学習</button>
                  <button onClick={() => onStartDrive(selectedLevel)} className="md:col-span-1 bg-sky-500 text-white font-bold py-3 px-4 rounded-lg text-base hover:bg-sky-600 transition-transform transform hover:scale-105 shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1" disabled={!isDbReady} title={!isDbReady ? dbDisabledTitle : ''}><CarIcon className="w-7 h-7 mb-1"/>ドライブ学習</button>
                  <button onClick={onStartBasicGrammar} className="md:col-span-1 bg-rose-500 text-white font-bold py-3 px-4 rounded-lg text-base hover:bg-rose-600 transition-transform transform hover:scale-105 shadow-md flex flex-col items-center justify-center gap-1 disabled:bg-slate-400 disabled:cursor-not-allowed" disabled={!isAiReady} title={aiDisabledTitle}><BookIcon className="w-7 h-7 mb-1"/>基礎文法</button>
                  
                  <button onClick={() => onStartListening(selectedLevel)} className="md:col-span-1 bg-teal-500 text-white font-bold py-3 px-4 rounded-lg text-base hover:bg-teal-600 transition-transform transform hover:scale-105 shadow-md flex flex-col items-center justify-center gap-1 disabled:bg-slate-400 disabled:cursor-not-allowed" disabled={!isAiReady} title={aiDisabledTitle}><HeadphoneIcon className="w-7 h-7 mb-1"/>リスニング</button>
                  <button onClick={() => onStartPart5(selectedLevel)} className="md:col-span-1 bg-amber-500 text-white font-bold py-3 px-4 rounded-lg text-base hover:bg-amber-600 transition-transform transform hover:scale-105 shadow-md flex flex-col items-center justify-center gap-1 disabled:bg-slate-400 disabled:cursor-not-allowed" disabled={!isAiReady} title={aiDisabledTitle}><SentenceCompletionIcon className="w-7 h-7 mb-1"/>Part 5</button>
                  <button onClick={() => onStartPart6(selectedLevel)} className="md:col-span-1 bg-orange-500 text-white font-bold py-3 px-4 rounded-lg text-base hover:bg-orange-600 transition-transform transform hover:scale-105 shadow-md flex flex-col items-center justify-center gap-1 disabled:bg-slate-400 disabled:cursor-not-allowed" disabled={!isAiReady} title={aiDisabledTitle}><TextCompletionIcon className="w-7 h-7 mb-1"/>Part 6</button>
                  
                  <button onClick={() => onStartReading(selectedLevel)} className="md:col-span-1 bg-violet-500 text-white font-bold py-3 px-4 rounded-lg text-base hover:bg-violet-600 transition-transform transform hover:scale-105 shadow-md flex flex-col items-center justify-center gap-1 disabled:bg-slate-400 disabled:cursor-not-allowed" disabled={!isAiReady} title={aiDisabledTitle}><BookOpenIcon className="w-7 h-7 mb-1"/>Part 7</button>
                  <button onClick={onStartGrammarCheck} className="md:col-span-2 bg-emerald-500 text-white font-bold py-3 px-4 rounded-lg text-base hover:bg-emerald-600 transition-transform transform hover:scale-105 shadow-md flex flex-col items-center justify-center gap-1 disabled:bg-slate-400 disabled:cursor-not-allowed" disabled={!isAiReady} title={aiDisabledTitle}><SpellCheckIcon className="w-7 h-7 mb-1"/>AI文法チェック</button>
                </div>
              </div>
            </div>

            <div className={`bg-white p-6 md:p-8 rounded-2xl shadow-lg w-full mb-8`}>
                <div className="flex justify-between items-baseline mb-4">
                  <h2 className="text-xl font-bold text-slate-700">単語管理</h2>
                  <a
                      href="https://note.com/degu_masa/n/nf13fc397a9b2"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                      データセットの購入はこちら &rarr;
                  </a>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                        onClick={onViewWordList}
                        className="bg-slate-600 text-white font-bold py-3 px-6 rounded-lg text-lg hover:bg-slate-700 transition shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed"
                        disabled={!isDbReady}
                        title={!isDbReady ? dbDisabledTitle : ""}
                    >
                        単語リストの閲覧
                    </button>
                    <label className={`text-white font-bold py-3 px-6 rounded-lg text-lg text-center transition shadow-md flex items-center justify-center ${isInitializing ? 'bg-slate-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 cursor-pointer'}`}>
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
          </div>
          
          {isInitializing && (
            <div className="bg-white p-6 rounded-2xl shadow-lg w-full mb-8">
                <h2 className="text-xl font-bold text-slate-700 mb-2">データベースの状態</h2>
                <p className="text-blue-600 bg-blue-100 p-3 rounded-md">{initStatus}</p>
            </div>
          )}
          
          {showAdminButton && (
            <div className="mt-8">
                <button
                    onClick={handleAdminClick}
                    className="bg-slate-800 text-white font-mono py-2 px-4 rounded-lg hover:bg-slate-900 transition"
                >
                    &gt; 管理者パネルへ
                </button>
            </div>
          )}
        </div>
      </div>
      <AdComponent />
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
