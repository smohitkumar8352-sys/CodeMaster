
import React, { useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Code, Mic, BookOpen, Github } from 'lucide-react';
import ChallengeView from './components/ChallengeView';
import LiveAssistant from './components/LiveAssistant';
import ChatWidget from './components/ChatWidget';

const Navigation = () => {
  const location = useLocation();
  
  const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => {
    const isActive = location.pathname === to;
    return (
      <Link
        to={to}
        className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
          isActive 
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
        }`}
      >
        <Icon className="w-5 h-5" />
        <span className="font-medium">{label}</span>
      </Link>
    );
  };

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 hidden md:flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-500 p-2 rounded-lg">
            <Code className="w-6 h-6 text-gray-900" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">CodeMaster</h1>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        <NavItem to="/" icon={Layout} label="Challenge Arena" />
        <NavItem to="/live" icon={Mic} label="Live Voice Coach" />
        <NavItem to="/history" icon={BookOpen} label="History" />
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
          <p className="text-xs text-gray-500 mb-2">Daily Goal</p>
          <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
            <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '65%' }} />
          </div>
          <p className="text-xs text-emerald-400 font-medium">Mastery Level: 12</p>
        </div>
      </div>
    </div>
  );
};

const MobileHeader = () => (
  <div className="md:hidden bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between sticky top-0 z-30">
    <div className="flex items-center space-x-2">
      <Code className="w-6 h-6 text-emerald-500" />
      <span className="font-bold text-white">CodeMaster</span>
    </div>
    <div className="flex gap-4">
        <Link to="/" className="text-gray-400 hover:text-white"><Layout className="w-5 h-5" /></Link>
        <Link to="/live" className="text-gray-400 hover:text-white"><Mic className="w-5 h-5" /></Link>
    </div>
  </div>
);

const HistoryView = () => (
    <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500 space-y-4">
        <BookOpen className="w-16 h-16 opacity-20" />
        <p>No coding history recorded yet.</p>
    </div>
);

// Wrapper component to use hooks inside Router
const AppContent = () => {
  const location = useLocation();
  const isLivePage = location.pathname === '/live';

  return (
    <div className="flex min-h-screen bg-[#0b0f19]">
      <Navigation />
      
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        <MobileHeader />
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto relative z-10">
            <Routes>
              <Route path="/" element={<ChallengeView />} />
              <Route path="/live" element={
                <div className="h-full flex flex-col items-center justify-center space-y-8 min-h-[50vh]">
                  <div className="text-center space-y-4 max-w-lg">
                    <h2 className="text-3xl font-bold text-white">Real-time Voice Coaching</h2>
                    <p className="text-gray-400">
                      Connect with Gemini Live to discuss code architecture, practice technical interviews, or just rubber-duck debug your logic verbally.
                    </p>
                  </div>
                  {/* LiveAssistant logic is now handled globally, this div just provides spacing/context */}
                </div>
              } />
              <Route path="/history" element={<HistoryView />} />
            </Routes>
          </div>
          
          {/* Global LiveAssistant rendered here to persist across routes */}
          <div className={`transition-all duration-500 ${isLivePage ? 'relative z-20' : 'fixed bottom-0 left-0 z-50 pointer-events-none'}`}>
             <div className={isLivePage ? '' : 'pointer-events-auto'}>
                <LiveAssistant isExpanded={isLivePage} />
             </div>
          </div>

        </div>
      </main>

      <ChatWidget />
    </div>
  );
};

const App = () => {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};

export default App;
