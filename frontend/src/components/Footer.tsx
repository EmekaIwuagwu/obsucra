import React from 'react';
import { Shield, Github, Twitter, MessageSquare, ExternalLink } from 'lucide-react';

const Footer: React.FC = () => {
    return (
        <footer className="bg-obscura-bg border-t border-white/5 pt-32 pb-16">
            <div className="container-custom">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-24">
                    <div className="col-span-1 md:col-span-1">
                        <div className="flex items-center gap-2 mb-8">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-highlight to-neon flex items-center justify-center shadow-[0_0_15px_rgba(0,255,255,0.1)]">
                                <Shield className="text-white w-5 h-5" />
                            </div>
                            <span className="text-2xl font-black tracking-tighter neon-text">OBSCURA</span>
                        </div>
                        <p className="text-gray-500 text-sm leading-relaxed font-medium">
                            The next generation of privacy-preserving oracle networks. Empowering decentralized applications with verifiable, hardware-grade confidential data streams.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-black text-[10px] uppercase tracking-[0.2em] text-white mb-8">Network</h4>
                        <ul className="space-y-4 text-sm text-gray-400 font-medium">
                            <li><button onClick={() => alert('Opening Operator Hub...')} className="hover:text-neon transition">Operator Hub</button></li>
                            <li><button onClick={() => alert('Fetching Node Status... All systems operational.')} className="hover:text-neon transition">Node Status</button></li>
                            <li><button onClick={() => alert('Loading Network Map...')} className="hover:text-neon transition">Network Map</button></li>
                            <li><button onClick={() => alert('Syncing Verified APIs...')} className="hover:text-neon transition">Verified APIs</button></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-black text-[10px] uppercase tracking-[0.2em] text-white mb-8">Developers</h4>
                        <ul className="space-y-4 text-sm text-gray-400 font-medium">
                            <li><a href="https://docs.obscura.network" target="_blank" rel="noopener noreferrer" className="hover:text-neon transition flex items-center gap-2">Documentation <ExternalLink size={14} /></a></li>
                            <li><button onClick={() => alert('Downloading Obscura SDK v1.0.4...')} className="hover:text-neon transition">Obscura SDK</button></li>
                            <li><button onClick={() => alert('Opening ZK Builder...')} className="hover:text-neon transition">ZK Builder</button></li>
                            <li><button onClick={() => alert('Installing Local CLI...')} className="hover:text-neon transition">Local CLI</button></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-black text-[10px] uppercase tracking-[0.2em] text-white mb-8">Connect</h4>
                        <div className="flex gap-4 mb-10">
                            <SocialIcon icon={<Twitter size={20} />} href="https://twitter.com/obscuranet" />
                            <SocialIcon icon={<Github size={20} />} href="https://github.com/obscura-network" />
                            <SocialIcon icon={<MessageSquare size={20} />} href="https://discord.gg/obscura" />
                        </div>
                        <div className="space-y-4">
                            <div className="relative">
                                <input type="email" placeholder="MESH SUBSCRIPTION" className="bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-xs font-black tracking-widest focus:outline-none focus:border-neon w-full placeholder:text-gray-600" />
                                <button
                                    onClick={() => alert('Subscription Synchronized. Welcome to the Mesh.')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-neon text-black p-2 rounded-lg font-black text-[10px]"
                                >
                                    GO
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center border-t border-white/10 pt-12 text-[10px] text-gray-600 font-black tracking-[0.3em] uppercase">
                    <span>© 2025 OBSCURA PROTOCOL. ALL RIGHTS RESERVED.</span>
                    <div className="flex gap-10 mt-6 md:mt-0">
                        <a href="#" className="hover:text-white transition">Privacy</a>
                        <a href="#" className="hover:text-white transition">Terms</a>
                        <a href="#" className="hover:text-white transition">Audits</a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

function SocialIcon({ icon, href }: { icon: React.ReactNode, href: string }) {
    return (
        <a href={href} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-neon hover:bg-white/10 transition">
            {icon}
        </a>
    );
}

export default Footer;
