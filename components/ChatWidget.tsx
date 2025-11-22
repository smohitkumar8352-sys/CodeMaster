
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Loader2, Bot, Mic, MicOff, Zap, Brain, Globe, Sparkles } from 'lucide-react';
import { chatWithBot, transcribeAudio, generateId } from '../services/gemini';
import { ChatMessage, ChatMode } from '../types';

const MAX_CHARS = 2000;

const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'init', role: 'model', text: "Hello! I'm your CodeMaster assistant. Ask me anything about algorithms, architecture, or debugging.", timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [mode, setMode] = useState<ChatMode>('default');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen, isTranscribing]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop()); // Stop microphone

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsRecording(false);
        setIsTranscribing(true);

        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            if (reader.result) {
              const base64data = (reader.result as string).split(',')[1];
              const transcription = await transcribeAudio(base64data, 'audio/webm');
              if (transcription) {
                setInput((prev) => {
                   const newValue = prev + (prev ? ' ' : '') + transcription.trim();
                   return newValue.slice(0, MAX_CHARS);
                });
              }
            }
            setIsTranscribing(false);
          };
        } catch (error) {
          console.error("Error processing audio:", error);
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model', 
        parts: [{ text: m.text }]
      }));

      const result = await chatWithBot(userMsg.text, history, mode);

      const botMsg: ChatMessage = {
        id: generateId(),
        role: 'model',
        text: result.text,
        timestamp: Date.now(),
        groundingMetadata: result.groundingMetadata
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg: ChatMessage = {
        id: generateId(),
        role: 'model',
        text: "I encountered an error processing your request. Please try again.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 p-4 bg-emerald-500 hover:bg-emerald-400 text-gray-900 rounded-full shadow-lg transition-all duration-300 hover:scale-110 ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
      >
        <MessageSquare className="w-6 h-6 fill-current" />
      </button>

      {/* Chat Panel */}
      <div className={`fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-gray-900 border-l border-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-850">
          <div className="flex items-center space-x-2">
            <Bot className="w-5 h-5 text-emerald-500" />
            <h3 className="font-bold text-white">CodeMaster Chat</h3>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="p-2 border-b border-gray-800 bg-gray-900 flex justify-around">
          <button 
             onClick={() => setMode('default')}
             className={`p-2 rounded-lg flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${mode === 'default' ? 'bg-emerald-500/10 text-emerald-500' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Bot className="w-4 h-4" /> Default
          </button>
          <button 
             onClick={() => setMode('fast')}
             className={`p-2 rounded-lg flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${mode === 'fast' ? 'bg-yellow-500/10 text-yellow-500' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Zap className="w-4 h-4" /> Fast
          </button>
          <button 
             onClick={() => setMode('thinking')}
             className={`p-2 rounded-lg flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${mode === 'thinking' ? 'bg-purple-500/10 text-purple-500' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Brain className="w-4 h-4" /> Think
          </button>
          <button 
             onClick={() => setMode('search')}
             className={`p-2 rounded-lg flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${mode === 'search' ? 'bg-blue-500/10 text-blue-500' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Globe className="w-4 h-4" /> Search
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900/50">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-emerald-600 text-white rounded-br-sm' 
                  : 'bg-gray-800 text-gray-200 rounded-bl-sm border border-gray-700'
              }`}>
                {msg.text}
              </div>
              
              {/* Grounding Sources */}
              {msg.groundingMetadata?.groundingChunks && (
                <div className="mt-2 max-w-[85%] bg-gray-950/50 border border-gray-800 rounded-lg p-2">
                   <p className="text-[10px] text-gray-500 font-semibold mb-1 uppercase">Sources</p>
                   <ul className="space-y-1">
                      {msg.groundingMetadata.groundingChunks.map((chunk: any, idx: number) => {
                        if (chunk.web) {
                           return (
                             <li key={idx} className="text-xs truncate">
                               <a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                                  <Globe className="w-3 h-3" /> {chunk.web.title || chunk.web.uri}
                               </a>
                             </li>
                           );
                        }
                        return null;
                      })}
                   </ul>
                </div>
              )}
            </div>
          ))}
          
          {/* Loading States */}
          {(isLoading || isTranscribing) && (
             <div className="flex justify-start">
               <div className="bg-gray-800 rounded-2xl px-4 py-3 border border-gray-700 flex items-center space-x-2">
                 {mode === 'thinking' && isLoading ? (
                    <Brain className="w-4 h-4 text-purple-500 animate-pulse" />
                 ) : (
                    <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                 )}
                 <span className="text-xs text-gray-400">
                   {isTranscribing ? "Transcribing audio..." : mode === 'thinking' ? "Thinking deeply..." : "Generating..."}
                 </span>
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-800 bg-gray-850">
          <div className={`flex items-center space-x-2 bg-gray-900 rounded-lg border px-3 py-2 transition-colors ${isRecording ? 'border-red-500/50 bg-red-900/10' : 'border-gray-700 focus-within:border-emerald-500'}`}>
            
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading || isTranscribing}
              className={`p-2 rounded-full transition-colors ${
                isRecording 
                  ? 'text-red-500 hover:bg-red-500/20 animate-pulse' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              } disabled:opacity-50`}
              title={isRecording ? "Stop recording" : "Voice input"}
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isRecording ? "Listening..." : "Ask about code..."}
              disabled={isRecording}
              maxLength={MAX_CHARS}
              className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm min-w-0"
            />

            {/* Clear Button & Character Counter */}
            {input.length > 0 && (
              <div className="flex items-center gap-2 mr-1 shrink-0">
                <span className={`text-[10px] font-mono ${input.length >= MAX_CHARS * 0.9 ? 'text-red-400' : 'text-gray-600'}`}>
                  {input.length}/{MAX_CHARS}
                </span>
                <button 
                  onClick={() => setInput('')} 
                  className="text-gray-500 hover:text-gray-300 transition-colors p-1"
                  title="Clear input"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading || isRecording || isTranscribing}
              className="p-2 text-emerald-500 hover:text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          {isRecording && (
            <div className="text-xs text-red-400 mt-2 text-center font-mono animate-pulse">
              Recording... click mic to stop
            </div>
          )}
          {mode !== 'default' && (
            <div className={`text-[10px] mt-2 text-center font-medium ${
                mode === 'fast' ? 'text-yellow-500' : 
                mode === 'thinking' ? 'text-purple-500' : 
                'text-blue-500'
            }`}>
                Using {mode === 'fast' ? 'Flash Lite' : mode === 'thinking' ? 'Pro 3 (Thinking)' : 'Flash (Search)'}
            </div>
          )}
        </div>
      </div>
      
      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default ChatWidget;
