

export enum Screen {
  Home,
  Vocabulary,
  Reading,
  Drive,
  Listening,
  WordList,
  Part5,
  Part6,
  BasicGrammar,
  GrammarCheck,
  Admin,
  UserManual,
  MockTest,
}

export enum Level {
  Beginner = 'Beginner (TOEIC 400-600)',
  Intermediate = 'Intermediate (TOEIC 600-800)',
  Advanced = 'Advanced (TOEIC 800-990)',
}

export enum VocabCategory {
    Business = 'Business',
    Travel = 'Travel',
    DailyLife = 'Daily Life',
    Finance = 'Finance',
    Health = 'Health',
}

export type VocabType = 'word' | 'idiom';

export enum PartOfSpeech {
  Noun = 'Noun',
  Verb = 'Verb',
  Adjective = 'Adjective',
  Adverb = 'Adverb',
}

export type SortOrder = 'Random' | 'Alphabetical';

export interface VocabDBItem {
  id?: number;
  english: string;
  japanese: string;
  pos?: PartOfSpeech | null;
  example_en: string;
  example_jp: string;
  level: Level;
  category: VocabCategory;
  type: VocabType;
  frequencyLevel?: number; // 1: Low, 2: Medium, 3: High
}

export interface Sentence {
  english: string;
  japanese: string;
}

export interface ReadingQuestion {
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export interface ReadingPassage {
  passage: Sentence[];
  idioms: {
    english: string;
    japanese: string;
  }[];
  questions: ReadingQuestion[];
  key_sentence_indices: number[];
}

// --- LISTENING ---
export enum ListeningPart {
    Part1 = 'Part 1: Photographs',
    Part2 = 'Part 2: Question-Response',
    Part3 = 'Part 3: Conversation',
    Part4 = 'Part 4: Short Talk',
}

export interface QuestionResponseExercise {
    part: ListeningPart.Part2;
    question: string;
    options: string[];
    correctOptionIndex: number;
    explanation: string;
}

export interface ListeningPassage {
    passage: Sentence[];
    title: string;
}

export interface ListeningOption {
    en: string;
    jp: string;
}

export interface ListeningQuestion {
    question: string;
    options: ListeningOption[];
    correctOptionIndex: number;
    explanation: string;
}

export interface ConversationExercise extends ListeningPassage, ListeningQuestion {
    part: ListeningPart.Part3 | ListeningPart.Part4;
}

export type ListeningExercise = QuestionResponseExercise | ConversationExercise;


// --- GRAMMAR / READING ---

export interface IncompleteSentenceExercise {
    part: 'Part 5';
    sentence_with_blank: string;
    options: string[];
    correctOptionIndex: number;
    explanation_jp: string;
}

export interface TextCompletionQuestion {
    blank_number: number;
    options: string[];
    correctOptionIndex: number;
    explanation_jp: string;
}

export interface TextCompletionExercise {
    part: 'Part 6';
    passage: string; // Passage with numbered blanks like "[1]", "[2]"
    questions: TextCompletionQuestion[];
}

export interface GrammarQuizQuestion {
    question_jp: string;
    sentence_with_blank: string;
    options: string[];
    correctOptionIndex: number;
    explanation_jp: string;
}

export interface GrammarCheckResult {
    originalSentence: string;
    correctedSentence: string;
    explanation_jp: string;
}

// --- MOCK TEST ---

export interface PhotoDescriptionExercise {
    part: 'Part 1';
    image_base64: string;
    imagePrompt: string;
    options: string[]; // 4 options
    correctOptionIndex: number;
    explanation: string;
}

export interface MockTestConversation {
    part: ListeningPart.Part3 | ListeningPart.Part4;
    passage: Sentence[];
    title: string;
    questions: ListeningQuestion[]; // 3 questions per conversation/talk
}

export interface Part7Passage {
    type: 'Email' | 'Article' | 'Advertisement' | 'Form' | 'Chart' | 'Memo' | 'Notice';
    title: string;
    content: string; // The text of the passage
}
export interface Part7Exercise {
    part: 'Part 7';
    passages: Part7Passage[]; // 1 for single, 2-3 for multiple
    questions: ReadingQuestion[];
}


export interface MockTestContent {
    listening?: {
        part1?: PhotoDescriptionExercise[];
        part2?: QuestionResponseExercise[];
        part3?: MockTestConversation[];
        part4?: MockTestConversation[];
    };
    reading?: {
        part5?: IncompleteSentenceExercise[];
        part6?: TextCompletionExercise[];
        part7?: Part7Exercise[];
    };
}


export type UserAnswers = { [questionKey: string]: number | null };

export interface MockTestAttempt {
    id: string; // Unique ID for this attempt, e.g., a timestamp
    date: number; // Timestamp of completion
    status: 'in-progress' | 'completed';
    answers: UserAnswers;
    timeLeft?: number;
    score: {
        total: number;
        listening: number;
        reading: number;
    };
}

export interface MockTest {
    id?: number;
    name: string;
    createdAt: number; // Timestamp
    level: Level | 'Slightly Harder';
    content: MockTestContent;
    imagePrompts?: string[];
    status: 'generating' | 'complete' | 'failed';
    advice: string;
    attempts: MockTestAttempt[];
    errorMessage?: string;
}

// A unique key for each question in a test
// Format: part_passageIndex_questionIndex
export type MockTestQuestionKey = `l1_${number}` | `l2_${number}` | `l3_${number}_${number}` | `l4_${number}_${number}` | `r5_${number}` | `r6_${number}_${number}` | `r7_${number}_${number}`;
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;