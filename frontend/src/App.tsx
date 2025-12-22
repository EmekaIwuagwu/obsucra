import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Dashboard from './components/Dashboard';
import NodeManager from './components/NodeManager';
import FeedsExplorer from './components/FeedsExplorer';
import StakingInterface from './components/StakingInterface';
import Governance from './components/Governance';
import { Activity, Server, Database, Layers, Vote } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'nodes', label: 'Nodes', icon: Server },
    { id: 'feeds', label: 'Feeds', icon: Database },
    { id: 'staking', label: 'Staking', icon: Layers },
    { id: 'governance', label: 'Governance', icon: Vote },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'nodes': return <NodeManager />;
      case 'feeds': return <FeedsExplorer />;
      case 'staking': return <StakingInterface />;
      case 'governance': return <Governance />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-[#000033] text-white overflow-x-hidden font-sans">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 h-full w-20 flex flex-col items-center py-8 z-50 glass-nav border-r border-white/10 bg-black/20 backdrop-blur-lg">
        <div className="mb-12">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00FFFF] to-[#FF00FF] animate-pulse-slow shadow-[0_0_20px_#00FFFF]" />
        </div>

        <div className="flex flex-col gap-8 w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative w-full flex justify-center py-3 transition-all duration-300 group`}
              >
                <div className={`absolute inset-y-0 left-0 w-1 bg-[#00FFFF] rounded-r transition-all duration-300 ${isActive ? 'opacity-100 h-full' : 'opacity-0 h-0 group-hover:h-4 group-hover:opacity-50'}`} />
                <Icon
                  size={24}
                  className={`transition-all duration-300 ${isActive ? 'text-[#00FFFF] drop-shadow-[0_0_10px_#00FFFF]' : 'text-gray-400 group-hover:text-white'}`}
                />
                {/* Tooltip */}
                <span className="absolute left-16 bg-black/80 px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10 pointer-events-none">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="pl-20 min-h-screen relative">
        <AnimatePresence mode='wait'>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-[-1]">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#4B0082]/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[40%] h-[40%] bg-[#0000FF]/20 rounded-full blur-[100px]" />
      </div>
    </div>
  );
}

export default App;
