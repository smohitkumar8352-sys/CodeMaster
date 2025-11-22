
import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, PlayCircle, CheckCircle, Code, Terminal, Award, Book, Layers, Send, XCircle, AlertTriangle, Keyboard, Maximize2, Minimize2, Save, FolderOpen, X } from 'lucide-react';
import { generateChallenge, reviewCode, submitSolution } from '../services/gemini';
import { Challenge, Difficulty, SupportedLanguage, SubmissionResult } from '../types';

const ChallengeView: React.FC = () => {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState('');
  const [review, setReview] = useState('');
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [language, setLanguage] = useState<SupportedLanguage>('Python');
  // Initialize topic based on default language (Python)
  const [topic, setTopic] = useState('Variables & Data Types');
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.Intermediate);

  // Turbo Mode States
  const [isTurboMode, setIsTurboMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [turboMessage, setTurboMessage] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const languages: SupportedLanguage[] = ['Python', 'C', 'C++', 'Java', 'JavaScript', 'TypeScript', 'Go', 'Rust', 'R'];

  const languageTopics: Record<SupportedLanguage, string[]> = {
    'Python': [
      'Variables & Data Types', 'Input/Output', 'Operators', 
      'Conditions (If/Elif/Else)', 'Loops (For/While)', 'Lists & Tuples', 
      'Dictionaries & Sets', 'Functions & Lambda', 'File Handling', 
      'Exception Handling', 'Modules & Packages', 'List Comprehensions', 
      'Object-Oriented Programming', 'Decorators & Generators', 'Regular Expressions',
      'AsyncIO Basics'
    ],
    'C': [
      'Syntax & Data Types', 'Operators', 'Control Flow (If/Switch)', 
      'Loops (For/While/Do-While)', 'Arrays (1D/Multi-dimensional)', 
      'Strings & String Library', 'Functions & Recursion', 'Pointers & Arithmetic', 
      'Structures & Unions', 'Dynamic Memory Allocation', 'File I/O', 
      'Preprocessor Directives', 'Bitwise Operations', 'Command Line Arguments'
    ],
    'C++': [
      'Basic Syntax & I/O', 'Control Structures', 'Arrays & Strings', 
      'Functions & Overloading', 'Pointers & References', 'Classes & Objects', 
      'Constructors & Destructors', 'Inheritance & Polymorphism', 'Operator Overloading', 
      'Templates & Generics', 'STL Vectors & Lists', 'STL Maps & Sets', 
      'Exception Handling', 'Smart Pointers', 'Move Semantics'
    ],
    'Java': [
      'Primitive Types & Variables', 'Operators & Expressions', 'Control Flow Statements', 
      'Arrays & Strings', 'Classes & Objects', 'Methods & Constructors', 
      'Inheritance & Polymorphism', 'Abstraction & Interfaces', 'Exception Handling', 
      'Collections Framework (List, Set, Map)', 'File I/O', 'Multithreading Basics', 
      'Java Streams API', 'Generics', 'Annotations'
    ],
    'JavaScript': [
      'Variables (var/let/const)', 'Data Types & Operators', 'Control Structures', 
      'Functions & Arrow Functions', 'Arrays & Array Methods', 'Objects & Prototypes', 
      'DOM Manipulation', 'Event Handling', 'Asynchronous JS (Callbacks)', 
      'Promises & Async/Await', 'ES6+ Features', 'Error Handling', 
      'JSON & LocalStorage', 'Closures & Scope'
    ],
    'TypeScript': [
      'Basic Types & Type Inference', 'Functions & Type Annotations', 'Interfaces & Type Aliases', 
      'Classes & Access Modifiers', 'Enums & Tuples', 'Generics', 
      'Union & Intersection Types', 'Type Guards & Narrowing', 'Utility Types', 
      'Modules & Namespaces', 'Decorators', 'Advanced Types'
    ],
    'Go': [
      'Variables & Constants', 'Data Types', 'Control Structures (If/Switch)', 
      'Loops (For)', 'Arrays & Slices', 'Maps', 'Functions & Multiple Returns', 
      'Pointers', 'Structs & Methods', 'Interfaces', 'Goroutines & Concurrency', 
      'Channels', 'Error Handling & Defer', 'Panic & Recover'
    ],
    'Rust': [
      'Variables & Mutability', 'Data Types', 'Functions', 'Control Flow', 
      'Ownership & Borrowing', 'References & Slices', 'Structs & Methods', 
      'Enums & Pattern Matching', 'Collections (Vectors/HashMaps)', 'Error Handling', 
      'Generics & Traits', 'Lifetimes', 'Smart Pointers (Box/Rc/Arc)', 
      'Concurrency & Threads', 'Iterators & Closures'
    ],
    'R': [
      'Variables & Data Types', 'Vectors & Operations', 'Matrices & Arrays', 
      'Lists & Data Frames', 'Factors', 'Control Structures', 'Functions', 
      'Data Import/Export', 'Data Manipulation (Subsetting)', 'Apply Family Functions', 
      'Basic Plotting', 'Statistical Models (Linear Regression)', 'GGPlot2 Basics'
    ]
  };

  // Update topic when language changes to the first topic of that language
  useEffect(() => {
    if (languageTopics[language] && languageTopics[language].length > 0) {
        setTopic(languageTopics[language][0]);
    }
  }, [language]);

  // Turbo Mode Keyboard Shortcuts
  useEffect(() => {
    if (!isTurboMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // F1 Help
      if (e.key === 'F1') {
        e.preventDefault();
        setTurboMessage('Help: F2 Save | F3 Open | F9 Compile | Ctrl+F9 Run | Alt+X Quit');
      }
      // F2 Save
      else if (e.key === 'F2') {
        e.preventDefault();
        localStorage.setItem(`turbo_code_${language}`, code);
        setTurboMessage(`File saved to memory. (${code.length} bytes)`);
      }
      // F3 Open
      else if (e.key === 'F3') {
        e.preventDefault();
        const saved = localStorage.getItem(`turbo_code_${language}`);
        if (saved) {
          setCode(saved);
          setTurboMessage('File loaded from memory.');
        } else {
          setTurboMessage('No saved file found for this language.');
        }
      }
      // F5 Zoom/Fullscreen
      else if (e.key === 'F5') {
        e.preventDefault();
        setIsFullscreen(prev => !prev);
        setTurboMessage(isFullscreen ? 'Windowed Mode' : 'Fullscreen Mode');
      }
      // F9 Compile (Review) or Ctrl+F9 Run (Submit)
      else if (e.key === 'F9') {
        e.preventDefault();
        if (e.ctrlKey) {
          setTurboMessage('Running Program...');
          handleSubmit();
        } else if (e.altKey) {
          setTurboMessage('Compiling...');
          handleReview();
        } else {
          setTurboMessage('Compiling...');
          handleReview();
        }
      }
      // Alt+X Quit
      else if ((e.key === 'x' || e.key === 'X') && e.altKey) {
        e.preventDefault();
        setIsTurboMode(false);
        setIsFullscreen(false);
      }
      // Standard Editor Shortcuts fallback
      else if (e.key === 'Delete' && e.ctrlKey) {
         // Ctrl+Del Clear (Optional Turbo behavior, but keeping native text deletion is usually safer)
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTurboMode, code, language, isFullscreen]);

  // Clear Turbo message after delay
  useEffect(() => {
    if (turboMessage) {
      const timer = setTimeout(() => setTurboMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [turboMessage]);

  const getFileExtension = (lang: SupportedLanguage) => {
    switch(lang) {
        case 'Python': return 'py';
        case 'Java': return 'java';
        case 'C': return 'c';
        case 'C++': return 'cpp';
        case 'Go': return 'go';
        case 'Rust': return 'rs';
        case 'R': return 'r';
        case 'TypeScript': return 'ts';
        case 'JavaScript': return 'js';
        default: return 'txt';
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setReview('');
    setSubmissionResult(null);
    try {
      const newChallenge = await generateChallenge(difficulty, topic, language);
      setChallenge(newChallenge);
      setCode(newChallenge.starterCode);
    } catch (e) {
      console.error(e);
      alert("Failed to generate challenge. Please check API key or try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReview = async () => {
    if (!challenge) {
       // In Turbo mode, we might want to allow checking generic code even without a challenge, 
       // but for now we'll restrict it or mock a challenge wrapper if needed.
       if (isTurboMode && code) {
          // Temporary mock challenge for free-play checking
          const mockChallenge: Challenge = {
             id: 'turbo-check', title: 'Turbo Scratchpad', description: 'Free play', difficulty: Difficulty.Intermediate,
             category: 'General', language: language, starterCode: '', requirements: []
          };
          setIsReviewing(true);
          const feedback = await reviewCode(code, mockChallenge);
          setReview(feedback);
          setIsReviewing(false);
          if(isTurboMode) setTurboMessage('Compilation/Review Complete.');
          return;
       }
       return;
    }
    setIsReviewing(true);
    try {
      const feedback = await reviewCode(code, challenge);
      setReview(feedback);
      if(isTurboMode) setTurboMessage('Compilation/Review Complete.');
    } catch (e) {
      console.error(e);
      if(isTurboMode) setTurboMessage('Compilation Failed.');
    } finally {
      setIsReviewing(false);
    }
  };

  const handleSubmit = async () => {
    if (!challenge) {
       if(isTurboMode) setTurboMessage('Cannot Run: No Active Challenge Problem.');
       return;
    }
    setIsSubmitting(true);
    setSubmissionResult(null); // Clear previous result
    try {
      const result = await submitSolution(code, challenge);
      setSubmissionResult(result);
      if(isTurboMode) setTurboMessage(result.success ? 'Program Run: Success' : 'Program Run: Failed');
    } catch (e) {
      console.error(e);
      alert("Failed to submit solution.");
      if(isTurboMode) setTurboMessage('Error executing program.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 pb-20">
      
      {/* Control Bar - Hidden if in Turbo Fullscreen */}
      {!isFullscreen && (
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 transition-all">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full lg:w-auto">
            <div className="space-y-1">
              <label className="text-xs text-gray-500 font-mono ml-1">Language</label>
              <select 
                value={language} 
                onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 font-mono"
              >
                {languages.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-500 font-mono ml-1">Topic</label>
              <select 
                value={topic} 
                onChange={(e) => setTopic(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5"
              >
                {languageTopics[language]?.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs text-gray-500 font-mono ml-1">Level</label>
              <select 
                value={difficulty} 
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5"
              >
                {Object.values(Difficulty).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 w-full lg:w-auto">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-wait"
            >
              {isGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Terminal className="w-5 h-5" />}
              {isGenerating ? 'Creating...' : 'New Problem'}
            </button>
            
            <button
              onClick={() => setIsTurboMode(!isTurboMode)}
              className={`flex items-center justify-center gap-2 px-4 py-4 rounded-lg font-medium transition-all border ${
                isTurboMode 
                  ? 'bg-blue-900 text-yellow-400 border-yellow-500/50 shadow-[0_0_15px_rgba(30,58,138,0.5)]' 
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border-gray-700'
              }`}
              title="Toggle Turbo C++ Mode"
            >
              <Keyboard className="w-5 h-5" />
              {isTurboMode ? 'Turbo ON' : 'Turbo Mode'}
            </button>
          </div>
        </div>
      )}

      {!challenge && !isGenerating && !code && (
        <div className="text-center py-20 space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="w-24 h-24 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-700">
            <Layers className="w-12 h-12 text-emerald-500" />
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Daily Code Mastery</h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed">
            Select a language and specific topic to receive a tailored problem. <br/>
            You will receive a rigorous problem statement and requirements. <br/>
            <span className="text-emerald-400 font-medium">NO solutions are provided.</span> You must implement the logic yourself.
            <br/><span className="text-sm text-emerald-500/80 mt-2 block">Master everything from Variables to Pointers and Concurrency.</span>
          </p>
        </div>
      )}

      {/* Main Content Area */}
      <div className={`grid grid-cols-1 ${isTurboMode && isFullscreen ? '' : 'lg:grid-cols-2'} gap-8`}>
          
          {/* Challenge Details (Hidden in Fullscreen Turbo) */}
          {challenge && !isFullscreen && (
            <div className="space-y-6">
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="p-6 border-b border-gray-800 bg-gray-850">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${
                      challenge.difficulty === Difficulty.Expert ? 'bg-red-900/30 text-red-400 border border-red-900/50' : 
                      challenge.difficulty === Difficulty.Advanced ? 'bg-orange-900/30 text-orange-400 border border-orange-900/50' : 
                      challenge.difficulty === Difficulty.Intermediate ? 'bg-blue-900/30 text-blue-400 border border-blue-900/50' :
                      challenge.difficulty === Difficulty.Learning ? 'bg-purple-900/30 text-purple-400 border border-purple-900/50' :
                      'bg-green-900/30 text-green-400 border border-green-900/50'
                    }`}>
                      {challenge.difficulty}
                    </span>
                    <span className="text-emerald-500 font-mono text-sm font-medium">{challenge.language}</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-1">{challenge.title}</h2>
                  <span className="text-gray-500 text-sm">{challenge.category}</span>
                </div>
                
                <div className="p-6 space-y-6 text-gray-300 leading-relaxed">
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-2 uppercase tracking-wide text-xs">Problem Statement</h4>
                    <p className="text-gray-300 whitespace-pre-wrap">{challenge.description}</p>
                  </div>
                  
                  <div className="bg-gray-950/50 p-5 rounded-lg border border-gray-800">
                    <h4 className="text-sm font-semibold text-emerald-500 mb-3 flex items-center gap-2 uppercase tracking-wide text-xs">
                      <Award className="w-4 h-4" /> Requirements
                    </h4>
                    <ul className="space-y-2.5">
                      {challenge.requirements.map((req, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500/50 flex-shrink-0" />
                          <span className="text-gray-300">{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Submission Result Area */}
              {submissionResult && (
                 <div className={`rounded-xl border p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ${
                    submissionResult.success 
                    ? 'bg-emerald-900/20 border-emerald-500/50' 
                    : 'bg-red-900/20 border-red-500/50'
                 }`}>
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-full ${submissionResult.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {submissionResult.success ? <CheckCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                      </div>
                      <div className="flex-1">
                         <h3 className={`text-xl font-bold mb-2 ${submissionResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                            {submissionResult.status}
                         </h3>
                         <p className="text-gray-300 text-sm mb-4">{submissionResult.feedback}</p>
                         
                         {!submissionResult.success && submissionResult.mistakes.length > 0 && (
                            <div className="bg-gray-950/50 rounded-lg p-4 border border-red-500/20">
                                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                                  <AlertTriangle className="w-3 h-3" /> Mistakes Found
                                </h4>
                                <ul className="space-y-2">
                                  {submissionResult.mistakes.map((mistake, i) => (
                                     <li key={i} className="text-xs text-red-200/80 flex items-start gap-2">
                                       <span className="mt-1 w-1 h-1 rounded-full bg-red-400 flex-shrink-0"></span>
                                       {mistake}
                                     </li>
                                  ))}
                                </ul>
                            </div>
                         )}
                      </div>
                    </div>
                 </div>
              )}

              {/* Standard Review Output */}
              {review && !submissionResult && (
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-800">
                     <CheckCircle className="w-6 h-6 text-emerald-500" />
                     <h3 className="text-xl font-bold text-white">Code Review & Optimization</h3>
                   </div>
                   <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap font-mono text-gray-300 bg-gray-950 p-5 rounded-lg border border-gray-800">
                     {review}
                   </div>
                </div>
              )}
            </div>
          )}

          {/* Editor Area - Adapts to Turbo Mode */}
          {(code || challenge || isTurboMode) && (
            <div 
              ref={editorRef}
              className={`flex flex-col rounded-xl border overflow-hidden shadow-2xl transition-all duration-300 ${
                isTurboMode 
                   ? `border-gray-600 ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'h-[800px]'} font-mono`
                   : 'border-gray-800 h-[800px] bg-gray-900'
              }`}
            >
              {/* Editor Header */}
              <div className={`flex items-center justify-between px-4 py-2 border-b ${
                isTurboMode ? 'bg-gray-300 text-black border-black' : 'bg-gray-950 border-gray-800'
              }`}>
                <div className="flex items-center space-x-2">
                   {isTurboMode ? (
                      <div className="w-3 h-3 bg-black"></div>
                   ) : (
                      <>
                        <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/20"></div>
                      </>
                   )}
                   <span className={`ml-2 text-sm font-mono ${isTurboMode ? 'font-bold text-black uppercase' : 'text-gray-400'}`}>
                      {isTurboMode ? `[■] NONAME00.${getFileExtension(language).toUpperCase()}` : `main.${getFileExtension(language)}`}
                   </span>
                </div>
                
                <div className="flex gap-2">
                  {isTurboMode ? (
                      <div className="flex gap-4 text-sm font-bold">
                          <span>1=[Help]</span>
                          <span>2=[Save]</span>
                          <span>3=[Open]</span>
                          <span>9=[Make]</span>
                          <span>10=[Menu]</span>
                      </div>
                  ) : (
                      <>
                        <button
                            onClick={handleReview}
                            disabled={isReviewing || isSubmitting}
                            className="flex items-center gap-2 px-4 py-1.5 bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 rounded-md text-xs font-medium transition-colors uppercase tracking-wide"
                        >
                            {isReviewing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <PlayCircle className="w-3 h-3" />}
                            Review Code
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600/20 border border-emerald-600/50 rounded-md text-xs font-medium transition-colors uppercase tracking-wide shadow-lg shadow-emerald-900/20"
                        >
                            {isSubmitting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                            {isSubmitting ? 'Grading...' : 'Submit Solution'}
                        </button>
                      </>
                  )}
                </div>
              </div>

              {/* Text Area */}
              <textarea
                ref={textAreaRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`flex-1 w-full p-6 text-sm resize-none focus:outline-none leading-relaxed font-mono ${
                  isTurboMode 
                    ? 'bg-[#0000AA] text-yellow-300 selection:bg-gray-300 selection:text-black placeholder-yellow-300/50'
                    : 'bg-[#0b0f19] text-gray-300 selection:bg-emerald-500/30 placeholder-gray-600'
                }`}
                spellCheck={false}
                placeholder={isTurboMode ? "" : `// 1. Analyze the problem\n// 2. Plan using pseudocode\n// 3. Write modular ${language} code\n// Note: You must implement the solution yourself.`}
              />

              {/* Turbo Status Bar */}
              {isTurboMode && (
                <div className="bg-gray-300 text-black border-t border-black px-4 py-1 text-sm font-bold font-mono flex justify-between items-center">
                   <div className="flex gap-4">
                      <span>F1 Help</span>
                      <span>F2 Save</span>
                      <span>F3 Open</span>
                      <span>Alt+F9 Compile</span>
                      <span>F9 Make</span>
                      <span>Ctrl+F9 Run</span>
                      <span>F10 Menu</span>
                   </div>
                   <div>
                      {turboMessage || (
                          isSubmitting ? "Running..." : 
                          isReviewing ? "Compiling..." : 
                          "Line 1 Col 1"
                      )}
                   </div>
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
};

export default ChallengeView;
