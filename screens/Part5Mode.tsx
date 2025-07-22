

import React, { useState, useEffect, useCallback } from 'react';
import { Level, VocabCategory, IncompleteSentenceExercise } from '../types';
import { generateIncompleteSentenceExercise } from '../services/geminiService';
import LoadingSpinner from '../components/LoadingSpinner';
import { LEVELS, VOCAB_CATEGORIES } from '../constants';

interface Part5ModeProps {
  onGoHome: () => void;
  initialCategory: VocabCategory | 'Random';
  level: Level;
  onApiError: (error: unknown) => void;
}

type GameState = 'loading' | 'answering' | 'answered';

const Part5Mode: React.FC<Part5ModeProps> = ({ onGoHome, initialCategory, level, onApiError }) => {
  const [exercise, setExercise] = useState<IncompleteSentenceExercise | null>(null);
  const [gameState, setGameState] = useState<GameState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [currentLevel, setCurrentLevel] = useState<Level>(level);

  const fetchExercise = useCallback(async () => {
    setGameState('loading');
    setError(null);
    setExercise(null);
    setSelectedAnswerIndex(null);

    try {
      const categoryToFetch = initialCategory === 'Random'
        ? VOCAB_CATEGORIES[Math.floor(Math.random() * VOCAB_CATEGORIES.length)]
        : initialCategory;

      const data = await generateIncompleteSentenceExercise(currentLevel, categoryToFetch);
      if (!data || !data.options || data.options.length !== 4) {
        throw new Error("AIが有効な問題を生成できませんでした。もう一度お試しください。");
      }
      setExercise(data);
      setGameState('answering');
    } catch (e: any) {
      onApiError(e);
      setError(e.message || "問題の取得中にエラーが発生しました。");
      setGameState('answering');
      console.error(e);
    }
  }, [currentLevel, initialCategory, onApiError]);

  useEffect(() => {
    fetchExercise();
  }, [fetchExercise]);

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
    
    const sentenceWithAnswer = exercise.sentence_with_blank.replace('____', `[ ${exercise.options[exercise.correctOptionIndex]} ]`);

    return (
        <div className="w-full bg-white p-6 md:p-8 rounded-2xl shadow-xl flex flex-col items-center">
            <p className="text-lg md:text-xl font-medium text-slate-700 mb-6 text-center leading-relaxed">
                {gameState === 'answered' 
                    ? <span className="p-1 bg-yellow-100 rounded">{sentenceWithAnswer}</span>
                    : exercise.sentence_with_blank
                }
            </p>
            
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3">
                {exercise.options.map((option, index) => {
                     const isSelected = selectedAnswerIndex === index;
                     let buttonClass = "w-full text-left p-4 rounded-lg border-2 transition-all duration-300 ";
                     if (gameState === 'answered') {
                        if (isSelected) {
                            buttonClass += isCorrect ? 'bg-green-100 border-green-500 text-green-900 font-bold' : 'bg-red-100 border-red-500 text-red-900 font-bold';
                        } else if (index === exercise.correctOptionIndex) {
                            buttonClass += 'bg-green-100 border-green-500';
                        } else {
                             buttonClass += 'bg-slate-50 border-slate-200 text-slate-600';
                        }
                     } else {
                        buttonClass += 'bg-white border-slate-300 hover:bg-blue-50 hover:border-blue-400';
                     }

                    return (
                        <button key={index} onClick={() => handleSelectAnswer(index)} disabled={gameState === 'answered'} className={buttonClass}>
                           ({String.fromCharCode(65 + index)}) {option}
                        </button>
                    );
                })}
            </div>

            {gameState === 'answered' && (
                 <div className="w-full mt-6 space-y-4">
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <h3 className={`text-xl font-bold mb-2 ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>{isCorrect ? "正解" : "不正解"}</h3>
                        <p className="font-bold text-slate-700 mt-3">解説:</p>
                        <p className="text-slate-700 whitespace-pre-wrap">{exercise.explanation_jp}</p>
                    </div>
                    
                    <button onClick={fetchExercise} className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition">
                        次の問題へ
                    </button>
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
            <button onClick={onGoHome} className="text-blue-600 hover:text-blue-800">&larr; ホームに戻る</button>
            <h1 className="text-2xl font-bold text-slate-800">パート5: 短文穴埋め問題</h1>
            <div/>
        </div>
      
        <div className="mb-6 p-4 bg-white rounded-lg shadow-md flex gap-4 justify-center items-center">
            <div className="flex items-center gap-2">
                <label className="font-semibold text-slate-600">レベル:</label>
                <select value={currentLevel} onChange={e => setCurrentLevel(e.target.value as Level)} className="p-2 border rounded-md bg-white text-slate-800 focus:ring-2 focus:ring-blue-500" disabled={gameState === 'loading'}>
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
            </div>
            <button onClick={fetchExercise} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition" disabled={gameState === 'loading'}>
                新しい問題
            </button>
        </div>

        {renderContent()}
    </div>
  );
};

export default Part5Mode;