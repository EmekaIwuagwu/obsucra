import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LandingPage from './components/LandingPage';
import NetworkDashboard from './components/NetworkDashboard'; // The new functional dashboard
import NodeManager from './components/NodeManager';
import FeedsExplorer from './components/FeedsExplorer';
import StakingInterface from './components/StakingInterface';
import Governance from './components/Governance';
import { Activity, Server, Database, Layers, Vote, Home, Zap, Code, Globe, Info } from 'lucide-react';

import Developers from './components/Developers';
import Products from './components/Products';
import Ecosystem from './components/Ecosystem';
import About from './components/About';

function App() {
  const [activeTab, setActiveTab] = useState('home');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'nodes', label: 'Nodes', icon: Server },
    { id: 'feeds', label: 'Feeds', icon: Database },
    { id: 'products', label: 'Products', icon: Zap },
    { id: 'developers', label: 'Developers', icon: Code },
    { id: 'ecosystem', label: 'Ecosystem', icon: Globe },
    { id: 'staking', label: 'Staking', icon: Layers },
    { id: 'governance', label: 'Governance', icon: Vote },
    { id: 'about', label: 'About', icon: Info },
  ];

  const handleNavigate = (page: string) => {
    setActiveTab(page);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home': return <LandingPage onNavigate={handleNavigate} />;
      case 'dashboard': return <NetworkDashboard />;
      case 'nodes': return <NodeManager />;
      case 'feeds': return <FeedsExplorer />;
      case 'products': return <Products />;
      case 'developers': return <Developers />;
      case 'ecosystem': return <Ecosystem />;
      case 'staking': return <StakingInterface />;
      case 'governance': return <Governance />;
      case 'about': return <About />;
      default: return <LandingPage onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#000033] text-white overflow-x-hidden font-sans">

      {/* Navigation Bar - Only show if NOT on 'home' */}
      {activeTab !== 'home' && (
        <nav className="fixed top-0 left-0 h-full w-20 flex flex-col items-center py-8 z-50 glass-nav border-r border-white/10 bg-black/20 backdrop-blur-lg">
          <div className="mb-12 cursor-pointer" onClick={() => setActiveTab('home')}>
            {/* Small logo icon acting as Home button */}
            <div className="w-10 h-10 rounded-full border-2 border-[#00FFFF] flex items-center justify-center shadow-[0_0_15px_#00FFFF] hover:scale-110 transition-transform">
              <div className="w-4 h-4 bg-gradient-to-br from-[#00FFFF] to-[#FF00FF] rounded-full" />
            </div>
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
                  <span className="absolute left-16 bg-black/80 px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10 pointer-events-none z-50">
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Back to Home bottom button */}
          <div className="mt-auto">
            <button onClick={() => setActiveTab('home')} className="text-gray-400 hover:text-white transition-colors">
              <Home size={20} />
            </button>
          </div>
        </nav>
      )}

      {/* Main Content Area */}
      {/* If activeTab is home, we take full width (no padding) */}
      <main className={`min-h-screen relative ${activeTab !== 'home' ? 'pl-20' : ''}`}>
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

      {/* Background Ambience - only visible in app mode, LandingPage has its own background */}
      {activeTab !== 'home' && (
        <div className="fixed inset-0 pointer-events-none z-[-1]">
          <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#4B0082]/30 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-20%] left-[-10%] w-[40%] h-[40%] bg-[#0000FF]/20 rounded-full blur-[100px]" />
        </div>
      )}
    </div>
  );
}

export default App;
