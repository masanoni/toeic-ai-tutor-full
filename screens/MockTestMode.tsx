

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Level, MockTest, MockTestAttempt, MockTestContent, UserAnswers, MockTestQuestionKey, PhotoDescriptionExercise, QuestionResponseExercise, MockTestConversation, IncompleteSentenceExercise, TextCompletionExercise, Part7Exercise, ReadingQuestion, Omit } from '../types';
import { generatePart1Batch, generatePart2Batch, generatePart3Batch, generatePart4Batch, generatePart5Batch, generatePart6Batch, generatePart7Batch, generateImagePrompt, generateImage, generateAdvice } from '../services/geminiService';
import { getAllMockTests, addMockTest, getMockTest, updateMockTest, deleteMockTest } from '../db';
import LoadingSpinner from '../components/LoadingSpinner';
import { useTextToSpeech, SpeechCancellationError } from '../hooks/useTextToSpeech';
import PlayIcon from '../components/icons/PlayIcon';
import PauseIcon from '../components/icons/PauseIcon';
import SoundIcon from '../components/icons/SoundIcon';
import PhotoIcon from '../components/icons/PhotoIcon';

const HistoryIcon = ({ className = "w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>;
const TrashIcon = ({ className = "w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>;
const ResumeIcon = ({ className = "w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>;


const GENERATION_CONFIG = [
    { id: 'part1', name: "Part 1: Photographs", store: 'listening', count: 6, generator: generatePart1Batch },
    { id: 'part2', name: "Part 2: Question-Response", store: 'listening', count: 25, generator: generatePart2Batch },
    { id: 'part3', name: "Part 3: Conversations", store: 'listening', count: 13, generator: generatePart3Batch }, // 13 convos * 3 questions = 39
    { id: 'part4', name: "Part 4: Talks", store: 'listening', count: 10, generator: generatePart4Batch }, // 10 talks * 3 questions = 30
    { id: 'part5', name: "Part 5: Incomplete Sentences", store: 'reading', count: 30, generator: generatePart5Batch },
    { id: 'part6', name: "Part 6: Text Completion", store: 'reading', count: 4, generator: generatePart6Batch }, // 4 passages * 4 questions = 16
    { id: 'part7', name: "Part 7: Reading Comprehension", store: 'reading', count: [10, 5], generator: generatePart7Batch }, // 10 single-passage exercises (29q total), 5 multi-passage exercises (25q total)
    { id: 'advice', name: "AI Advice", generator: generateAdvice },
] as const;

interface MockTestModeProps {
  onGoHome: () => void;
  onApiError: (error: unknown) => void;
}

type View = 'lobby' | 'generating' | 'taking' | 'results' | 'review' | 'history';

const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const RadioGroup = ({ qKey, options, selectedValue, onSelect, disabled }: { qKey: string, options: { label: string }[], selectedValue: number | null, onSelect: (qKey: any, index: number) => void, disabled: boolean }) => {
  return (
    <div className="space-y-2">
      {options.map((option, index) => (
        <label key={index} className={`flex items-center p-3 rounded-lg border-2 ${selectedValue === index ? 'bg-blue-100 border-blue-500' : 'bg-slate-50 border-slate-200'} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-blue-50'}`}>
          <input
            type="radio"
            name={qKey}
            value={index}
            checked={selectedValue === index}
            onChange={() => onSelect(qKey, index)}
            disabled={disabled}
            className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
          />
          <span className="ml-3 text-slate-800 text-sm" dangerouslySetInnerHTML={{ __html: option.label }} />
        </label>
      ))}
    </div>
  );
};

const TestPlayer = ({ test, attempt, onFinishAttempt, onPauseAttempt, onTimeUpdate }: { test: MockTest, attempt: MockTestAttempt, onFinishAttempt: (answers: UserAnswers) => void, onPauseAttempt: (answers: UserAnswers, timeLeft: number) => void, onTimeUpdate: (timeLeft: number) => void }) => {
    const { content } = test;
    const { speak, stop, isSpeaking } = useTextToSpeech();
    const [userAnswers, setUserAnswers] = useState<UserAnswers>(attempt.answers || {});
    const [currentPartKey, setCurrentPartKey] = useState<string>('part1');
    const [timeLeft, setTimeLeft] = useState(attempt.timeLeft ?? 120 * 60); // 120 minutes

    const handleFinish = useCallback(() => {
        if (window.confirm("テストを終了して採点しますか？")) {
            onFinishAttempt(userAnswers);
        }
    }, [userAnswers, onFinishAttempt]);

     const handlePause = useCallback(() => {
        if (window.confirm("テストを中断して後で再開しますか？")) {
            onPauseAttempt(userAnswers, timeLeft);
        }
    }, [userAnswers, timeLeft, onPauseAttempt]);
    
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                const newTime = prev - 1;
                if (newTime <= 0) {
                    clearInterval(timer);
                    onFinishAttempt(userAnswers);
                    return 0;
                }
                onTimeUpdate(newTime);
                return newTime;
            });
        }, 1000);

        return () => {
            clearInterval(timer);
            stop();
        };
    }, [userAnswers, onFinishAttempt, stop, onTimeUpdate]);


    const handleAnswerSelect = (key: MockTestQuestionKey, answerIndex: number) => {
        setUserAnswers(prev => ({ ...prev, [key]: answerIndex }));
    };

    const playAudio = useCallback(async (text: string | string[]) => {
        try {
            if (Array.isArray(text)) {
                for (const t of text) {
                    await speak(t, 'en-US');
                    await new Promise(r => setTimeout(r, 200));
                }
            } else {
                await speak(text, 'en-US');
            }
        } catch (e) {
            if (!(e instanceof SpeechCancellationError)) console.error(e);
        }
    }, [speak]);

    const testParts = useMemo(() => [
        { key: 'part1', name: 'Part 1', total: content.listening?.part1?.length || 0, answered: Object.keys(userAnswers).filter(k => k.startsWith('l1_')).length },
        { key: 'part2', name: 'Part 2', total: content.listening?.part2?.length || 0, answered: Object.keys(userAnswers).filter(k => k.startsWith('l2_')).length },
        { key: 'part3', name: 'Part 3', total: content.listening?.part3?.reduce((sum, c) => sum + c.questions.length, 0) || 0, answered: Object.keys(userAnswers).filter(k => k.startsWith('l3_')).length },
        { key: 'part4', name: 'Part 4', total: content.listening?.part4?.reduce((sum, c) => sum + c.questions.length, 0) || 0, answered: Object.keys(userAnswers).filter(k => k.startsWith('l4_')).length },
        { key: 'part5', name: 'Part 5', total: content.reading?.part5?.length || 0, answered: Object.keys(userAnswers).filter(k => k.startsWith('r5_')).length },
        { key: 'part6', name: 'Part 6', total: content.reading?.part6?.reduce((sum, c) => sum + c.questions.length, 0) || 0, answered: Object.keys(userAnswers).filter(k => k.startsWith('r6_')).length },
        { key: 'part7', name: 'Part 7', total: content.reading?.part7?.reduce((sum, c) => sum + c.questions.length, 0) || 0, answered: Object.keys(userAnswers).filter(k => k.startsWith('r7_')).length },
    ].filter(p => p.total > 0), [content, userAnswers]);
    
    const questionNumbers = useMemo(() => {
        const p1Len = content.listening?.part1?.length || 0;
        const p2Len = content.listening?.part2?.length || 0;
        const p3Len = content.listening?.part3?.reduce((s, c) => s + c.questions.length, 0) || 0;
        const p4Len = content.listening?.part4?.reduce((s, c) => s + c.questions.length, 0) || 0;
        const p5Len = content.reading?.part5?.length || 0;
        const p6Len = content.reading?.part6?.reduce((s, c) => s + c.questions.length, 0) || 0;

        return {
            part1: 1, part2: p1Len + 1, part3: p1Len + p2Len + 1, part4: p1Len + p2Len + p3Len + 1,
            part5: p1Len + p2Len + p3Len + p4Len + 1, part6: p1Len + p2Len + p3Len + p4Len + p5Len + 1,
            part7: p1Len + p2Len + p3Len + p4Len + p5Len + p6Len + 1,
        };
    }, [content]);

    const currentPartIndex = useMemo(() => testParts.findIndex(p => p.key === currentPartKey), [testParts, currentPartKey]);

    const handleNextPart = () => {
        if (currentPartIndex < testParts.length - 1) {
            setCurrentPartKey(testParts[currentPartIndex + 1].key);
            window.scrollTo(0, 0);
        }
    };


    const renderCurrentPart = () => {
        let contentToRender;
        switch (currentPartKey) {
            case 'part1': 
                contentToRender = (
                    <div className="space-y-8">
                        {content.listening?.part1?.map((q, i) => (
                            <div key={`l1_${i}`} className="border-b pb-8 last:border-b-0 last:pb-0">
                                <p className="font-bold mb-2">Question {questionNumbers.part1 + i}</p>
                                <div className="flex flex-col md:flex-row gap-4">
                                    <img src={`data:image/jpeg;base64,${q.image_base64}`} alt={`Question ${i+1}`} className="rounded-lg shadow-md w-full md:w-80 h-auto" />
                                    <div className="flex-grow">
                                        <button onClick={() => playAudio(q.options)} disabled={isSpeaking} className="mb-4 flex items-center gap-2 p-2 bg-slate-100 rounded-md hover:bg-slate-200 disabled:opacity-50"><SoundIcon className="w-5 h-5 text-blue-600"/> Play Options</button>
                                        <RadioGroup qKey={`l1_${i}`} options={q.options.map((opt, idx) => ({label: `Option ${String.fromCharCode(65+idx)}`}))} selectedValue={userAnswers[`l1_${i}`] ?? null} onSelect={handleAnswerSelect} disabled={false} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                );
                break;
            case 'part2': 
                contentToRender = (
                    <div className="space-y-6">
                        {content.listening?.part2?.map((q, i) => (
                             <div key={`l2_${i}`} className="border-b pb-6 last:border-b-0 last:pb-0">
                                 <p className="font-bold mb-2 flex items-center gap-4">
                                    Question {questionNumbers.part2 + i}
                                    <button onClick={() => playAudio([q.question, ...q.options])} disabled={isSpeaking} className="p-1 rounded-full hover:bg-slate-200 disabled:opacity-50"><SoundIcon className="w-6 h-6 text-blue-600"/></button>
                                </p>
                                <RadioGroup qKey={`l2_${i}`} options={['(A)', '(B)', '(C)'].map(l => ({ label: l}))} selectedValue={userAnswers[`l2_${i}`] ?? null} onSelect={handleAnswerSelect} disabled={false} />
                             </div>
                        ))}
                    </div>
                );
                break;
            case 'part3':
            case 'part4':
                const data = currentPartKey === 'part3' ? content.listening?.part3 : content.listening?.part4;
                const keyPrefix = currentPartKey === 'part3' ? 'l3' : 'l4';
                const qNumStart = currentPartKey === 'part3' ? questionNumbers.part3 : questionNumbers.part4;
                let questionCounter = 0;
                contentToRender = (
                    <div className="space-y-8">
                        {data?.map((convo, pIndex) => {
                            const passageQuestions = convo.questions.map((q, qIndex) => {
                                const globalQIndex = questionCounter + qIndex;
                                return (
                                    <div key={`${keyPrefix}_${pIndex}_${qIndex}`} className="border-t pt-4 mt-4">
                                        <p className="font-bold mb-2">{qNumStart + globalQIndex}. {q.question}</p>
                                        <RadioGroup qKey={`${keyPrefix}_${pIndex}_${qIndex}`} options={q.options.map(o => ({label: o.en}))} selectedValue={userAnswers[`${keyPrefix}_${pIndex}_${qIndex}`] ?? null} onSelect={handleAnswerSelect} disabled={false} />
                                    </div>
                                );
                            });
                            questionCounter += convo.questions.length;
                            return (
                                <div key={pIndex} className="bg-slate-50 p-4 rounded-lg">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="font-bold">{convo.title}</p>
                                        <button onClick={() => playAudio(convo.passage.map(s => s.english))} disabled={isSpeaking} className="p-1 rounded-full hover:bg-slate-200 disabled:opacity-50"><SoundIcon className="w-6 h-6 text-blue-600"/></button>
                                    </div>
                                    {passageQuestions}
                                </div>
                            )
                        })}
                    </div>
                );
                break;
            case 'part5': 
                contentToRender = (
                    <div className="space-y-6">
                        {content.reading?.part5?.map((q, i) => (
                            <div key={`r5_${i}`} className="border-b pb-6 last:border-b-0 last:pb-0">
                                <p className="font-bold mb-2">{questionNumbers.part5 + i}. <span dangerouslySetInnerHTML={{__html: q.sentence_with_blank.replace('____', '[ ____ ]')}}></span></p>
                                <RadioGroup qKey={`r5_${i}`} options={q.options.map(o => ({label: o}))} selectedValue={userAnswers[`r5_${i}`] ?? null} onSelect={handleAnswerSelect} disabled={false} />
                            </div>
                        ))}
                    </div>
                );
                break;
             case 'part6':
                let qCount6 = 0;
                contentToRender = (
                    <div className="space-y-8">
                        {content.reading?.part6?.map((passage, pIndex) => {
                            const passageQuestions = passage.questions.map((q, qIndex) => {
                                const globalQIndex = qCount6 + qIndex;
                                return (
                                    <div key={`r6_${pIndex}_${qIndex}`} className="border-t pt-4 mt-4">
                                        <p className="font-bold mb-2">{questionNumbers.part6 + globalQIndex}. (Blank {q.blank_number})</p>
                                        <RadioGroup qKey={`r6_${pIndex}_${qIndex}`} options={q.options.map(o => ({label: o}))} selectedValue={userAnswers[`r6_${pIndex}_${qIndex}`] ?? null} onSelect={handleAnswerSelect} disabled={false} />
                                    </div>
                                );
                            });
                            qCount6 += passage.questions.length;
                            return (
                                <div key={`r6p_${pIndex}`} className="bg-slate-50 p-4 rounded-lg">
                                    <p className="whitespace-pre-wrap leading-relaxed mb-4">{passage.passage}</p>
                                    {passageQuestions}
                                </div>
                            );
                        })}
                    </div>
                );
                break;
            case 'part7':
                let qCount7 = 0;
                contentToRender = (
                    <div className="space-y-8">
                        {content.reading?.part7?.map((exercise, eIndex) => {
                            const exerciseQuestions = exercise.questions.map((q, qIndex) => {
                                const globalQIndex = qCount7 + qIndex;
                                return (
                                    <div key={`r7_${eIndex}_${qIndex}`} className="border-t pt-4 mt-4">
                                        <p className="font-bold mb-2">{questionNumbers.part7 + globalQIndex}. {q.question}</p>
                                        <RadioGroup qKey={`r7_${eIndex}_${qIndex}`} options={q.options.map(o => ({label: o}))} selectedValue={userAnswers[`r7_${eIndex}_${qIndex}`] ?? null} onSelect={handleAnswerSelect} disabled={false} />
                                    </div>
                                );
                            });
                             qCount7 += exercise.questions.length;
                            return (
                                <div key={`r7e_${eIndex}`} className="bg-slate-50 p-4 rounded-lg">
                                    <div className="space-y-4 mb-4">
                                        {exercise.passages.map((p, pI) => (
                                            <div key={pI} className="border-b last:border-b-0 pb-4">
                                                <h4 className="font-bold">{p.title} ({p.type})</h4>
                                                <p className="whitespace-pre-wrap">{p.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {exerciseQuestions}
                                </div>
                            )
                        })}
                    </div>
                );
                break;
            default: contentToRender = <p>Select a part to begin.</p>;
        }
        return (
            <div>
                {contentToRender}
                {currentPartIndex < testParts.length - 1 && (
                     <button onClick={handleNextPart} className="w-full mt-8 bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-800 transition">
                        次のパートへ進む &rarr;
                    </button>
                )}
            </div>
        )
    };

    return (
        <div className="flex flex-col md:flex-row gap-6">
            <aside className="md:w-1/4 lg:w-1/5">
                <div className="sticky top-20 bg-white p-4 rounded-lg shadow-md">
                    <h3 className="font-bold mb-2 text-slate-800">Test Parts</h3>
                    <div className="space-y-1">
                        {testParts.map(part => (
                            <button key={part.key} onClick={() => setCurrentPartKey(part.key)} className={`w-full text-left p-2 rounded-md text-sm transition ${currentPartKey === part.key ? 'bg-blue-600 text-white font-bold' : 'bg-slate-100 hover:bg-slate-200'}`}>
                                <div className="flex justify-between items-center">
                                    <span>{part.name}</span>
                                    <span className="font-mono text-xs">{part.answered}/{part.total}</span>
                                </div>
                                <div className="w-full bg-slate-300 rounded-full h-1 mt-1">
                                    <div className="bg-blue-400 h-1 rounded-full" style={{ width: `${(part.answered / part.total) * 100}%` }}></div>
                                </div>
                            </button>
                        ))}
                    </div>
                     <div className="mt-4 border-t pt-4">
                        <button onClick={handlePause} className="w-full mt-2 bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-yellow-600 transition">
                           テストを中断
                        </button>
                        <button onClick={handleFinish} className="w-full mt-2 bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition">
                            テストを終了
                        </button>
                    </div>
                </div>
            </aside>
            <main className="md:w-3/4 lg:w-4/5 bg-white p-4 sm:p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-4 capitalize">{testParts.find(p => p.key === currentPartKey)?.name}</h2>
                {renderCurrentPart()}
            </main>
        </div>
    );
};


const ReviewPlayer = ({ test, attempt }: { test: MockTest, attempt: MockTestAttempt }) => {
    const { speak, stop, isSpeaking } = useTextToSpeech();

    useEffect(() => {
        // Cleanup speech on component unmount
        return () => stop();
    }, [stop]);

     if (test.status !== 'complete') {
        return <div className="bg-white p-8 rounded-xl shadow-lg text-center"><p className="text-red-500">このテストは完了していないため、復習できません。</p></div>
    }

    // Helper to render a generic question block
    const renderQuestionBlock = (
        questionText: string,
        options: string[],
        correctOptionIndex: number,
        userAnswerIndex: number | null,
        explanation: string,
        audioText?: string | string[] // For replaying audio
    ) => {
        return (
            <div className="border-t border-slate-200 pt-4 mt-4 first:mt-0 first:border-t-0">
                <div className="flex justify-between items-start">
                    <p className="font-semibold text-slate-800 mb-3 flex-grow" dangerouslySetInnerHTML={{ __html: questionText }} />
                    {audioText && (
                        <button
                            onClick={async () => {
                                try {
                                    if (Array.isArray(audioText)) {
                                        for (const text of audioText) {
                                            await speak(text, 'en-US');
                                            await new Promise(r => setTimeout(r, 300));
                                        }
                                    } else {
                                        await speak(audioText, 'en-US');
                                    }
                                } catch (e) {
                                    if (!(e instanceof SpeechCancellationError)) console.error(e)
                                }
                            }}
                            disabled={isSpeaking}
                            className="p-1 text-blue-500 hover:text-blue-700 disabled:text-slate-400 flex-shrink-0 ml-2"
                            title="音声を再生"
                        >
                            <SoundIcon className="w-6 h-6" />
                        </button>
                    )}
                </div>
                <div className="space-y-2">
                    {options.map((option, oIndex) => {
                        const isSelected = userAnswerIndex === oIndex;
                        const isCorrect = correctOptionIndex === oIndex;
                        let optionStyle = "w-full text-left p-3 rounded-lg border-2 transition text-sm ";

                        if (isSelected) {
                            optionStyle += isCorrect ? 'bg-green-100 border-green-500 text-green-900 font-bold' : 'bg-red-100 border-red-500 text-red-900 font-bold';
                        } else if (isCorrect) {
                            optionStyle += 'bg-green-100 border-green-500';
                        } else {
                            optionStyle += 'bg-slate-50 border-slate-200 text-slate-600';
                        }
                        
                        if (userAnswerIndex === null && isCorrect) {
                            optionStyle += ' ring-2 ring-green-500 ring-offset-2';
                        }

                        return (
                            <div key={oIndex} className={optionStyle}>
                                ({String.fromCharCode(65 + oIndex)}) {option}
                            </div>
                        );
                    })}
                </div>
                <div className="mt-3 p-3 rounded-lg bg-slate-100 text-sm">
                    <p className="font-bold text-slate-700">解説:</p>
                    <p className="text-slate-600 whitespace-pre-wrap">{explanation}</p>
                </div>
            </div>
        );
    };

    const renderConversationReview = (partName: string, conversations: MockTestConversation[], qNumStart: number, keyPrefix: 'l3' | 'l4', answers: UserAnswers) => {
        let questionCounter = qNumStart;
        return (
            <section>
                <h3 className="text-2xl font-bold text-slate-700 border-b-2 border-blue-500 pb-2 mb-4">{partName}</h3>
                <div className="space-y-8">
                    {conversations.map((convo, pIndex) => {
                        const audioPassage = convo.passage.map(s => s.english);
                        const currentQNumStart = questionCounter;
                        questionCounter += convo.questions.length;
                        
                        return (
                            <div key={`${keyPrefix}p_${pIndex}`} className="bg-slate-50 p-4 rounded-lg">
                                <div className="flex justify-between items-start mb-4">
                                    <h4 className="text-lg font-bold">{convo.title}</h4>
                                    <button
                                        onClick={async () => {
                                            try {
                                                for (const text of audioPassage) {
                                                    await speak(text, 'en-US');
                                                    await new Promise(r => setTimeout(r, 300));
                                                }
                                            } catch (e) {
                                                if (!(e instanceof SpeechCancellationError)) console.error(e)
                                            }
                                        }}
                                        disabled={isSpeaking}
                                        className="p-1 text-blue-500 hover:text-blue-700 disabled:text-slate-400"
                                        title="会話を再生"
                                    >
                                        <SoundIcon className="w-6 h-6" />
                                    </button>
                                </div>
                                <div className="max-h-48 overflow-y-auto mb-4 border p-2 rounded bg-white text-sm space-y-1">
                                    {convo.passage.map((s, sIndex) => <p key={sIndex}>{s.english}</p>)}
                                </div>
                                
                                {convo.questions.map((q, qIndex) => (
                                    <div key={`${keyPrefix}_${pIndex}_${qIndex}`}>
                                        {renderQuestionBlock(
                                            `Question ${currentQNumStart + qIndex}: ${q.question}`,
                                            q.options.map(opt => opt.en),
                                            q.correctOptionIndex,
                                            answers[`${keyPrefix}_${pIndex}_${qIndex}`] ?? null,
                                            q.explanation
                                        )}
                                    </div>
                                ))}
                            </div>
                        )
                    })}
                </div>
            </section>
        );
    };


    const { content } = test;
    const { answers } = attempt;

    let part7QCounter = 147;
    if(content.reading?.part5) part7QCounter = 101 + content.reading.part5.length + (content.reading.part6?.reduce((a,c) => a+c.questions.length, 0) || 0);

    return (
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg">
            <h2 className="text-3xl font-bold mb-1">復習: {test.name}</h2>
            <p className="text-slate-600 mb-6">受験日: {new Date(attempt.date).toLocaleString()}</p>
            
            <div className="space-y-10">
                {/* Part 1 */}
                {content.listening?.part1 && (
                    <section>
                        <h3 className="text-2xl font-bold text-slate-700 border-b-2 border-blue-500 pb-2 mb-4">Part 1: Photographs</h3>
                        <div className="space-y-8">
                            {content.listening.part1.map((q, i) => (
                                <div key={`l1_${i}`} className="flex flex-col md:flex-row gap-4">
                                    <div className="md:w-1/3 flex-shrink-0">
                                        <img src={`data:image/jpeg;base64,${q.image_base64}`} alt={`Part 1 Question ${i+1}`} className="rounded-lg shadow-md w-full" />
                                    </div>
                                    <div className="md:w-2/3">
                                        {renderQuestionBlock(
                                            `Question ${i + 1}`,
                                            q.options,
                                            q.correctOptionIndex,
                                            answers[`l1_${i}`] ?? null,
                                            q.explanation,
                                            q.options
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
                
                {/* Part 2 */}
                {content.listening?.part2 && (
                    <section>
                        <h3 className="text-2xl font-bold text-slate-700 border-b-2 border-blue-500 pb-2 mb-4">Part 2: Question-Response</h3>
                        <div className="space-y-6">
                            {content.listening.part2.map((q, i) => (
                                <div key={`l2_${i}`}>
                                    {renderQuestionBlock(
                                        `Question ${i + 7}: ${q.question}`,
                                        q.options,
                                        q.correctOptionIndex,
                                        answers[`l2_${i}`] ?? null,
                                        q.explanation,
                                        [q.question, ...q.options]
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {content.listening?.part3 && renderConversationReview('Part 3: Conversations', content.listening.part3, 32, 'l3', answers)}
                {content.listening?.part4 && renderConversationReview('Part 4: Talks', content.listening.part4, 71, 'l4', answers)}
                
                {content.reading?.part5 && (
                    <section>
                        <h3 className="text-2xl font-bold text-slate-700 border-b-2 border-blue-500 pb-2 mb-4">Part 5: Incomplete Sentences</h3>
                        <div className="space-y-6">
                            {content.reading.part5.map((q, i) => (
                                <div key={`r5_${i}`}>
                                    {renderQuestionBlock(
                                        `Question ${i + 101}: ${q.sentence_with_blank.replace('____', '[ ____ ]')}`,
                                        q.options,
                                        q.correctOptionIndex,
                                        answers[`r5_${i}`] ?? null,
                                        q.explanation_jp
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {content.reading?.part6 && (
                    <section>
                        <h3 className="text-2xl font-bold text-slate-700 border-b-2 border-blue-500 pb-2 mb-4">Part 6: Text Completion</h3>
                         <div className="space-y-8">
                            {content.reading.part6.map((passage, pIndex) => {
                                const qStartIndex = 131 + (pIndex * 4);
                                return (
                                    <div key={`r6p_${pIndex}`} className="bg-slate-50 p-4 rounded-lg">
                                        <p className="whitespace-pre-wrap leading-relaxed mb-6">{passage.passage}</p>
                                        {passage.questions.map((q, qIndex) => (
                                            <div key={`r6_${pIndex}_${qIndex}`}>
                                                {renderQuestionBlock(
                                                    `Question ${qStartIndex + qIndex}: (Blank ${q.blank_number})`,
                                                    q.options,
                                                    q.correctOptionIndex,
                                                    answers[`r6_${pIndex}_${qIndex}`] ?? null,
                                                    q.explanation_jp
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                )}

                {content.reading?.part7 && (
                    <section>
                        <h3 className="text-2xl font-bold text-slate-700 border-b-2 border-blue-500 pb-2 mb-4">Part 7: Reading Comprehension</h3>
                        <div className="space-y-8">
                            {content.reading.part7.map((exercise, eIndex) => {
                                let qNumberOffset = 0;
                                const currentQuestions = exercise.questions.map((q, qIndex) => {
                                    const questionNumber = part7QCounter + qNumberOffset + qIndex;
                                    return (
                                         <div key={`r7_${eIndex}_${qIndex}`}>
                                            {renderQuestionBlock(
                                                `Question ${questionNumber}: ${q.question}`,
                                                q.options,
                                                q.correctOptionIndex,
                                                answers[`r7_${eIndex}_${qIndex}`] ?? null,
                                                q.explanation
                                            )}
                                        </div>
                                    )
                                });
                                part7QCounter += exercise.questions.length;

                                return (
                                    <div key={`r7e_${eIndex}`} className="bg-slate-50 p-4 rounded-lg">
                                        {exercise.passages.map((p, pIndex) => (
                                            <div key={pIndex} className="mb-4 border-b pb-4">
                                                <h4 className="font-bold">{p.title} ({p.type})</h4>
                                                <p className="whitespace-pre-wrap">{p.content}</p>
                                            </div>
                                        ))}
                                        {currentQuestions}
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
};

const MockTestMode: React.FC<MockTestModeProps> = ({ onGoHome, onApiError }) => {
  const [view, setView] = useState<View>('lobby');
  const [tests, setTests] = useState<MockTest[]>([]);
  const [selectedTest, setSelectedTest] = useState<MockTest | null>(null);
  const [currentAttempt, setCurrentAttempt] = useState<MockTestAttempt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genStatus, setGenStatus] = useState({ message: '', progress: 0 });
  const [testTimeLeft, setTestTimeLeft] = useState(120 * 60);

  const fetchTests = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedTests = await getAllMockTests();
      setTests(storedTests.sort((a, b) => b.createdAt - a.createdAt));
      const isGeneratingTest = storedTests.some(t => t.status === 'generating');
      setIsGenerating(isGeneratingTest);
    } catch (e) {
      console.error(e);
      setError("データベースから模擬試験の読み込みに失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'lobby') {
      fetchTests();
    }
  }, [view, fetchTests]);

  const handleStartAttempt = async (test: MockTest, attemptToResume?: MockTestAttempt) => {
    if (test.status !== 'complete') {
        alert("This test is not ready to be taken.");
        return;
    }

    if (attemptToResume) {
        setCurrentAttempt(attemptToResume);
    } else {
        const newAttempt: Omit<MockTestAttempt, 'id'> & {id: string} = {
            id: `attempt_${Date.now()}`,
            date: Date.now(),
            status: 'in-progress',
            answers: {},
            score: { listening: 0, reading: 0, total: 0 },
            timeLeft: 120 * 60,
        };
        const updatedTest = { ...test, attempts: [...test.attempts, newAttempt] };
        await updateMockTest(updatedTest);
        setSelectedTest(updatedTest);
        setCurrentAttempt(newAttempt);
    }
    
    setView('taking');
  };

  const handleGenerateOrResumeTest = async (testToResume?: MockTest) => {
    setView('generating');
    setError(null);
    let test: MockTest;
    let allPrompts: string[] = [];

    // Gather existing prompts from all tests to ensure diversity
    const allTests = await getAllMockTests();
    allPrompts = allTests.flatMap(t => t.imagePrompts || []);


    if (testToResume) {
        test = { ...testToResume, status: 'generating' }; // Ensure status is generating
    } else {
        const newTestPlaceholder: Omit<MockTest, 'id'> = {
            name: `模擬試験 ${tests.length + 1}`,
            createdAt: Date.now(),
            level: 'Slightly Harder',
            content: {},
            imagePrompts: [],
            advice: '',
            attempts: [],
            status: 'generating',
        };
        const newTestId = await addMockTest(newTestPlaceholder);
        const createdTest = await getMockTest(newTestId);
        if (!createdTest) throw new Error("Failed to create and retrieve new test from DB.");
        test = createdTest;
    }
    
    setIsGenerating(true);

    if (!test.content.listening) test.content.listening = {};
    if (!test.content.reading) test.content.reading = {};
    if (!test.imagePrompts) test.imagePrompts = [];

    try {
        const totalSteps = GENERATION_CONFIG.length;
        for (let i = 0; i < totalSteps; i++) {
            const step = GENERATION_CONFIG[i];
            const progress = (i / totalSteps) * 100;
            
            const isStepComplete = step.id === 'advice' ? !!test.advice : !!(test.content as any)[step.store]?.[step.id];

            if (isStepComplete) {
                console.log(`Skipping already generated: ${step.name}`);
                continue;
            }

            setGenStatus({ message: `${step.name}を生成中...`, progress });

            let result: any;
            if (step.id === 'part1') {
                result = [];
                for (let j = 0; j < step.count; j++) {
                    setGenStatus({ message: `${step.name} (${j + 1}/${step.count}) - 画像プロンプトを作成中...`, progress });
                    const imagePrompt = await generateImagePrompt(allPrompts);
                    if (!imagePrompt) throw new Error("画像プロンプトの生成に失敗しました。");
                    allPrompts.push(imagePrompt);
                    test.imagePrompts.push(imagePrompt);
                    
                    setGenStatus({ message: `${step.name} (${j + 1}/${step.count}) - 画像を作成中...`, progress: progress + ((j / step.count) * (100 / totalSteps) * 0.5) });
                    const image_base64 = await generateImage(imagePrompt);
                    if (!image_base64) throw new Error("画像の生成に失敗しました。");

                    setGenStatus({ message: `${step.name} (${j + 1}/${step.count}) - 問題を作成中...`, progress: progress + ((j / step.count) * (100 / totalSteps)) });
                    const question = await generatePart1Batch(image_base64, imagePrompt);
                    if (!question) throw new Error(`${step.name}の問${j + 1}の生成に失敗しました。`);
                    result.push(question);
                }
            } else if (step.id === 'part7') {
                result = await step.generator(step.count[0], step.count[1]);
            } else if (step.id === 'advice') {
                result = await step.generator(test.content as MockTestContent);
            } else {
                result = await (step.generator as (count: number) => Promise<any>)(step.count as number);
            }

            if (!result) throw new Error(`${step.name} の生成に失敗しました。`);

            if (step.id === 'advice') {
                test.advice = result || "スコア向上のためには、一貫した練習が重要です。";
            } else {
                (test.content as any)[step.store][step.id] = result;
            }
            
            await updateMockTest(test);
        }

        test.status = 'complete';
        await updateMockTest(test);
        setGenStatus({ message: '生成完了！', progress: 100 });
        setIsGenerating(false);
        setTimeout(() => setView('lobby'), 1500);

    } catch (e: any) {
        onApiError(e);
        const errorMessage = `テスト生成中にエラーが発生しました: ${e.message}。`;
        setError(errorMessage);
        test.status = 'failed';
        test.errorMessage = e.message;
        await updateMockTest(test);
        setIsGenerating(false);
    }
  };

  const handlePauseAttempt = async (answers: UserAnswers, timeLeft: number) => {
    if (!selectedTest || !currentAttempt) return;
    
    const updatedAttempt = { ...currentAttempt, answers, timeLeft };
    const updatedTest = { ...selectedTest, attempts: selectedTest.attempts.map(a => a.id === updatedAttempt.id ? updatedAttempt : a) };

    await updateMockTest(updatedTest);
    setView('lobby');
  };

  const handleFinishAttempt = async (finalAnswers: UserAnswers) => {
    if (!selectedTest || !currentAttempt) return;
    if (selectedTest.status !== 'complete' || !selectedTest.content.listening || !selectedTest.content.reading) {
        setError("Test content is not fully available for scoring.");
        return;
    }

    let listeningCorrect = 0;
    let readingCorrect = 0;
    const { content } = selectedTest;

    Object.entries(finalAnswers).forEach(([key, userAnswer]) => {
        const parts = key.split('_');
        const part = parts[0];
        const isListening = part.startsWith('l');
        
        let correctIndex: number | undefined;

        try {
            if (part === 'l1') correctIndex = content.listening?.part1?.[+parts[1]].correctOptionIndex;
            else if (part === 'l2') correctIndex = content.listening?.part2?.[+parts[1]].correctOptionIndex;
            else if (part === 'l3') correctIndex = content.listening?.part3?.[+parts[1]].questions[+parts[2]].correctOptionIndex;
            else if (part === 'l4') correctIndex = content.listening?.part4?.[+parts[1]].questions[+parts[2]].correctOptionIndex;
            else if (part === 'r5') correctIndex = content.reading?.part5?.[+parts[1]].correctOptionIndex;
            else if (part === 'r6') correctIndex = content.reading?.part6?.[+parts[1]].questions[+parts[2]].correctOptionIndex;
            else if (part === 'r7') correctIndex = content.reading?.part7?.[+parts[1]].questions[+parts[2]].correctOptionIndex;

            if (userAnswer === correctIndex) {
                if(isListening) listeningCorrect++;
                else readingCorrect++;
            }
        } catch(e) { console.error(`Scoring error for key ${key}:`, e) }
    });

    const listeningQuestionCount = 100;
    const readingQuestionCount = 100;
    
    const finalAttempt: MockTestAttempt = {
      ...currentAttempt,
      status: 'completed',
      answers: finalAnswers,
      timeLeft: 0,
      score: {
        listening: Math.round((listeningCorrect / listeningQuestionCount) * 100),
        reading: Math.round((readingCorrect / readingQuestionCount) * 100),
        total: Math.round(((listeningCorrect + readingCorrect) / (listeningQuestionCount + readingQuestionCount)) * 100),
      },
      date: Date.now(),
    };
    
    const updatedTest = { ...selectedTest, attempts: selectedTest.attempts.map(a => a.id === finalAttempt.id ? finalAttempt : a) };
    await updateMockTest(updatedTest);
    setSelectedTest(updatedTest);
    setCurrentAttempt(finalAttempt);
    setView('results');
  };
  
  const handleDeleteTest = async (testId: number) => {
      if (window.confirm("このテストとすべての履歴を本当に削除しますか？この操作は元に戻せません。")) {
          await deleteMockTest(testId);
          fetchTests();
      }
  }

  const renderLobby = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-800">模擬試験</h1>
        <button 
            onClick={() => handleGenerateOrResumeTest()} 
            className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition disabled:bg-slate-400 disabled:cursor-not-allowed"
            disabled={isGenerating}
            title={isGenerating ? "別のテストが生成中のため、新規作成はできません。" : ""}
        >
          新しいテストを生成
        </button>
      </div>
      {isLoading ? <LoadingSpinner /> : error ? <p className="text-red-500">{error}</p> : (
        <div className="space-y-4">
          {tests.length === 0 && <p className="text-center text-slate-500 py-8">模擬試験がありません。新しいテストを生成して始めましょう！</p>}
          {tests.map(test => {
            const bestScore = test.attempts.length > 0 ? Math.max(...test.attempts.filter(a => a.status === 'completed').map(a => a.score.total)) : null;
            const inProgressAttempt = test.attempts.find(a => a.status === 'in-progress');
            
            let statusStyles = "bg-white";
            let statusText = "";
            if (test.status === 'generating') {
                statusStyles = "bg-yellow-50 border-yellow-300";
                statusText = "生成中...";
            } else if (test.status === 'failed') {
                statusStyles = "bg-red-50 border-red-300";
                statusText = "生成失敗";
            }

            return (
              <div key={test.id} className={`${statusStyles} p-4 rounded-lg shadow-md flex flex-col sm:flex-row justify-between items-center gap-4`}>
                <div>
                  <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2">
                    {test.name}
                    {statusText && <span className="text-sm font-semibold text-slate-600 bg-slate-200 px-2 py-1 rounded-full">{statusText}</span>}
                  </h2>
                  <p className="text-sm text-slate-500">
                    作成日: {new Date(test.createdAt).toLocaleDateString()}
                  </p>
                  {test.status === 'complete' && 
                    <p className="text-sm text-slate-500">
                        受験回数: {test.attempts.filter(a => a.status === 'completed').length} | 最高スコア: {bestScore !== null ? `${bestScore}%` : '未受験'}
                    </p>
                  }
                  {test.status === 'failed' && <p className="text-sm text-red-600">理由: {test.errorMessage || '不明なエラー'}</p>}
                </div>
                <div className="flex gap-2 items-center">
                   <button onClick={() => handleDeleteTest(test.id!)} className="p-2 bg-rose-100 text-rose-700 rounded-md hover:bg-rose-200" title="テストを削除"><TrashIcon /></button>
                   {test.status === 'complete' && <>
                        {test.attempts.filter(a => a.status === 'completed').length > 0 && 
                            <button onClick={() => { setSelectedTest(test); setView('history'); }} className="p-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300" title="履歴を見る"><HistoryIcon /></button>
                        }
                        {inProgressAttempt ? (
                            <button onClick={() => handleStartAttempt(test, inProgressAttempt)} className="bg-orange-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-orange-600">
                                再開
                            </button>
                        ) : (
                            <button onClick={() => handleStartAttempt(test)} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700">
                                テスト開始
                            </button>
                        )}
                   </>}
                   {test.status === 'generating' &&
                        <button onClick={() => handleGenerateOrResumeTest(test)} className="bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-yellow-600 flex items-center gap-2">
                            <ResumeIcon/> 生成を再開
                        </button>
                   }
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
  
  const renderHistory = () => {
      if (!selectedTest) return null;
      return (
        <div>
            <h2 className="text-2xl font-bold text-slate-800 mb-4">{selectedTest.name} の受験履歴</h2>
            <div className="space-y-3">
                {selectedTest.attempts.filter(a => a.status === 'completed').length === 0 && <p>まだ完了した受験履歴はありません。</p>}
                {selectedTest.attempts.filter(a => a.status === 'completed').sort((a, b) => b.date - a.date).map(attempt => (
                    <div key={attempt.id} className="bg-white p-3 rounded-md shadow-sm flex justify-between items-center">
                        <div>
                            <p><strong>受験日:</strong> {new Date(attempt.date).toLocaleString()}</p>
                            <p><strong>スコア:</strong> {attempt.score.total}% (L: {attempt.score.listening}%, R: {attempt.score.reading}%)</p>
                        </div>
                        <button onClick={() => { setSelectedTest(selectedTest); setCurrentAttempt(attempt); setView('review');}} className="bg-blue-100 text-blue-800 font-semibold py-1 px-3 rounded-md hover:bg-blue-200">
                            復習する
                        </button>
                    </div>
                ))}
            </div>
        </div>
      );
  }

  const renderResults = () => {
    if (!selectedTest || !currentAttempt) return null;
    const { score } = currentAttempt;
    return (
      <div className="text-center bg-white p-8 rounded-2xl shadow-xl">
        <h2 className="text-4xl font-bold text-slate-800 mb-4">テスト完了！</h2>
        <p className="text-2xl text-slate-600 mb-6"><span className="font-bold">{selectedTest.name}</span>の結果です。</p>
        <div className="my-8"> <p className="text-6xl font-bold text-blue-600">{score.total}%</p> <p className="text-slate-500">総合スコア</p> </div>
        <div className="flex justify-around mb-8">
            <div> <p className="text-3xl font-bold text-teal-600">{score.listening}%</p> <p className="text-slate-500">リスニング</p> </div>
            <div> <p className="text-3xl font-bold text-violet-600">{score.reading}%</p> <p className="text-slate-500">リーディング</p> </div>
        </div>
        <div className="text-left bg-slate-50 p-4 rounded-lg border border-slate-200 mb-8">
            <h3 className="font-bold text-lg text-slate-700 mb-2">AI学習アドバイス</h3>
            <p className="text-slate-600 whitespace-pre-wrap">{selectedTest.advice}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
            <button onClick={() => setView('review')} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition">解答を見直す</button>
        </div>
      </div>
    );
  };
  
  const renderGenerating = () => (
    <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-2xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-slate-800 mb-4">模擬試験を生成中...</h2>
        <p className="text-slate-600 mb-6">これには数分かかる場合があります。このページを開いたままにしてください。</p>
        
        <div className="w-full bg-slate-200 rounded-full h-4 my-4 overflow-hidden">
            <div 
                className="bg-blue-600 h-4 rounded-full transition-all duration-500" 
                style={{ width: `${genStatus.progress}%` }}
            ></div>
        </div>
        
        <p className="text-blue-700 font-semibold mb-6">{genStatus.message || "準備中..."}</p>

        {error && (
            <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-lg">
                <p className="font-bold">エラーが発生しました:</p>
                <p>{error}</p>
            </div>
        )}
    </div>
  );

  const renderContent = () => {
    switch (view) {
      case 'generating': return renderGenerating();
      case 'taking':
        if (selectedTest && currentAttempt) return <TestPlayer key={currentAttempt.id} test={selectedTest} attempt={currentAttempt} onFinishAttempt={handleFinishAttempt} onPauseAttempt={handlePauseAttempt} onTimeUpdate={setTestTimeLeft} />;
        return null;
      case 'results': return renderResults();
      case 'review':
        if (selectedTest && currentAttempt) return <ReviewPlayer test={selectedTest} attempt={currentAttempt} />;
        return null;
      case 'history': return renderHistory();
      case 'lobby':
      default: return renderLobby();
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4">
        {view === 'taking' && (
             <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm shadow-md p-2 rounded-lg mb-4 text-center">
                 <h3 className="font-bold text-slate-800">残り時間</h3>
                <p className={`text-2xl font-mono font-bold ${testTimeLeft < 600 ? 'text-red-500' : 'text-slate-800'}`}>{formatTime(testTimeLeft)}</p>
            </div>
        )}
      <div className="flex justify-between items-center mb-6">
          <button 
              onClick={view === 'lobby' ? onGoHome : () => setView('lobby')} 
              className="text-blue-600 hover:text-blue-800 font-semibold"
          >
              &larr; {view === 'lobby' ? 'ホームに戻る' : 'テスト一覧に戻る'}
          </button>
           {view !== 'lobby' && <button onClick={onGoHome} className="text-sm text-slate-500 hover:text-slate-700">ホームへ</button>}
      </div>
      {renderContent()}
    </div>
  );
};

export default MockTestMode;
