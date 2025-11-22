
export enum Difficulty {
  Learning = 'Learning',
  Beginner = 'Beginner',
  Intermediate = 'Intermediate',
  Advanced = 'Advanced',
  Expert = 'Expert'
}

export type SupportedLanguage = 'TypeScript' | 'JavaScript' | 'Python' | 'Java' | 'C' | 'C++' | 'Go' | 'Rust' | 'R';

export type ChatMode = 'default' | 'fast' | 'thinking' | 'search';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  category: string;
  language: SupportedLanguage;
  starterCode: string;
  requirements: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  groundingMetadata?: any;
}

export interface CodeSubmission {
  code: string;
  language: string;
  notes: string;
}

export interface SubmissionResult {
  success: boolean;
  status: 'Correct' | 'Incorrect' | 'Syntax Error';
  mistakes: string[];
  feedback: string;
}

export enum ViewState {
  Dashboard = 'Dashboard',
  Challenge = 'Challenge',
  LiveSession = 'LiveSession',
  History = 'History'
}
