import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { motion } from 'framer-motion';
import { Shield, Activity, Database, Lock, Terminal, Globe as GlobeIcon } from 'lucide-react';
import Globe from './components/Globe';
import DataFeeds from './components/DataFeeds';
import StakeGuard from './components/StakeGuard';
import DocsSection from './components/DocsSection';
import HubModal from './components/HubModal';
import Footer from './components/Footer';

function App() {
  const [isHubOpen, setIsHubOpen] = React.useState(false);
  const [stats, setStats] = React.useState({
    latency: "...",
    activeNodes: 0,
    zk_proofs_sec: 0,
    price_feeds: [] as any[],
    logs: [] as string[]
  });

  const [history, setHistory] = React.useState<{ time: string, price: number }[]>([]);

  React.useEffect(() => {
    const fetchStats = () => {
      fetch('http://localhost:8080/api/stats')
        .then(res => res.json())
        .then(data => {
          setStats(data);
          const btc = data.price_feeds.find((f: any) => f.Name === "BTC / USD");
          if (btc) {
            const price = parseFloat(btc.Price.replace(/,/g, ''));
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            setHistory(prev => [...prev.slice(-19), { time, price }]);
          }
        })
        .catch(err => console.error("Failed to fetch stats", err));
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000); // 5s refresh for "Real-Time"
    return () => clearInterval(interval);
  }, []);

  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-obscura-bg text-white font-sans selection:bg-neon selection:text-black gradient-mesh">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/10 px-6 py-4">
        <div className="container-custom flex justify-between items-center">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => scrollTo('network')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-highlight to-neon border border-white/20 flex items-center justify-center group-hover:rotate-12 transition-transform shadow-[0_0_15px_rgba(0,255,255,0.2)]">
              <Shield className="text-white w-6 h-6" />
            </div>
            <span className="text-2xl font-black tracking-tighter neon-text">OBSCURA</span>
          </div>
          <div className="hidden md:flex gap-10 text-sm font-bold uppercase tracking-widest text-gray-400">
            <button onClick={() => scrollTo('network')} className="hover:text-neon transition">Network</button>
            <button onClick={() => scrollTo('feeds')} className="hover:text-neon transition">Streams</button>
            <button onClick={() => scrollTo('staking')} className="hover:text-neon transition">Staking</button>
            <button onClick={() => scrollTo('docs')} className="hover:text-neon transition">Docs</button>
          </div>
          <button
            onClick={() => setIsHubOpen(true)}
            className="px-6 py-2 rounded-lg bg-gradient-to-r from-highlight to-purple hover:scale-105 active:scale-95 transition-all text-sm font-black border border-white/20 shadow-[0_0_20px_rgba(123,0,130,0.3)]"
          >
            ACCESS HUB
          </button>
        </div>
      </nav>

      {/* Hero / Visualization Section */}
      <section id="network" className="relative h-screen w-full flex items-center">
        <div className="absolute inset-0 z-0">
          <Canvas camera={{ position: [0, 0, 7] }}>
            <Suspense fallback={null}>
              <Globe />
            </Suspense>
          </Canvas>
        </div>

        <div className="container-custom relative z-10 w-full flex flex-col items-start pointer-events-none">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="max-w-3xl"
          >
            <div className="inline-block px-4 py-1 rounded-full border border-neon/30 bg-neon/5 text-[10px] font-black tracking-[0.2em] text-neon mb-6 uppercase">
              Privacy-First Oracle Layer
            </div>
            <h1 className="text-6xl lg:text-8xl font-black leading-[0.9] mb-8 tracking-tighter">
              UNVEILING THE<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon to-highlight">HIDDEN DATA</span><br />
              MESH
            </h1>
            <p className="text-xl text-gray-400 mb-10 max-w-xl pointer-events-auto leading-relaxed">
              Decentralized data with hardware-grade zero-knowledge orchestration.
              Secure your smart contracts with proofs, not just data points.
            </p>
            <div className="flex flex-wrap gap-6 pointer-events-auto">
              <button
                onClick={() => scrollTo('staking')}
                className="px-10 py-4 rounded-xl bg-neon text-black font-black hover:shadow-[0_0_30px_#00FFFF] transition-all transform hover:-translate-y-1 active:translate-y-0"
              >
                BECOME A NODE
              </button>
              <button
                onClick={() => scrollTo('feeds')}
                className="px-10 py-4 rounded-xl border border-white/10 glass hover:bg-white/10 transition-all font-bold"
              >
                EXPLORE DATA
              </button>
            </div>
          </motion.div>
        </div>

        {/* Floating Stats */}
        <div className="absolute bottom-12 left-0 w-full pointer-events-none">
          <div className="container-custom flex justify-end gap-4">
            <StatCard icon={<Activity className="text-neon" />} label="Latency" value={stats.latency} />
            <StatCard icon={<Database className="text-purple" />} label="Nodes" value={stats.activeNodes.toString()} />
            <StatCard icon={<Lock className="text-accent" />} label="ZKP/S" value={stats.zk_proofs_sec.toString()} />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-obscura-deep py-32 border-y border-white/5 relative">
        <div className="container-custom">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <FeatureCard
              icon={<Terminal size={32} />}
              title="WASM Runtimes"
              desc="Serverless execution in secure sandboxes with privacy-preserving verifiable proofs."
            />
            <FeatureCard
              icon={<GhostIcon size={32} />}
              title="Obscura Mode"
              desc="ZK-SNARKs prove data validity ranges without leaking underlying sensitive endpoint secrets."
            />
            <FeatureCard
              icon={<GlobeIcon size={32} />}
              title="CrossLink Meta"
              desc="Native privacy-preserving interoperability across EVM, Solana, and Cosmos ecosystems."
            />
          </div>
        </div>
      </section>

      <div className="container-custom">
        <DataFeeds feeds={stats.price_feeds} history={history} />
        <StakeGuard />
        <DocsSection />
      </div>

      <Footer />

      <HubModal
        isOpen={isHubOpen}
        onClose={() => setIsHubOpen(false)}
        logs={stats.logs}
      />
    </div>
  );
}

function GhostIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 10h.01" /><path d="M15 10h.01" /><path d="m12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" />
    </svg>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="glass p-5 rounded-2xl border border-white/10 min-w-[140px] pointer-events-auto hover:border-neon/40 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1 rounded bg-white/5">{icon}</div>
        <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-xl font-black">{value}</div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="p-10 rounded-[2rem] bg-gradient-to-b from-white/5 to-transparent border border-white/10 hover:border-neon group transition-all duration-500">
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-neon mb-8 group-hover:scale-110 transition-transform bg-gradient-to-tr from-white/5 to-white/10 border border-white/10">
        {icon}
      </div>
      <h3 className="text-2xl font-black mb-4 tracking-tight">{title}</h3>
      <p className="text-gray-400 leading-relaxed font-medium">
        {desc}
      </p>
    </div>
  );
}

export default App;
