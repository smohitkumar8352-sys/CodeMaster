
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { Play, Square, Mic, MicOff, Monitor, MonitorOff, AlertCircle, Code, X, Maximize2, Minimize2, Pause, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

// --- Audio Utils (Internal to avoid multiple files) ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// --- Syntax Highlighted Editor Component ---
const CodeEditor = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const handleScroll = () => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const escapeHtml = (str: string) => {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  };

  const highlightedCode = useMemo(() => {
    // Expanded keyword list for C/C++, Java, Python, JS/TS, Go, Rust, R
    const keywords = new Set([
       // Common
       "import", "export", "from", "const", "let", "var", "function", "return", "if", "else", "for", "while", "do",
       "class", "try", "catch", "async", "await", "new", "switch", "case", "break", "continue", "default", "throw",
       // TS/JS/Java/C#
       "interface", "type", "implements", "extends", "public", "private", "protected", "static", "void", "final",
       "package", "native", "synchronized", "volatile", "transient", "instanceof", "throws", "enum", "super", "this",
       // Python
       "def", "elif", "lambda", "with", "as", "pass", "raise", "global", "nonlocal", "yield", "del", "print", "exec",
       // C/C++
       "struct", "union", "typedef", "sizeof", "namespace", "using", "template", "typename", "virtual", "override",
       "constexpr", "friend", "operator", "inline", "explicit", "mutable", "decltype", "noexcept", "nullptr", 
       "auto", "extern", "register", "signed", "unsigned", "short", "long", "goto",
       // Go
       "go", "defer", "chan", "map", "func", "select", "fallthrough", "range", "make",
       // Rust
       "fn", "mut", "impl", "trait", "pub", "unsafe", "where", "match", "loop", "move", "crate", "mod", 
       "use", "ref", "box"
    ]);
    
    const types = new Set([
      // Primitives
      "int", "float", "double", "char", "bool", "boolean", "string", "String", "void", "any", "byte", "short", "long",
      // Rust/Go types
      "u8", "u16", "u32", "u64", "i8", "i16", "i32", "i64", "usize", "isize", "f32", "f64", "complex64", "complex128",
      // Structures/Classes
      "Vec", "Option", "Result", "List", "Map", "Set", "Array", "Object", "Promise", "console", "Math", "JSON",
      "vector", "deque", "queue", "stack", "set", "map", "unordered_map", "unordered_set", "priority_queue",
      "shared_ptr", "unique_ptr", "weak_ptr", "Box", "Rc", "Arc", "File", "Path"
    ]);

    const literals = new Set([
        "true", "false", "null", "undefined", "NaN", "Infinity", "nullptr", "None", "True", "False", 
        "self", "this", "nil", "iota"
    ]);

    // Regex for tokenization
    // 1. Comments (Multi-line C-style, Single-line //, or Python/Shell #)
    // 2. Strings (Double, Single, Backtick)
    // 3. Numbers (Hex 0x..., Decimals, Integers)
    // 4. Identifiers
    // 5. Operators/Punctuation
    // 6. Whitespace
    const tokenRegex = /(\/\*[\s\S]*?\*\/|(?:\/\/|#).*)|("|'|`)(?:\\.|(?!\2).)*\2|\b(?:0x[\da-fA-F]+|\d+(?:\.\d+)?)\b|([a-zA-Z_$][a-zA-Z0-9_$]*)|([{}()\[\];,.<>=!+\-*/&|:?%^~]+)|(\s+)/g;

    let result = "";
    let match;
    let lastIndex = 0;

    while ((match = tokenRegex.exec(value)) !== null) {
       if (match.index > lastIndex) {
          result += escapeHtml(value.slice(lastIndex, match.index));
       }
       
       const fullMatch = match[0];
       const [_, comment, string, number, identifier, operator, whitespace] = match;

       if (comment) {
          result += `<span class="text-gray-500 italic">${escapeHtml(comment)}</span>`;
       } else if (string) {
          result += `<span class="text-green-400">${escapeHtml(string)}</span>`;
       } else if (number) {
          result += `<span class="text-blue-400 font-medium">${number}</span>`;
       } else if (identifier) {
          if (keywords.has(identifier)) {
             result += `<span class="text-purple-400 font-bold">${identifier}</span>`;
          } else if (types.has(identifier)) {
             result += `<span class="text-teal-400 font-medium">${identifier}</span>`;
          } else if (literals.has(identifier)) {
             result += `<span class="text-orange-400">${identifier}</span>`;
          } else if (/^[A-Z]/.test(identifier)) {
             result += `<span class="text-yellow-300">${identifier}</span>`; // PascalCase convention
          } else {
             result += escapeHtml(identifier);
          }
       } else if (operator) {
          result += `<span class="text-cyan-300">${escapeHtml(operator)}</span>`;
       } else if (whitespace) {
          result += whitespace;
       } else {
          result += escapeHtml(fullMatch);
       }
       
       lastIndex = tokenRegex.lastIndex;
    }
    
    result += escapeHtml(value.slice(lastIndex));
    return result;
  }, [value]);

  return (
    <div className="relative w-full h-full font-mono text-sm bg-gray-950/80 group rounded-b-lg overflow-hidden">
      {/* Backdrop for highlighting */}
      <pre
        ref={preRef}
        className="absolute inset-0 p-4 pointer-events-none whitespace-pre-wrap break-words overflow-hidden font-mono text-sm leading-relaxed"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: highlightedCode + '<br/>' }} 
      />
      {/* Actual Input */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        className="absolute inset-0 w-full h-full p-4 bg-transparent text-transparent caret-white resize-none focus:outline-none whitespace-pre-wrap break-words overflow-auto z-10 font-mono text-sm leading-relaxed selection:bg-emerald-500/30"
        spellCheck={false}
        placeholder="// Type your code here..."
      />
    </div>
  );
};

// --- Main LiveAssistant Component ---

interface LiveAssistantProps {
  isExpanded: boolean;
}

const LiveAssistant: React.FC<LiveAssistantProps> = ({ isExpanded }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isScreenPaused, setIsScreenPaused] = useState(false);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [code, setCode] = useState('// Write your code here to share with the coach...\n\nfunction helloWorld() {\n  console.log("Hello CodeMaster!");\n}');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null); 
  
  // Audio Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // State Tracking Ref to prevent race conditions in callbacks
  const isSessionActiveRef = useRef(false);

  // Visualizer Refs
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);

  // Screen Share Refs
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenIntervalRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    isSessionActiveRef.current = false;

    if (sessionRef.current) {
      sessionRef.current.then((session) => {
        if (session && typeof session.close === 'function') {
          session.close();
        }
      }).catch(() => {
        // Ignore errors if session failed to connect
      });
      sessionRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    if (screenIntervalRef.current) {
      clearInterval(screenIntervalRef.current);
      screenIntervalRef.current = 0;
    }
    
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Reset video srcObject
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }

    setIsConnected(false);
    setIsScreenSharing(false);
    setIsScreenPaused(false);
    setStatus('idle');
    // We don't clear error message here to let user see why it closed if it was an error
  }, []);

  // Re-attach stream to video element if component re-renders or refs change
  useEffect(() => {
    if (screenVideoRef.current && screenStreamRef.current) {
        screenVideoRef.current.srcObject = screenStreamRef.current;
        screenVideoRef.current.play().catch(e => console.warn("Background video play interrupted", e));
    }
  }, [isExpanded, isScreenSharing]);

  const drawVisualizer = () => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isSessionActiveRef.current) return;

      animationFrameRef.current = requestAnimationFrame(draw);
      // Check if context is still valid before drawing
      if (!canvasRef.current) return;
      
      analyserRef.current!.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // If not screen sharing or if screen sharing is active, we might want a background for the PIP
      if (isScreenSharing) {
         ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
         ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 1.5;

        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#059669'); // Emerald 600
        gradient.addColorStop(1, '#34d399'); // Emerald 400

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();
  };

  const startScreenShare = async () => {
    if (!isConnected) return;
    setErrorMessage('');
    setIsScreenPaused(false);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setErrorMessage("Screen sharing is not supported on this device/browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = stream;
      
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        await screenVideoRef.current.play();
      }

      setIsScreenSharing(true);

      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      screenIntervalRef.current = window.setInterval(() => {
        captureAndSendFrame();
      }, 500); // 2 FPS

    } catch (e: any) {
      console.error("Screen share failed", e);
      setIsScreenSharing(false);
      if (e.name === 'NotAllowedError' || e.message?.includes('permissions policy')) {
        setErrorMessage("Screen sharing permission denied. Please check browser settings.");
      } else {
        setErrorMessage("Failed to start screen share.");
      }
    }
  };

  const pauseScreenShare = () => {
    if (!isScreenSharing) return;
    setIsScreenPaused(true);
    if (screenIntervalRef.current) {
      clearInterval(screenIntervalRef.current);
      screenIntervalRef.current = 0;
    }
  };

  const resumeScreenShare = () => {
    if (!isScreenSharing) return;
    setIsScreenPaused(false);
    if (!screenIntervalRef.current) {
      screenIntervalRef.current = window.setInterval(() => {
        captureAndSendFrame();
      }, 500);
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }
    if (screenIntervalRef.current) {
      clearInterval(screenIntervalRef.current);
      screenIntervalRef.current = 0;
    }
    setIsScreenSharing(false);
    setIsScreenPaused(false);
  };

  const captureAndSendFrame = () => {
    if (!screenVideoRef.current || !sessionRef.current || !isSessionActiveRef.current) return;
    
    const video = screenVideoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement('canvas');
    // Optimization: Scale down larger screens to 1280 max width to reduce latency and token usage
    const MAX_WIDTH = 1280;
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Data = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];

    sessionRef.current.then((session: any) => {
      if (isSessionActiveRef.current) {
        session.sendRealtimeInput({
          media: {
            mimeType: 'image/jpeg',
            data: base64Data
          }
        });
      }
    });
  };

  const toggleConnection = async () => {
    if (isConnected) {
      cleanup();
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setErrorMessage("No internet connection. Please check your network.");
        setStatus('error');
        return;
    }

    const apiKey = (typeof process !== 'undefined' && process && process.env) ? process.env.API_KEY : '';
    if (!apiKey || !apiKey.trim()) {
        setErrorMessage("API Key not found. Please ensure you have a valid key configured.");
        setStatus('error');
        return;
    }

    setErrorMessage('');
    try {
      setStatus('connecting');
      isSessionActiveRef.current = true;
      
      const InputContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const inputCtx = new InputContextClass({ sampleRate: 16000 });
      inputAudioContextRef.current = inputCtx;
      if (inputCtx.state === 'suspended') {
         await inputCtx.resume();
      }

      const OutputContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const outputCtx = new OutputContextClass({ sampleRate: 24000 });
      outputAudioContextRef.current = outputCtx;
      if (outputCtx.state === 'suspended') {
         await outputCtx.resume();
      }

      const outputNode = outputCtx.createGain();
      const analyser = outputCtx.createAnalyser();
      analyser.fftSize = 256;
      outputNode.connect(analyser);
      analyser.connect(outputCtx.destination);
      analyserRef.current = analyser;

      // Only draw if expanded and canvas is available, otherwise loop will just run logic
      if (isExpanded) drawVisualizer();

      // Request Microphone with specific error handling
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err: any) {
        console.error("Microphone access failed:", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
           setErrorMessage("Microphone access denied. Please allow microphone permissions in your browser settings.");
        } else if (err.name === 'NotFoundError') {
           setErrorMessage("No microphone found. Please check your audio devices.");
        } else if (err.name === 'NotReadableError') {
           setErrorMessage("Microphone is busy or not readable. Try closing other apps using it.");
        } else {
           setErrorMessage(`Microphone error: ${err.message || 'Unknown error'}`);
        }
        setStatus('error');
        cleanup(); 
        return;
      }
      
      mediaStreamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            if (!isSessionActiveRef.current) return;
            console.log('Live API Connected');
            setStatus('connected');
            setIsConnected(true);
            nextStartTimeRef.current = 0;

            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              if (isMuted || !isSessionActiveRef.current) return; 
              
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              
              // Safe usage of sessionPromise
              sessionPromise.then((session) => {
                 if (isSessionActiveRef.current) {
                   session.sendRealtimeInput({ media: pcmBlob });
                 }
              }).catch((err) => {
                 // Silence log spam, handled by main error handlers
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (!isSessionActiveRef.current) return;

            const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64EncodedAudioString && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const audioBuffer = await decodeAudioData(
                decode(base64EncodedAudioString),
                ctx,
                24000,
                1
              );

              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNode);
              source.addEventListener('ended', () => {
                if (sourcesRef.current) sourcesRef.current.delete(source);
              });

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }
            
            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            if (!isSessionActiveRef.current) return;
            console.log('Live API Closed');
            setStatus('idle'); 
            setIsConnected(false);
            stopScreenShare();
          },
          onerror: (e) => {
            if (!isSessionActiveRef.current) return;
            console.error('Live API Error Event:', e);
            
            let msg = "Connection failed";
            // Safely extract error message from various error types (Event, Error, SDK Error)
            if (e instanceof Error) {
                msg = e.message;
            } else if ((e as any).message) {
                msg = (e as any).message;
            } else if ((e as any).type === 'error') {
                // WebSocket error events often don't have descriptive messages due to browser security
                msg = "Network error (Possible firewall or connection issue)";
            }

            setStatus('error');
            setErrorMessage(`Live API Error: ${msg}`);
            cleanup();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: 'You are an expert polyglot coding mentor. You can see the user\'s screen when they share it. Use this visual context to help them debug code, understand their problem, and guide them. Do NOT just give the answer or solution; help them derive it themselves. Guide them through logic, algorithms, and language features.',
        },
      });

      // Handle immediate connection failures (Handshake, Auth, 4xx, 5xx)
      sessionPromise.catch((e) => {
        if (!isSessionActiveRef.current) return;
        console.error("Failed to establish initial connection:", e);
        setStatus('error');
        
        if (e.message && e.message.includes('401')) {
           setErrorMessage("Authentication failed. Invalid API Key.");
        } else if (e.message && e.message.includes('503')) {
           setErrorMessage("Service unavailable (503). The model might be overloaded.");
        } else {
           setErrorMessage(`Network error: ${e.message || "Check connection"}`);
        }
        cleanup();
      });

      sessionRef.current = sessionPromise;

    } catch (error: any) {
      console.error("Failed to connect:", error);
      setStatus('error');
      setErrorMessage(`Unexpected error: ${error.message}`);
      cleanup();
    }
  };

  // If not on the Live page and not connected, don't render anything
  if (!isExpanded && !isConnected) {
    return null;
  }

  // Minimized Floating Widget View
  if (!isExpanded && isConnected) {
      return (
        <div className="fixed bottom-20 left-6 z-50 animate-in slide-in-from-bottom-5 duration-300">
           <div className="bg-gray-900 border border-emerald-500/30 rounded-full shadow-2xl shadow-emerald-900/20 p-2 flex items-center gap-3 pr-4">
              <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-950 border border-gray-800">
                  <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full h-full bg-emerald-500/10 animate-pulse" />
                  </div>
                  {/* Hidden video element is essential for screen sharing pipeline to continue working */}
                  <video 
                    ref={screenVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover opacity-50" 
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {isMuted ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                  </div>
              </div>
              
              <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">Live Coach Active</span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      {isScreenSharing ? <><Monitor className="w-3 h-3" /> Screen Sharing</> : 'Audio Only'}
                  </span>
              </div>

              <div className="flex items-center gap-1 ml-2 border-l border-gray-700 pl-2">
                 <Link to="/live" className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
                    <Maximize2 className="w-4 h-4" />
                 </Link>
                 <button onClick={cleanup} className="p-2 hover:bg-red-900/30 rounded-full text-red-400 transition-colors">
                    <Square className="w-4 h-4 fill-current" />
                 </button>
              </div>
           </div>
        </div>
      );
  }

  // Full Expanded View
  return (
    <div className="w-full max-w-md mx-auto space-y-4 animate-in fade-in duration-300">
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-2xl flex flex-col items-center justify-center space-y-6">
        <div className="flex items-center space-x-2 mb-2">
          <div className={`w-3 h-3 rounded-full ${status === 'connected' ? 'bg-emerald-500 animate-pulse' : status === 'connecting' ? 'bg-yellow-500 animate-bounce' : 'bg-red-500'}`} />
          <h2 className="text-xl font-semibold text-white tracking-tight">Gemini Live Coach</h2>
        </div>

        <div className={`relative w-full h-48 bg-gray-950 rounded-lg overflow-hidden border group shadow-inner transition-colors duration-300 ${
             isScreenSharing 
               ? isScreenPaused 
                 ? 'border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]' 
                 : 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
               : 'border-gray-800'
           }`}>
          {/* Audio Visualizer - Changes to PIP when screen sharing */}
          <canvas 
            ref={canvasRef} 
            width={400} 
            height={192} 
            className={`absolute transition-all duration-500 ease-in-out ${
              isScreenSharing 
                ? 'bottom-2 right-2 w-32 h-16 rounded-lg border border-gray-700 bg-black/50 backdrop-blur-sm z-20 shadow-lg' 
                : 'inset-0 w-full h-full opacity-80'
            }`}
          />
          
          {/* Screen Share Preview - Object Contain for full code visibility */}
          <video 
            ref={screenVideoRef}
            autoPlay
            muted
            playsInline
            className={`absolute inset-0 w-full h-full object-contain bg-gray-950 transition-opacity duration-300 ${isScreenSharing ? 'opacity-100' : 'opacity-0 pointer-events-none'} ${isScreenPaused ? 'grayscale opacity-50' : ''}`}
          />

          {/* Screen Share Controls Overlay */}
          {isScreenSharing && (
            <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30 bg-black/40 backdrop-blur-[2px]">
               {isScreenPaused ? (
                  <button onClick={resumeScreenShare} className="p-2 rounded-full bg-emerald-500 text-white hover:scale-110 transition-transform shadow-lg" title="Resume Sharing">
                     <Play className="w-5 h-5 fill-current" />
                  </button>
               ) : (
                  <button onClick={pauseScreenShare} className="p-2 rounded-full bg-yellow-500 text-white hover:scale-110 transition-transform shadow-lg" title="Pause Sharing">
                     <Pause className="w-5 h-5 fill-current" />
                  </button>
               )}
               <button onClick={stopScreenShare} className="p-2 rounded-full bg-red-500 text-white hover:scale-110 transition-transform shadow-lg" title="Stop Sharing">
                   <Square className="w-5 h-5 fill-current" />
               </button>
            </div>
          )}

          {/* Overlay Text */}
          {status === 'idle' && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm z-10">
              Ready to connect...
            </div>
          )}
          
          {isScreenSharing && !isScreenPaused && (
              <div className="absolute top-2 right-2 bg-red-500/80 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center animate-pulse z-20 shadow-md backdrop-blur-sm">
                  <Monitor className="w-3 h-3 mr-1" /> LIVE
              </div>
          )}

          {isScreenSharing && isScreenPaused && (
              <div className="absolute top-2 right-2 bg-yellow-500/80 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center z-20 shadow-md backdrop-blur-sm">
                  <Pause className="w-3 h-3 mr-1" /> PAUSED
              </div>
          )}
        </div>

        <div className="flex items-center space-x-6">
          <button
            onClick={toggleConnection}
            className={`p-4 rounded-full transition-all duration-300 transform hover:scale-105 ${
              isConnected 
                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                : 'bg-emerald-500 text-gray-900 hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
            }`}
            title={isConnected ? "Disconnect" : "Connect"}
          >
            {isConnected ? <Square className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
          </button>

          <button
            onClick={() => setIsMuted(!isMuted)}
            disabled={!isConnected}
            className={`p-4 rounded-full transition-all duration-300 ${
              isMuted
                ? 'bg-red-500/10 text-red-500 border border-red-500/50'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
            } ${!isConnected && 'opacity-50 cursor-not-allowed'}`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
          
          <button
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            disabled={!isConnected}
            className={`p-4 rounded-full transition-all duration-300 ${
              isScreenSharing
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
            } ${!isConnected && 'opacity-50 cursor-not-allowed'}`}
            title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
          >
            {isScreenSharing ? <MonitorOff className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
          </button>

          <button
            onClick={() => setShowCodeEditor(!showCodeEditor)}
            className={`p-4 rounded-full transition-all duration-300 ${
              showCodeEditor
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
            }`}
            title="Toggle Code Scratchpad"
          >
            <Code className="w-6 h-6" />
          </button>
        </div>
        
        <div className="text-center space-y-2 min-h-[3rem]">
            <p className="text-xs text-gray-500 font-mono">
              {status === 'connected' ? 'Live Audio Session Active' : status === 'connecting' ? 'Establishing Connection...' : 'Session Inactive'}
            </p>
            {isConnected && !isScreenSharing && !errorMessage && (
                <p className="text-[10px] text-emerald-500/70 animate-pulse">Tip: Share screen (this tab) to let the AI see your code.</p>
            )}
            {errorMessage && (
              <div className="flex items-center justify-center gap-1 text-red-400 text-xs mt-2 animate-in fade-in slide-in-from-bottom-1 bg-red-900/20 p-2 rounded-lg border border-red-900/50">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
        </div>
      </div>

      {/* Live Code Editor Drawer */}
      {showCodeEditor && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-top-4 duration-300">
           <div className="flex items-center justify-between p-3 bg-gray-950 border-b border-gray-800">
              <div className="flex items-center gap-2">
                 <Code className="w-4 h-4 text-purple-400" />
                 <span className="text-xs font-bold text-white uppercase tracking-wide">Live Scratchpad</span>
              </div>
              <button onClick={() => setShowCodeEditor(false)} className="text-gray-500 hover:text-white">
                 <X className="w-4 h-4" />
              </button>
           </div>
           <div className="h-64 w-full relative">
              <CodeEditor value={code} onChange={setCode} />
           </div>
        </div>
      )}
    </div>
  );
};

export default LiveAssistant;
