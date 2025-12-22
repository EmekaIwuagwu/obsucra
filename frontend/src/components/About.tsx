import React from 'react';
import { motion } from 'framer-motion';
import { Github, Twitter, Linkedin, Mail } from 'lucide-react';

const About: React.FC = () => {
    return (
        <div className="p-8 pt-12 min-h-screen">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-4xl mx-auto"
            >
                {/* Mission */}
                <div className="text-center mb-20">
                    <h2 className="text-5xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                        Our Mission
                    </h2>
                    <p className="text-xl text-gray-300 leading-relaxed font-light">
                        "To liberate the world's data by building the first truly confidential and verifiable bridge between the off-chain reality and the on-chain future."
                    </p>
                </div>

                {/* Core Values */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
                    <div className="text-center">
                        <div className="text-4xl font-black text-[#00FFFF] mb-4">01</div>
                        <h3 className="text-xl font-bold text-white mb-2">Privacy First</h3>
                        <p className="text-gray-400 text-sm">We believe privacy is a fundamental human right, even for smart contracts.</p>
                    </div>
                    <div className="text-center">
                        <div className="text-4xl font-black text-[#FF00FF] mb-4">02</div>
                        <h3 className="text-xl font-bold text-white mb-2">Trustless</h3>
                        <p className="text-gray-400 text-sm">Don't trust, verify. Our ZK architecture removes the need for blind faith.</p>
                    </div>
                    <div className="text-center">
                        <div className="text-4xl font-black text-[#FFD700] mb-4">03</div>
                        <h3 className="text-xl font-bold text-white mb-2">Decentralized</h3>
                        <p className="text-gray-400 text-sm">Control belongs to the DAO, not a corporation. Community-owned infrastructure.</p>
                    </div>
                </div>

                {/* Team (Anonymized) */}
                <h3 className="text-3xl font-bold text-white mb-8 text-center pt-10 border-t border-white/10">Core Contributors</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
                    {['0xCipher', 'Neo', 'Trinity', 'Morpheus'].map((name, i) => (
                        <div key={i} className="card-glass text-center p-6 group">
                            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-indigo-900 to-black mb-4 flex items-center justify-center border border-white/10 group-hover:border-[#00FFFF] transition-colors">
                                <span className="text-2xl">👤</span>
                            </div>
                            <div className="font-bold text-white">{name}</div>
                            <div className="text-xs text-gray-500">Co-Founder</div>
                        </div>
                    ))}
                </div>

                {/* Contact */}
                <div className="flex justify-center gap-8">
                    <SocialLink icon={Twitter} href="#" label="Twitter" />
                    <SocialLink icon={Github} href="#" label="GitHub" />
                    <SocialLink icon={Linkedin} href="#" label="LinkedIn" />
                    <SocialLink icon={Mail} href="#" label="Email" />
                </div>
            </motion.div>
        </div>
    );
};

const SocialLink = ({ icon: Icon, href, label }: { icon: any, href: string, label: string }) => (
    <a href={href} className="text-gray-400 hover:text-[#00FFFF] transition-colors flex flex-col items-center gap-2 group">
        <div className="p-3 rounded-full bg-white/5 group-hover:bg-[#00FFFF]/10 transition-colors">
            <Icon size={24} />
        </div>
        <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">{label}</span>
    </a>
)

export default About;
