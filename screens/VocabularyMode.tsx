
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Level, VocabCategory, VocabDBItem, VocabType, PartOfSpeech, SortOrder } from '../types';
import { VOCAB_CATEGORIES, PARTS_OF_SPEECH } from '../constants';
import { getVocabulary } from '../db';
import { useTextToSpeech, SpeechCancellationError } from '../hooks/useTextToSpeech';
import LoadingSpinner from '../components/LoadingSpinner';
import SoundIcon from '../components/icons/SoundIcon';
import NextIcon from '../components/icons/NextIcon';

interface VocabularyModeProps {
  level: Level;
  onGoHome: () => void;
}

type StudyMode = 'listening' | 'writing' | 'en-jp-quiz' | 'jp-en-quiz';
type VocabSelection = VocabType | 'all';
type SessionSource = 'db' | 'file';

// Function to shuffle an array
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const getSafeString = (value: any): string => {
    if (typeof value === 'string') {
        return value;
    }
    if (value === null || value === undefined) {
        return '';
    }
    return String(value);
};

const VocabularyMode: React.FC<VocabularyModeProps> = ({ level, onGoHome }) => {
  const [category, setCategory] = useState<VocabCategory>(VocabCategory.Business);
  const [vocabList, setVocabList] = useState<VocabDBItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studyMode, setStudyMode] = useState<StudyMode>('listening');
  const [vocabSelection, setVocabSelection] = useState<VocabSelection>('word');
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | 'idle'>('idle');
  const [posFilter, setPosFilter] = useState<PartOfSpeech | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('Random');
  const [frequencyLevel, setFrequencyLevel] = useState<number | undefined>();

  // Quiz states
  const [quizOptions, setQuizOptions] = useState<VocabDBItem[]>([]);
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<VocabDBItem | null>(null);
  const [sessionLearnedIds, setSessionLearnedIds] = useState<Set<number>>(new Set());
  const [sessionReviewIds, setSessionReviewIds] = useState<Set<number>>(new Set());
  
  // New states for file-based review sessions
  const [sessionSource, setSessionSource] = useState<SessionSource>('db');
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const { speak, stop, isSpeaking } = useTextToSpeech();

  const currentItem = useMemo(() => vocabList[currentIndex], [vocabList, currentIndex]);

  const fetchVocabFromDB = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setVocabList([]);
    setCurrentIndex(0);
    setUserInput('');
    setFeedback('idle');
    setQuizOptions([]);
    setSelectedQuizAnswer(null);

    try {
      const items = await getVocabulary(level, category, vocabSelection, posFilter, sortOrder, 30, frequencyLevel);
      if (items.length < 4 && (studyMode === 'en-jp-quiz' || studyMode === 'jp-en-quiz')) {
         setError("クイズ用の単語が足りません（最低4つ必要です）。フィルターを変更するか、単語を追加してください。");
         setVocabList([]);
      } else if (items.length === 0) {
        setError("この条件に一致する単語が見つかりませんでした。カテゴリやフィルターを変更するか、データベースに単語が追加されるのをお待ちください。");
        setVocabList([]);
      } else {
        setVocabList(items);
      }
    } catch (e) {
      setError("ローカルデータベースからの語彙の取得中にエラーが発生しました。");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [level, category, vocabSelection, posFilter, sortOrder, studyMode, frequencyLevel]);

  useEffect(() => {
    if (sessionSource === 'db') {
      fetchVocabFromDB();
    }
  }, [fetchVocabFromDB, sessionSource]);

  // Effect to set up quiz options
  useEffect(() => {
    if ((studyMode === 'en-jp-quiz' || studyMode === 'jp-en-quiz') && currentItem && vocabList.length >= 4) {
        const distractors = vocabList.filter(item => item.id !== currentItem.id);
        const shuffledDistractors = shuffleArray(distractors).slice(0, 3);
        const options = shuffleArray([currentItem, ...shuffledDistractors]);
        setQuizOptions(options);
    }
    setSelectedQuizAnswer(null);
    setFeedback('idle');
  }, [currentIndex, currentItem, studyMode, vocabList]);

  const handleNext = useCallback(() => {
    stop();
    if (sessionSource === 'file') {
      if (vocabList.length > 0) {
        setCurrentIndex(prev => (prev + 1) % vocabList.length); // Loop the list
      }
    } else {
      if (currentIndex < vocabList.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        fetchVocabFromDB();
      }
    }
    setUserInput('');
    setFeedback('idle');
  }, [currentIndex, vocabList.length, fetchVocabFromDB, stop, sessionSource]);
  
  const playSequence = useCallback(async () => {
      if (!currentItem) return;
      try {
        await speak(getSafeString(currentItem.english), 'en-US');
        await new Promise(r => setTimeout(r, 500));
        await speak(getSafeString(currentItem.japanese), 'ja-JP');
        await new Promise(r => setTimeout(r, 500));
        await speak(getSafeString(currentItem.example_en), 'en-US');
        await new Promise(r => setTimeout(r, 500));
        await speak(getSafeString(currentItem.example_jp), 'ja-JP');
      } catch (error) {
        if (error instanceof SpeechCancellationError) {
          console.log('Speech sequence cancelled.');
        } else {
          console.error('Speech error:', error);
        }
      }
  }, [currentItem, speak]);

  const checkAnswer = async () => {
    if (!currentItem) return;
    const isCorrect = userInput.trim().toLowerCase() === getSafeString(currentItem.english).toLowerCase();
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    if (isCorrect) {
        updateLearnedStatus(currentItem.id!, true);
        try { await speak("正解！", 'ja-JP'); setTimeout(handleNext, 1500); } catch (e) { console.error(e); }
    } else {
        updateLearnedStatus(currentItem.id!, false);
        try { await speak("もう一度試してください。", 'ja-JP'); } catch (e) { console.error(e); }
    }
  };
  
  const handleWritingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    checkAnswer();
  };

  const handleQuizAnswer = (selectedOption: VocabDBItem) => {
    if (feedback !== 'idle') return;
    setSelectedQuizAnswer(selectedOption);
    const isCorrect = selectedOption.id === currentItem.id;
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    updateLearnedStatus(currentItem.id!, isCorrect);
  };
  
  const updateLearnedStatus = (id: number, learned: boolean) => {
    setSessionLearnedIds(prev => {
        const newSet = new Set(prev);
        if (learned) newSet.add(id);
        else newSet.delete(id);
        return newSet;
    });
     setSessionReviewIds(prev => {
        const newSet = new Set(prev);
        if (!learned) newSet.add(id);
        else newSet.delete(id);
        return newSet;
    });
  };
  
  const exportReviewList = () => {
    const reviewItems = vocabList.filter(item => sessionReviewIds.has(item.id!));
    if (reviewItems.length === 0) {
        alert("このセッションで復習にマークされた項目はありません。");
        return;
    }
    const dataStr = JSON.stringify({ vocabulary: reviewItems }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'toeic_review_list.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleLoadReviewFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error("File could not be read");
        const data = JSON.parse(text);

        if (!data.vocabulary || !Array.isArray(data.vocabulary) || data.vocabulary.length === 0) {
          alert('無効なJSON形式または空のリストです。"vocabulary"キーを持つ空でない配列のオブジェクトが必要です。');
          return;
        }
        
        const firstItem = data.vocabulary[0];
        if (!firstItem.english || !firstItem.japanese || !firstItem.example_en) {
          alert('語彙リストの項目が不正な形式のようです。');
          return;
        }
        
        stop();
        setVocabList(shuffleArray(data.vocabulary));
        setSessionSource('file');
        setLoadedFileName(file.name);
        setCurrentIndex(0);
        setUserInput('');
        setFeedback('idle');
        setError(null);
        setSessionLearnedIds(new Set());
        setSessionReviewIds(new Set());
      } catch (error) {
        console.error('Error importing review list:', error);
        alert('復習リストのインポートに失敗しました。ファイル形式を確認し、コンソールでエラーを確認してください。');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };
  
  const handleReturnToStandardMode = () => {
    setSessionSource('db');
    setLoadedFileName(null);
    setVocabList([]); 
    setIsLoading(true);
  };

  const renderQuizContent = () => {
    if (!currentItem || quizOptions.length === 0) return <LoadingSpinner />;
    
    const isEnToJp = studyMode === 'en-jp-quiz';
    const questionText = isEnToJp ? getSafeString(currentItem.english) : getSafeString(currentItem.japanese);
    const getOptionText = (item: VocabDBItem) => isEnToJp ? getSafeString(item.japanese) : getSafeString(item.english);
    
    return (
      <div className="w-full bg-white p-6 rounded-2xl shadow-xl transition-all duration-500">
        <p className="text-right text-slate-500 mb-4">{currentIndex + 1} / {vocabList.length}</p>
        <div className="text-center">
            <p className="text-sm font-semibold text-slate-500 mb-2">{isEnToJp ? "以下の英単語・熟語の日本語訳は？" : "以下の日本語に対応する英単語・熟語は？"}</p>
            <h2 className="text-3xl font-bold mb-6">{questionText}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {quizOptions.map((option) => {
            const isSelected = selectedQuizAnswer?.id === option.id;
            const isCorrect = option.id === currentItem.id;
            let buttonClass = "w-full text-left p-4 rounded-lg border-2 transition text-base ";
            
            if (feedback !== 'idle') {
              if (isCorrect) {
                buttonClass += 'bg-green-100 border-green-500 text-green-900 font-bold';
              } else if (isSelected) {
                buttonClass += 'bg-red-100 border-red-500 text-red-900 font-bold';
              } else {
                 buttonClass += 'bg-slate-50 border-slate-200 text-slate-600';
              }
            } else {
               buttonClass += 'bg-white border-slate-300 hover:bg-blue-50 hover:border-blue-400';
            }
            
            return (
              <button key={option.id} onClick={() => handleQuizAnswer(option)} className={buttonClass} disabled={feedback !== 'idle'}>
                {getOptionText(option)}
              </button>
            )
          })}
        </div>
        {feedback !== 'idle' && (
            <div className="mt-4 text-center p-4 rounded-lg bg-slate-50">
                <p className="text-lg font-bold">{getSafeString(currentItem.english)}</p>
                <p className="text-md text-slate-600">{getSafeString(currentItem.japanese)}</p>
                <div className="mt-3 flex justify-center gap-4">
                    <button onClick={() => updateLearnedStatus(currentItem.id!, true)} className={`px-3 py-1 text-sm rounded-full ${sessionLearnedIds.has(currentItem.id!) ? 'bg-green-600 text-white' : 'bg-green-200 text-green-800'}`}>覚えた 👍</button>
                    <button onClick={() => updateLearnedStatus(currentItem.id!, false)} className={`px-3 py-1 text-sm rounded-full ${sessionReviewIds.has(currentItem.id!) ? 'bg-red-600 text-white' : 'bg-red-200 text-red-800'}`}>要復習 👎</button>
                </div>
            </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (isLoading) return <LoadingSpinner />;
    if (error) return <div className="text-center p-8 bg-yellow-100 border border-yellow-300 rounded-lg">
        <p className="text-yellow-800 font-semibold">お知らせ</p>
        <p className="text-yellow-700 mt-2">{error}</p>
        <button onClick={onGoHome} className="mt-4 bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition">
            &larr; ホームに戻る
        </button>
    </div>;
    if (!currentItem) {
        if (sessionSource === 'file') {
            return (
                 <div className="text-center p-8 bg-blue-100 border border-blue-300 rounded-lg">
                    <p className="text-blue-800 font-semibold">復習リストが読み込まれました！</p>
                    <p className="text-blue-700 mt-2">集中復習セッションを開始する準備ができました。</p>
                </div>
            );
        }
        return <p className="text-center text-slate-500">単語が読み込まれていません。</p>;
    }
    
    if (studyMode === 'en-jp-quiz' || studyMode === 'jp-en-quiz') {
      return (
        <div className="w-full flex flex-col items-center">
          {renderQuizContent()}
           <button onClick={handleNext} className="mt-8 flex items-center gap-2 text-slate-600 font-semibold py-3 px-6 rounded-lg hover:bg-slate-200 transition">
            { sessionSource === 'file' ? '次の単語へ' : '次の単語/バッチへ' } <NextIcon />
          </button>
        </div>
      );
    }

    return (
      <div className="w-full flex flex-col items-center">
        <div className="w-full bg-white p-8 rounded-2xl shadow-xl transition-all duration-500">
            <div className="flex justify-between items-baseline mb-4">
                 <div className="flex gap-2 items-center">
                    <span className={`capitalize text-sm font-semibold py-1 px-3 rounded-full ${currentItem.type === 'idiom' ? 'bg-purple-200 text-purple-800' : 'bg-green-200 text-green-800'}`}>{currentItem.type}</span>
                    {currentItem.pos && (
                        <span className="capitalize text-sm font-semibold py-1 px-3 rounded-full bg-blue-200 text-blue-800">{currentItem.pos.toLowerCase()}</span>
                    )}
                </div>
                 <p className="text-center text-slate-500">{currentIndex + 1} / {vocabList.length}</p>
                 <div/>
            </div>
           
            {studyMode === 'listening' ? (
                <div className="text-center">
                    <h2 className="text-4xl font-bold mb-2">{getSafeString(currentItem.english)}</h2>
                    <p className="text-2xl text-slate-600 mb-6">{getSafeString(currentItem.japanese)}</p>
                    <p className="text-xl text-slate-800 mb-2">"{getSafeString(currentItem.example_en)}"</p>
                    <p className="text-lg text-slate-500 mb-8">{getSafeString(currentItem.example_jp)}</p>
                    <button onClick={() => playSequence()} disabled={isSpeaking} className="bg-blue-500 text-white rounded-full p-4 hover:bg-blue-600 transition disabled:bg-slate-300">
                        <SoundIcon className="w-8 h-8"/>
                    </button>
                </div>
            ) : (
                <div className="text-center">
                    <p className="text-2xl text-slate-600 mb-4">{getSafeString(currentItem.japanese)}</p>
                    <p className="text-lg text-slate-500 mb-6">{getSafeString(currentItem.example_jp)}</p>
                     <button onClick={() => speak(getSafeString(currentItem.example_en), 'en-US').catch(error => { if (!(error instanceof SpeechCancellationError)) { console.error('Speech error:', error); } })} disabled={isSpeaking} className="mb-4 text-blue-500 hover:text-blue-700 flex items-center gap-2 mx-auto disabled:text-slate-400">
                        <SoundIcon className="w-5 h-5"/> 例文を聞く
                    </button>
                    <form onSubmit={handleWritingSubmit} className="flex flex-col items-center gap-4">
                        <input
                            type="text"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            className={`w-full max-w-md p-4 border-2 rounded-lg text-lg text-center transition ${
                                feedback === 'correct' ? 'border-green-500 bg-green-50' :
                                feedback === 'incorrect' ? 'border-red-500 bg-red-50' :
                                'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                            }`}
                            placeholder="英単語・熟語を入力"
                        />
                         <button type="submit" className="bg-blue-600 text-white font-bold py-3 px-8 rounded-lg text-lg hover:bg-blue-700 transition">
                            チェック
                        </button>
                    </form>
                    {feedback === 'incorrect' && (
                        <button onClick={() => setUserInput(getSafeString(currentItem.english))} className="mt-4 text-sm text-slate-500 hover:text-slate-700">答えを表示</button>
                    )}
                </div>
            )}
        </div>
        <button onClick={handleNext} className="mt-8 flex items-center gap-2 text-slate-600 font-semibold py-3 px-6 rounded-lg hover:bg-slate-200 transition">
           { sessionSource === 'file' ? '次の単語へ' : '次の単語/バッチへ' } <NextIcon />
        </button>
      </div>
    );
  }
  
  const ModeButton: React.FC<{ mode: StudyMode, children: React.ReactNode }> = ({ mode, children }) => (
      <button onClick={() => setStudyMode(mode)} className={`px-3 py-2 text-sm font-semibold rounded-lg transition ${studyMode === mode ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>{children}</button>
  );

  return (
    <div className="w-full max-w-3xl mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
            <button onClick={onGoHome} className="text-blue-600 hover:text-blue-800">&larr; ホームに戻る</button>
            <h1 className="text-2xl font-bold text-slate-800">単語学習モード</h1>
            <div/>
        </div>

        <div className="mb-6 p-4 bg-white rounded-lg shadow-md flex flex-col gap-4">
            {sessionSource === 'file' && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-2">
                <div className="text-sm text-indigo-800 text-center sm:text-left">
                    <p><strong>復習セッション中:</strong></p>
                    <p className="font-medium break-all">{loadedFileName}</p>
                </div>
                <button onClick={handleReturnToStandardMode} className="bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-600 transition text-sm whitespace-nowrap">
                    &larr; 通常モードに戻る
                </button>
              </div>
            )}
            
            <fieldset disabled={sessionSource === 'file' || isLoading} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold text-slate-600">カテゴリ:</label>
                        <select value={category} onChange={e => setCategory(e.target.value as VocabCategory)} className="p-2 border rounded-md bg-slate-50 w-full disabled:opacity-70 disabled:cursor-not-allowed">
                            {VOCAB_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold text-slate-600">練習内容:</label>
                        <select value={vocabSelection} onChange={e => setVocabSelection(e.target.value as VocabSelection)} className="p-2 border rounded-md bg-slate-50 w-full disabled:opacity-70 disabled:cursor-not-allowed">
                           <option value="word">単語</option>
                           <option value="idiom">熟語</option>
                           <option value="all">全て</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold text-slate-600">順序:</label>
                        <select value={sortOrder} onChange={e => setSortOrder(e.target.value as SortOrder)} className="p-2 border rounded-md bg-slate-50 w-full disabled:opacity-70 disabled:cursor-not-allowed">
                            <option value="Random">ランダム</option>
                            <option value="Alphabetical">アルファベット順</option>
                        </select>
                    </div>
                    {vocabSelection === 'word' && (
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-semibold text-slate-600">品詞:</label>
                            <select value={posFilter} onChange={e => setPosFilter(e.target.value as PartOfSpeech | 'all')} className="p-2 border rounded-md bg-slate-50 w-full disabled:opacity-70 disabled:cursor-not-allowed">
                                <option value="all">全ての品詞</option>
                                {PARTS_OF_SPEECH.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold text-slate-600">頻出度:</label>
                        <select 
                            value={frequencyLevel || ''} 
                            onChange={e => setFrequencyLevel(e.target.value ? Number(e.target.value) : undefined)} 
                            className="p-2 border rounded-md bg-slate-50 w-full disabled:opacity-70 disabled:cursor-not-allowed">
                            <option value="">全て</option>
                            <option value="3">高 (★★★)</option>
                            <option value="2">中 (★★☆)</option>
                            <option value="1">低 (★☆☆)</option>
                        </select>
                    </div>
                </div>
            </fieldset>

             <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-600">モード:</label>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <ModeButton mode="listening">リスニング</ModeButton>
                    <ModeButton mode="writing">ライティング</ModeButton>
                    <ModeButton mode="en-jp-quiz">英語→日本語 クイズ</ModeButton>
                    <ModeButton mode="jp-en-quiz">日本語→英語 クイズ</ModeButton>
                </div>
            </div>
            
            {(studyMode === 'en-jp-quiz' || studyMode === 'jp-en-quiz') && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-2">
                    <div className="text-sm text-blue-800">
                        <p><strong>セッションの状況:</strong></p>
                        <p>覚えた: <span className="font-bold">{sessionLearnedIds.size}</span> | 要復習: <span className="font-bold">{sessionReviewIds.size}</span></p>
                    </div>
                    <button onClick={exportReviewList} className="bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition text-sm whitespace-nowrap" disabled={sessionReviewIds.size === 0}>
                        復習リストをエクスポート
                    </button>
                </div>
            )}

            <div className="border-t border-slate-200 mt-2 pt-4">
              <h3 className="text-sm font-semibold text-slate-600 mb-2">または、集中復習セッションを開始:</h3>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleLoadReviewFile}
                className="hidden"
                accept=".json"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700 transition disabled:bg-slate-400 disabled:cursor-not-allowed"
                disabled={sessionSource === 'file' || isLoading}
              >
                復習リストをアップロード (.json)
              </button>
            </div>
        </div>

        {renderContent()}
    </div>
  );
};

export default VocabularyMode;
