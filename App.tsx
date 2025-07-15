
import React, { useState, useCallback, useEffect } from 'react';
import { Screen, Level, VocabCategory, VocabType, VocabDBItem, ListeningPart, PartOfSpeech } from './types';
import { ALL_LEVELS, ALL_CATEGORIES, LISTENING_PARTS } from './constants';
import HomeScreen from './screens/HomeScreen';
import VocabularyMode from './screens/VocabularyMode';
import ReadingMode from './screens/ReadingMode';
import DriveMode from './screens/DriveMode';
import { ListeningMode } from './screens/ListeningMode';
import Part5Mode from './screens/Part5Mode';
import Part6Mode from './screens/Part6Mode';
import WordListScreen from './screens/WordListScreen';
import BasicGrammarMode from './screens/BasicGrammarMode';
import GrammarCheckScreen from './screens/GrammarCheckScreen';
import AdminScreen from './screens/AdminScreen';
import UserManualScreen from './screens/UserManualScreen';
import CategorySelectionModal from './components/CategorySelectionModal';
import ListeningPartSelectionModal from './components/ListeningPartSelectionModal';
import { getVocabCount, addVocabularyItems, getExistingWords } from './db';
import { generateVocabulary, setApiKey as setGeminiApiKey } from './services/geminiService';
import { useAudioUnlock } from './hooks/useAudioUnlock';
import { INITIAL_VOCAB_DATA } from './data/initial-vocab.data';

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.Home);
  const [selectedLevel, setSelectedLevel] = useState<Level>(Level.Beginner);
  
  const [isInitializing, setIsInitializing] = useState(true);
  const [initStatus, setInitStatus] = useState('Initializing...');
  const [dbWordCount, setDbWordCount] = useState(0);
  const [isApiKeySet, setIsApiKeySet] = useState(false);

  const [categoryModalTarget, setCategoryModalTarget] = useState<Screen | null>(null);
  const [isListeningPartModalVisible, setIsListeningPartModalVisible] = useState(false);
  
  const [selectedInitialCategory, setSelectedInitialCategory] = useState<VocabCategory | 'Random'>('Random');
  const [selectedListeningPart, setSelectedListeningPart] = useState<ListeningPart | 'Random'>('Random');
  
  const { unlockAudio } = useAudioUnlock();

  useEffect(() => {
    const storedApiKey = localStorage.getItem('gemini-api-key');
    if (storedApiKey) {
        setGeminiApiKey(storedApiKey);
        setIsApiKeySet(true);
    }
  }, []);

  const updateWordCount = useCallback(async () => {
    const count = await getVocabCount();
    setDbWordCount(count);
    return count;
  }, []);

  useEffect(() => {
    const setupDatabase = async () => {
      setIsInitializing(true);
      setInitStatus('Loading vocabulary from local database...');
      try {
        let count = await updateWordCount();
        if (count === 0) {
          setInitStatus('Database is empty. Seeding with initial vocabulary...');
          await addVocabularyItems(INITIAL_VOCAB_DATA as VocabDBItem[]);
          setInitStatus('Added initial items. Updating count...');
          count = await updateWordCount();
        }
        setInitStatus(`Database ready. ${count} items loaded.`);
      } catch (error) {
          console.error('Failed to initialize database:', error);
          setInitStatus('Error setting up vocabulary. Please refresh.');
      } finally {
        setIsInitializing(false);
      }
    };
    setupDatabase();
  }, [updateWordCount]);
  
  const handleApiError = (error: unknown) => {
    if (error instanceof Error) {
        alert(`An API error occurred: ${error.message}`);
    } else {
        alert("An unknown API error occurred.");
    }
  }

  const handleGoHome = useCallback(() => {
    setCurrentScreen(Screen.Home);
    updateWordCount();
  }, [updateWordCount]);

  const handleGoToUserManual = useCallback(() => {
    setCurrentScreen(Screen.UserManual);
  }, []);

  const handleAiCollection = async (level: Level | typeof ALL_LEVELS, category: VocabCategory | typeof ALL_CATEGORIES, type: VocabType | 'all'): Promise<number> => {
      unlockAudio();
      try {
        const existingWords = await getExistingWords(level, category, type, 1500);
        const newItems = await generateVocabulary(level, category, type, existingWords);
        if (!newItems || newItems.length === 0) return 0;
        
        const validatedItems: VocabDBItem[] = newItems
          .map((item): Partial<VocabDBItem> => {
              const itemType = type === 'all' ? item.type : type;

              const completeItem = {
                ...item,
                level: item.level || (level !== ALL_LEVELS ? level : undefined),
                category: item.category || (category !== ALL_CATEGORIES ? category : undefined),
                type: itemType,
                pos: itemType === 'word' ? item.pos : null,
              };
              return completeItem;
          })
          .filter((item): item is VocabDBItem => {
              if (!item.english || !item.japanese || !item.example_en || !item.example_jp || !item.level || !item.category || !item.type) {
                console.warn('Skipping item with missing core data:', item);
                return false;
              }
              if (item.type === 'word' && (!item.pos || !Object.values(PartOfSpeech).includes(item.pos))) {
                  console.warn('Skipping word with invalid or missing POS:', item);
                  return false;
              }
              return true;
          });


        if (validatedItems.length > 0) {
          const addedCount = await addVocabularyItems(validatedItems);
          await updateWordCount();
          return addedCount;
        }
        return 0;
      } catch (error) {
        handleApiError(error);
        return 0;
      }
  };

  const handleStart = (screen: Screen, level: Level, isModal: boolean = false) => {
    unlockAudio();
    setSelectedLevel(level);
    if (isModal) {
      setCategoryModalTarget(screen);
    } else {
      setCurrentScreen(screen);
    }
  };

  const handleStartVocabulary = (level: Level) => {
    unlockAudio();
    setSelectedLevel(level);
    setCurrentScreen(Screen.Vocabulary);
  };

  const handleStartDrive = (level: Level) => {
    unlockAudio();
    setSelectedLevel(level);
    setCurrentScreen(Screen.Drive);
  };
  
  const handleStartReading = (level: Level) => handleStart(Screen.Reading, level, true);
  const handleStartPart5 = (level: Level) => handleStart(Screen.Part5, level, true);
  const handleStartPart6 = (level: Level) => handleStart(Screen.Part6, level, true);
  
  const handleStartBasicGrammar = () => {
    unlockAudio();
    setCurrentScreen(Screen.BasicGrammar);
  };
  const handleStartGrammarCheck = () => {
    unlockAudio();
    setCurrentScreen(Screen.GrammarCheck);
  };

  const handleStartListening = (level: Level) => {
    unlockAudio();
    setSelectedLevel(level);
    setIsListeningPartModalVisible(true);
  };
  
  const handleListeningPartSelected = (part: ListeningPart | 'Random') => {
    setSelectedListeningPart(part);
    setIsListeningPartModalVisible(false);
    setCategoryModalTarget(Screen.Listening);
  }

  const handleViewWordList = () => {
    unlockAudio();
    setCurrentScreen(Screen.WordList);
  };

  const handleGoToAdmin = () => {
    setCurrentScreen(Screen.Admin);
  };

  const handleCategorySelected = (category: VocabCategory | 'Random') => {
    if (categoryModalTarget) {
      setSelectedInitialCategory(category);
      setCurrentScreen(categoryModalTarget);
      setCategoryModalTarget(null);
    }
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case Screen.Vocabulary:
        return <VocabularyMode level={selectedLevel} onGoHome={handleGoHome} />;
      case Screen.Reading:
        return <ReadingMode level={selectedLevel} onGoHome={handleGoHome} initialCategory={selectedInitialCategory} onApiError={handleApiError} />;
      case Screen.Drive:
        return <DriveMode level={selectedLevel} onGoHome={handleGoHome} />;
      case Screen.Listening:
        const part = selectedListeningPart === 'Random' 
            ? LISTENING_PARTS[Math.floor(Math.random() * LISTENING_PARTS.length)] 
            : selectedListeningPart;
        return <ListeningMode level={selectedLevel} onGoHome={handleGoHome} initialCategory={selectedInitialCategory} part={part} onApiError={handleApiError} />;
      case Screen.Part5:
        return <Part5Mode level={selectedLevel} onGoHome={handleGoHome} initialCategory={selectedInitialCategory} onApiError={handleApiError} />;
      case Screen.Part6:
        return <Part6Mode level={selectedLevel} onGoHome={handleGoHome} initialCategory={selectedInitialCategory} onApiError={handleApiError} />;
      case Screen.WordList:
        return <WordListScreen onGoHome={handleGoHome} onApiError={handleApiError} />;
      case Screen.BasicGrammar:
        return <BasicGrammarMode onGoHome={handleGoHome} onApiError={handleApiError} />;
      case Screen.GrammarCheck:
        return <GrammarCheckScreen onGoHome={handleGoHome} onApiError={handleApiError} />;
      case Screen.Admin:
        return <AdminScreen 
            onGoHome={handleGoHome}
            onAiCollect={handleAiCollection}
            dbWordCount={dbWordCount}
            isInitializing={isInitializing}
            initStatus={initStatus}
            isApiKeySet={isApiKeySet}
            onViewWordList={handleViewWordList}
            onImportJson={updateWordCount}
        />;
      case Screen.UserManual:
        return <UserManualScreen onGoHome={handleGoHome} />;
      case Screen.Home:
      default:
        return (
          <HomeScreen
            onStartVocabulary={handleStartVocabulary}
            onStartReading={handleStartReading}
            onStartDrive={handleStartDrive}
            onStartListening={handleStartListening}
            onStartPart5={handleStartPart5}
            onStartPart6={handleStartPart6}
            onStartBasicGrammar={handleStartBasicGrammar}
            onStartGrammarCheck={handleStartGrammarCheck}
            onGoToAdmin={handleGoToAdmin}
            dbWordCount={dbWordCount}
            isInitializing={isInitializing}
            initStatus={initStatus}
            isApiKeySet={isApiKeySet}
            onApiKeyUpdate={setIsApiKeySet}
            onViewWordList={handleViewWordList}
            onImportJson={updateWordCount}
            onGoToUserManual={handleGoToUserManual}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans flex flex-col items-center p-4">
      {isListeningPartModalVisible && (
        <ListeningPartSelectionModal 
            onSelectPart={handleListeningPartSelected}
            onClose={() => setIsListeningPartModalVisible(false)}
        />
      )}
      {categoryModalTarget && (
        <CategorySelectionModal 
          onSelectCategory={handleCategorySelected}
          onClose={() => setCategoryModalTarget(null)}
        />
      )}
      <main key={currentScreen} className="w-full max-w-4xl mx-auto">
        {renderScreen()}
      </main>
    </div>
  );
};
