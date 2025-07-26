

import React, { useState, useEffect, useCallback } from 'react';
import { Level, VocabCategory, ListeningExercise, ListeningPart, ConversationExercise, QuestionResponseExercise } from '../types';
import { generateListeningExercise } from '../services/geminiService';
import { useTextToSpeech, SpeechCancellationError } from '../hooks/useTextToSpeech';
import LoadingSpinner from '../components/LoadingSpinner';
import SoundIcon from '../components/icons/SoundIcon';
import PlayIcon from '../components/icons/PlayIcon';
import ScriptModal from '../components/ScriptModal';
import { LEVELS, VOCAB_CATEGORIES } from '../constants';

interface ListeningModeProps {
  onGoHome: () => void;
  initialCategory: VocabCategory | 'Random';
  level: Level;
  part: ListeningPart;
  onApiError: (error: unknown) => void;
}

type GameState = 'loading' | 'ready' | 'listening' | 'answering' | 'answered';

const getSafeString = (value: any): string => {
    if (typeof value === 'string') {
        return value;
    }
    if (value === null || value === undefined) {
        return '';
    }
    return String(value);
};

export const ListeningMode: React.FC<ListeningModeProps> = ({ onGoHome, initialCategory, level, part, onApiError }) => {
  const [exercise, setExercise] = useState<ListeningExercise | null>(null);
  const [gameState, setGameState] = useState<GameState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [currentLevel, setCurrentLevel] = useState<Level>(level);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  
  const { speak, stop, isSpeaking } = useTextToSpeech();

  const fetchExercise = useCallback(async () => {
    setGameState('loading');
    setError(null);
    setExercise(null);
    setSelectedAnswerIndex(null);
    setIsScriptModalOpen(false);
    stop();

    try {
      const categoryToFetch = initialCategory === 'Random'
        ? VOCAB_CATEGORIES[Math.floor(Math.random() * VOCAB_CATEGORIES.length)]
        : initialCategory;

      const data = await generateListeningExercise(part, currentLevel, categoryToFetch);
      if (!data) {
        throw new Error("AIが有効な問題を生成できませんでした。もう一度お試しください。");
      }
      setExercise(data);
      setGameState('ready');
    } catch (e: any) {
      onApiError(e);
      setError(e.message || "問題の取得中にエラーが発生しました。");
      setGameState('ready');
      console.error(e);
    }
  }, [currentLevel, initialCategory, part, stop, onApiError]);

  useEffect(() => {
    fetchExercise();
    return () => stop();
  }, [fetchExercise]);
  
  const playPassage = useCallback(async () => {
    if (!exercise || isSpeaking) return;
    
    setGameState('listening');
    try {
        if(exercise.part === ListeningPart.Part2) {
            await speak(getSafeString(exercise.question), 'en-US');
            await new Promise(r => setTimeout(r, 500));
            for(const option of exercise.options) {
                await speak(getSafeString(option), 'en-US');
                await new Promise(r => setTimeout(r, 400));
            }
        } else {
            for(const sentence of exercise.passage) {
                await speak(getSafeString(sentence.english), 'en-US');
                await new Promise(r => setTimeout(r, 300));
            }
        }
        setGameState('answering');
    } catch (err) {
        if (err instanceof SpeechCancellationError) console.log("Playback was cancelled.");
        else setError("音声再生エラーが発生しました。");
        setGameState('ready');
    }
  }, [exercise, isSpeaking, speak]);

  const handleReplayAudio = useCallback(async () => {
    if (!exercise || isSpeaking) return;
    try {
        if(exercise.part === ListeningPart.Part2) {
            await speak(getSafeString(exercise.question), 'en-US');
        } else {
            for (const sentence of exercise.passage) {
                await speak(getSafeString(sentence.english), 'en-US');
                await new Promise(r => setTimeout(r, 300));
            }
        }
    } catch (err) {
      if (!(err instanceof SpeechCancellationError)) console.error('Replay error:', err);
    }
  }, [exercise, isSpeaking, speak]);
  
  const handleSelectAnswer = (index: number) => {
      if (gameState !== 'answering') return;
      setSelectedAnswerIndex(index);
      setGameState('answered');
  };

  const renderContent = () => {
    if (gameState === 'loading') return <LoadingSpinner />;
    if (error) return <p className="text-center text-red-500 bg-red-100 p-4 rounded-lg">{error}</p>;
    if (!exercise) return <p className="text-center text-slate-500">問題が読み込まれていません。</p>;

    const isCorrect = selectedAnswerIndex === exercise.correctOptionIndex;
    const isPart2 = exercise.part === ListeningPart.Part2;

    return (
        <div className="w-full bg-white p-6 md:p-8 rounded-2xl shadow-xl flex flex-col items-center">
            <h2 className="text-2xl font-bold text-slate-800 mb-4 text-center">
                {isPart2 ? '応答問題' : getSafeString((exercise as ConversationExercise).title)}
            </h2>
            
            {gameState === 'ready' && (
                <button onClick={playPassage} className="bg-blue-600 text-white font-bold py-4 px-8 rounded-lg text-xl hover:bg-blue-700 transition flex items-center gap-3">
                    <PlayIcon className="w-8 h-8"/> リスニング開始
                </button>
            )}

            {gameState === 'listening' && (
                <div className="text-center my-8">
                    <SoundIcon className="w-16 h-16 text-blue-500 animate-pulse" />
                    <p className="mt-4 text-slate-600 font-semibold">音声を聞いています...</p>
                </div>
            )}
            
            {(gameState === 'answering' || gameState === 'answered') && (
                <div className="w-full text-left mt-4">
                    {!isPart2 && <p className="text-lg font-semibold text-slate-700 mb-4">{getSafeString((exercise as ConversationExercise).question)}</p>}
                    <div className="space-y-3">
                        {exercise.options.map((option, index) => {
                             const isSelected = selectedAnswerIndex === index;
                             let buttonClass = "w-full text-left p-4 rounded-lg border-2 transition-all duration-300 ";
                             if (gameState === 'answered') {
                                if (isSelected) buttonClass += isCorrect ? 'bg-green-100 border-green-500 text-green-900 font-bold' : 'bg-red-100 border-red-500 text-red-900 font-bold';
                                else if (index === exercise.correctOptionIndex) buttonClass += 'bg-green-100 border-green-500';
                                else buttonClass += 'bg-slate-50 border-slate-200 text-slate-600';
                             } else {
                                buttonClass += 'bg-white border-slate-300 hover:bg-blue-50 hover:border-blue-400';
                             }
                            
                             const optionText = isPart2 ? `(${String.fromCharCode(65 + index)}) ${getSafeString(option)}` : getSafeString((option as {en: string}).en);
                             const translationText = !isPart2 ? getSafeString((option as {jp: string}).jp) : null;

                            return (
                                <button key={index} onClick={() => handleSelectAnswer(index)} disabled={gameState === 'answered'} className={buttonClass}>
                                   <p>{optionText}</p>
                                   {gameState === 'answered' && translationText && <p className="text-sm text-slate-500 mt-1">{translationText}</p>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {gameState === 'answered' && (
                 <div className="w-full mt-6 space-y-4">
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <h3 className={`text-xl font-bold mb-2 ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>{isCorrect ? "正解！" : "不正解"}</h3>
                        <p className="text-slate-700">{getSafeString(exercise.explanation)}</p>
                    </div>

                    {!isPart2 && (
                        <button 
                            onClick={() => setIsScriptModalOpen(true)} 
                            className="w-full bg-slate-100 text-slate-700 font-bold py-3 px-6 rounded-lg hover:bg-slate-200 border border-slate-300 transition"
                        >
                            全文スクリプトと日本語訳を表示
                        </button>
                    )}
                    
                    <div className="flex justify-center items-center gap-4 pt-2">
                        <button onClick={handleReplayAudio} disabled={isSpeaking} className="flex-1 bg-sky-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-sky-600 transition disabled:bg-slate-400">
                           音声を再再生
                        </button>
                        <button onClick={fetchExercise} className="flex-1 bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition">
                            次の問題へ
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4">
        {isScriptModalOpen && exercise && exercise.part !== ListeningPart.Part2 && (
            <ScriptModal 
                passage={(exercise as ConversationExercise).passage}
                title={getSafeString((exercise as ConversationExercise).title)}
                onClose={() => setIsScriptModalOpen(false)}
            />
        )}
        <div className="flex justify-between items-center mb-6">
            <button onClick={onGoHome} className="text-blue-600 hover:text-blue-800">&larr; ホームに戻る</button>
            <h1 className="text-2xl font-bold text-slate-800">{part}</h1>
            <div/>
        </div>
      
        <div className="mb-6 p-4 bg-white rounded-lg shadow-md flex gap-4 justify-center items-center">
            <div className="flex items-center gap-2">
                <label className="font-semibold text-slate-600">レベル:</label>
                <select value={currentLevel} onChange={e => setCurrentLevel(e.target.value as Level)} className="p-2 border rounded-md bg-white text-slate-800 focus:ring-2 focus:ring-blue-500" disabled={gameState === 'loading' || isSpeaking}>
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
            </div>
             <button onClick={fetchExercise} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition" disabled={gameState === 'loading' || isSpeaking}>
                新しい問題
            </button>
        </div>
        
        {renderContent()}
    </div>
  );
};
