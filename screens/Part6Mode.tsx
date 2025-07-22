

import React, { useState, useEffect, useCallback } from 'react';
import { Level, VocabCategory, TextCompletionExercise, TextCompletionQuestion } from '../types';
import { generateTextCompletionExercise } from '../services/geminiService';
import LoadingSpinner from '../components/LoadingSpinner';
import { LEVELS, VOCAB_CATEGORIES } from '../constants';

interface Part6ModeProps {
  onGoHome: () => void;
  initialCategory: VocabCategory | 'Random';
  level: Level;
  onApiError: (error: unknown) => void;
}

type GameState = 'loading' | 'answering' | 'answered';

const Part6Mode: React.FC<Part6ModeProps> = ({ onGoHome, initialCategory, level, onApiError }) => {
  const [exercise, setExercise] = useState<TextCompletionExercise | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [gameState, setGameState] = useState<GameState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [currentLevel, setCurrentLevel] = useState<Level>(level);

  const fetchExercise = useCallback(async () => {
    setGameState('loading');
    setError(null);
    setExercise(null);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setAnswers([]);

    try {
      const categoryToFetch = initialCategory === 'Random'
        ? VOCAB_CATEGORIES[Math.floor(Math.random() * VOCAB_CATEGORIES.length)]
        : initialCategory;

      const data = await generateTextCompletionExercise(currentLevel, categoryToFetch);
      if (!data || !data.questions || data.questions.length === 0) {
        throw new Error("AIが有効な問題を生成できませんでした。もう一度お試しください。");
      }
      setExercise(data);
      setAnswers(new Array(data.questions.length).fill(null));
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

  const currentQuestion = exercise?.questions[currentQuestionIndex];

  const handleSelectAnswer = (index: number) => {
    if (gameState !== 'answering' || !currentQuestion) return;
    setSelectedAnswer(index);
    setGameState('answered');
    
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = currentQuestion.options[index];
    setAnswers(newAnswers);
  };
  
  const handleNextQuestion = () => {
    if (!exercise) return;
    setSelectedAnswer(null);
    if (currentQuestionIndex < exercise.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setGameState('answering');
    } else {
      setGameState('answered'); // Stay on answered state for the last question
    }
  }
  
  const renderPassage = () => {
    if (!exercise) return null;
    let passageHtml = exercise.passage;
    exercise.questions.forEach((q, i) => {
        const blankNumber = q.blank_number;
        let content: string;
        let style: string;

        if (i < currentQuestionIndex || (i === currentQuestionIndex && gameState === 'answered')) {
            content = answers[i] || `[${blankNumber}]`;
            const isCorrect = answers[i] === q.options[q.correctOptionIndex];
            style = isCorrect ? 'bg-green-200 text-green-900 font-bold' : 'bg-red-200 text-red-900 font-bold';
        } else if (i === currentQuestionIndex && gameState === 'answering') {
            content = `[${blankNumber}]`;
            style = 'bg-yellow-300 font-bold animate-pulse';
        } else {
            content = `[${blankNumber}]`;
            style = 'bg-slate-200 font-bold';
        }
        passageHtml = passageHtml.replace(`[${blankNumber}]`, `<span class="px-2 py-1 rounded-md ${style}">${content}</span>`);
    });
    return <p className="text-base md:text-lg text-slate-800 mb-6 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: passageHtml }} />;
  }

  const renderContent = () => {
    if (gameState === 'loading') return <LoadingSpinner />;
    if (error) return <p className="text-center text-red-500 bg-red-100 p-4 rounded-lg">{error}</p>;
    if (!exercise || !currentQuestion) return <p className="text-center text-slate-500">問題が読み込まれていません。</p>;

    const isCorrect = selectedAnswer === currentQuestion.correctOptionIndex;
    const isFinished = currentQuestionIndex === exercise.questions.length - 1 && gameState === 'answered';

    return (
        <div className="w-full bg-white p-6 md:p-8 rounded-2xl shadow-xl flex flex-col items-center">
            {renderPassage()}
            
            <div className="w-full border-t border-slate-200 pt-6">
                 <p className="text-lg font-semibold text-slate-700 mb-4">空欄 [{currentQuestion.blank_number}] の設問</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentQuestion.options.map((option, index) => {
                         const isSelected = selectedAnswer === index;
                         let buttonClass = "w-full text-left p-4 rounded-lg border-2 transition-all duration-300 ";
                         if (gameState === 'answered') {
                            if (isSelected) buttonClass += isCorrect ? 'bg-green-100 border-green-500 font-bold' : 'bg-red-100 border-red-500 font-bold';
                            else if (index === currentQuestion.correctOptionIndex) buttonClass += 'bg-green-100 border-green-500';
                            else buttonClass += 'bg-slate-50 border-slate-200 text-slate-600';
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
            </div>

            {gameState === 'answered' && (
                 <div className="w-full mt-6 space-y-4">
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <h3 className={`text-xl font-bold mb-2 ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>{isCorrect ? "正解" : "不正解"}</h3>
                        <p className="font-bold text-slate-700 mt-3">解説:</p>
                        <p className="text-slate-700 whitespace-pre-wrap">{currentQuestion.explanation_jp}</p>
                    </div>
                    
                    <button onClick={isFinished ? fetchExercise : handleNextQuestion} className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition">
                        {isFinished ? '新しい文章へ' : '次の問題へ'}
                    </button>
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
            <button onClick={onGoHome} className="text-blue-600 hover:text-blue-800">&larr; ホームに戻る</button>
            <h1 className="text-2xl font-bold text-slate-800">パート6: 長文穴埋め問題</h1>
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
                新しい文章
            </button>
        </div>

        {renderContent()}
    </div>
  );
};

export default Part6Mode;