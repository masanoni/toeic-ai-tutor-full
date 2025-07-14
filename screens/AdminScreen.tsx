
import React, { useState } from 'react';
import { Level, VocabCategory, VocabType, VocabDBItem } from '../types';
import { GENERATOR_LEVELS, GENERATOR_CATEGORIES, ALL_LEVELS, ALL_CATEGORIES } from '../constants';
import LoadingSpinner from '../components/LoadingSpinner';
import { addVocabularyItems } from '../db';

interface AdminScreenProps {
  onGoHome: () => void;
  onAiCollect: (level: Level | typeof ALL_LEVELS, category: VocabCategory | typeof ALL_CATEGORIES, type: VocabType | 'all') => Promise<number>;
  dbWordCount: number;
  isInitializing: boolean;
  initStatus: string;
  isApiKeySet: boolean;
  onViewWordList: () => void;
  onImportJson: () => Promise<any>;
}

const AdminScreen: React.FC<AdminScreenProps> = ({
  onGoHome,
  onAiCollect,
  dbWordCount,
  isInitializing,
  initStatus,
  isApiKeySet,
  onViewWordList,
  onImportJson,
}) => {
  const [genLevel, setGenLevel] = useState<Level | typeof ALL_LEVELS>(ALL_LEVELS);
  const [genCategory, setGenCategory] = useState<VocabCategory | typeof ALL_CATEGORIES>(ALL_CATEGORIES);
  const [genType, setGenType] = useState<VocabType | 'all'>('word');
  const [batchCount, setBatchCount] = useState(20);
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectStatus, setCollectStatus] = useState('');
  
  const isDbReady = dbWordCount > 0 && !isInitializing;
  const dbDisabledTitle = isInitializing 
    ? "Please wait for initialization to complete." 
    : "Add vocabulary using the AI Generator or Import JSON to enable this mode.";

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, type: VocabType) => {
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
        
        const vocabItems: VocabDBItem[] = data.vocabulary.map((item: any) => ({...item, type}));
        const addedCount = await addVocabularyItems(vocabItems);
        alert(`Imported ${addedCount} new ${type}s. ${vocabItems.length - addedCount} duplicates were skipped.`);
        await onImportJson();

      } catch (error) {
        console.error(`Error importing ${type} JSON:`, error);
        alert(`Failed to import ${type} JSON. Please check the file format and console for errors.`);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleAiCollectClick = async () => {
      setIsCollecting(true);
      let totalAdded = 0;
      for (let i = 1; i <= batchCount; i++) {
        setCollectStatus(`Batch ${i}/${batchCount}: Generating new items with AI...`);
        try {
            const addedCount = await onAiCollect(genLevel, genCategory, genType);
            totalAdded += addedCount;
            setCollectStatus(`Batch ${i}/${batchCount}: Success! Added ${addedCount} new items. Total so far: ${totalAdded}`);
        } catch (error: any) {
            console.error(`AI collection failed on batch ${i}:`, error);
            const errorMessage = error.message || "An error occurred.";
            setCollectStatus(`Batch ${i}/${batchCount}: Error - ${errorMessage}. Total added before error: ${totalAdded}`);
            setIsCollecting(false);
            return;
        }
      }
      setCollectStatus(`Finished! Added a total of ${totalAdded} new items across ${batchCount} batches.`);
      setIsCollecting(false);
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
            <button onClick={onGoHome} className="text-blue-600 hover:text-blue-800">&larr; Back to Home</button>
            <h1 className="text-3xl font-bold text-slate-800">Admin Panel</h1>
            <div/>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg w-full mb-8">
            <h2 className="text-xl font-bold text-slate-700 mb-3">AI Vocabulary Generator</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 items-center">
                <select value={genLevel} onChange={e => setGenLevel(e.target.value as Level | typeof ALL_LEVELS)} className="p-2 border rounded-md bg-slate-50">
                    {GENERATOR_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <select value={genCategory} onChange={e => setGenCategory(e.target.value as VocabCategory | typeof ALL_CATEGORIES)} className="p-2 border rounded-md bg-slate-50">
                    {GENERATOR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={genType} onChange={e => setGenType(e.target.value as VocabType | 'all')} className="p-2 border rounded-md bg-slate-50">
                    <option value="word">Word</option>
                    <option value="idiom">Idiom</option>
                    <option value="all">All</option>
                </select>
                <input 
                    type="number"
                    value={batchCount}
                    onChange={(e) => setBatchCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="p-2 border rounded-md bg-slate-50"
                    title="Number of batches (75 items per batch)"
                />
            </div>
             <button onClick={handleAiCollectClick} className="w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg text-lg hover:bg-indigo-700 transition shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed" disabled={isCollecting || isInitializing || !isApiKeySet}>
                {isCollecting ? <LoadingSpinner /> : !isApiKeySet ? 'Set API Key to Generate' : `Generate ${batchCount * 75} New Items`}
            </button>
            {collectStatus && <p className="text-sm text-slate-600 mt-3">{collectStatus}</p>}
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg w-full">
            <h2 className="text-xl font-bold text-slate-700 mb-2">Database Status</h2>
            {isInitializing ? (
                <p className="text-blue-600 bg-blue-100 p-3 rounded-md">{initStatus}</p>
            ) : (
                 <p className="text-lg">Total items in database: <span className="font-bold text-blue-600">{dbWordCount}</span></p>
            )}

            <div className="mt-4 flex flex-col sm:flex-row gap-4">
                 <button onClick={onViewWordList} className="flex-1 bg-slate-600 text-white font-bold py-3 px-6 rounded-lg text-lg hover:bg-slate-700 transition shadow-md disabled:bg-slate-400" disabled={!isDbReady} title={!isDbReady ? dbDisabledTitle : ""}>View Word List</button>
                 <label className={`flex-1 text-white font-bold py-3 px-6 rounded-lg text-lg text-center transition shadow-md ${isInitializing ? 'bg-slate-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 cursor-pointer'}`}>
                    Import Words
                    <input
                        type="file"
                        onChange={(e) => handleFileChange(e, 'word')}
                        className="hidden"
                        accept=".json"
                        disabled={isInitializing}
                    />
                 </label>
                 <label className={`flex-1 text-white font-bold py-3 px-6 rounded-lg text-lg text-center transition shadow-md ${isInitializing ? 'bg-slate-400 cursor-not-allowed' : 'bg-fuchsia-600 hover:bg-fuchsia-700 cursor-pointer'}`}>
                    Import Idioms
                    <input
                        type="file"
                        onChange={(e) => handleFileChange(e, 'idiom')}
                        className="hidden"
                        accept=".json"
                        disabled={isInitializing}
                    />
                 </label>
            </div>
        </div>
    </div>
  );
};

export default AdminScreen;
