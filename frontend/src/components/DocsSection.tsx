import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Code, Terminal, Cpu, Info, ChevronRight } from 'lucide-react';

const DocsSection: React.FC = () => {
    return (
        <section id="docs" className="section-padding border-t border-white/5 bg-obscura-bg/50">
            <div className="container-custom">
                <div className="flex flex-col md:row justify-between items-start gap-12 mb-20">
                    <div className="max-w-2xl">
                        <div className="text-neon text-[10px] font-black tracking-[0.2em] uppercase mb-4">Knowledge Base</div>
                        <h2 className="text-5xl font-black mb-6 tracking-tighter">DEVELOPER DOCS</h2>
                        <p className="text-gray-400 font-medium text-lg leading-relaxed">
                            Integrate the Obscura privacy layer into your dApp. From ZK-proof generation to WASM serverless scripts, explore our comprehensive technical guides.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <DocCard
                        icon={<Terminal className="text-neon" />}
                        title="Quick Start Guide"
                        desc="Deploy your first Obscura-ready node in under 5 minutes."
                    />
                    <DocCard
                        icon={<Code className="text-purple" />}
                        title="Obscura SDK"
                        desc="Integrate privacy-first data streams into your Solidity or Rust contracts."
                    />
                    <DocCard
                        icon={<Cpu className="text-accent" />}
                        title="ZK Circuit Builder"
                        desc="Design custom proof circuits for sensitive data orchestration."
                    />
                    <DocCard
                        icon={<BookOpen className="text-highlight" />}
                        title="API Reference"
                        desc="Complete specification of the Obscura Node JSON-RPC API."
                    />
                    <DocCard
                        icon={<Info className="text-highlight" />}
                        title="Whitepaper"
                        desc="Deep dive into the cryptoeconomic security and ZK architecture."
                    />
                </div>
            </div>
        </section>
    );
};

function DocCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="p-8 glass rounded-3xl border border-white/10 group cursor-pointer hover:border-neon transition-all"
        >
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <h3 className="text-xl font-black mb-3 flex items-center gap-2 group-hover:text-neon transition-colors">
                {title} <ChevronRight size={18} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed font-medium">
                {desc}
            </p>
        </motion.div>
    );
}

export default DocsSection;
