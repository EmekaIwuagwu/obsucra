import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Coins, TrendingUp, ShieldCheck, Zap } from 'lucide-react';

const StakeGuard: React.FC = () => {
    const [stakedAmount, setStakedAmount] = useState("");

    return (
        <section id="staking" className="section-padding">
            <div className="text-center mb-20">
                <div className="text-purple text-[10px] font-black tracking-widest uppercase mb-4">Cryptoeconomic Security</div>
                <h2 className="text-5xl font-black mb-4 tracking-tighter">STAKEGUARD</h2>
                <p className="text-gray-400 max-w-xl mx-auto font-medium">
                    Secure the network with $OBSCURA tokens. Earn rewards and gain reputation through privacy-preserving staking pools.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Stats Cards */}
                <StakeStat icon={<Coins />} label="Total Value Locked" value="$42,501,230" delay={0.1} />
                <StakeStat icon={<TrendingUp />} label="Est. APY" value="18.5%" delay={0.2} />
                <StakeStat icon={<ShieldCheck />} label="Slashing Resistance" value="99.9%" delay={0.3} />

                {/* Staking Interface */}
                <div className="lg:col-span-2 glass rounded-3xl p-10 border border-white/10 relative overflow-hidden">
                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-purple/10 rounded-full blur-[100px]" />

                    <h3 className="text-2xl font-bold mb-8 flex items-center gap-3">
                        <Zap className="text-accent" /> Manage Stake
                    </h3>

                    <div className="mb-8">
                        <label className="text-xs uppercase text-gray-400 font-bold mb-2 block">Amount to Stake ($OBSCURA)</label>
                        <div className="relative">
                            <input
                                type="number"
                                value={stakedAmount}
                                onChange={(e) => setStakedAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-6 px-8 text-3xl font-bold focus:outline-none focus:border-neon transition-colors"
                            />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-500 font-bold">
                                MAX
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-10">
                        <StakeTier title="Node Operator" apy="22%" min="10,000" active />
                        <StakeTier title="Community Staker" apy="14%" min="100" />
                    </div>

                    <button
                        onClick={() => alert(`Staking ${stakedAmount || '0'} $OBSCURA. Please sign the transaction in your Obscura Wallet.`)}
                        className="w-full py-6 rounded-2xl bg-gradient-to-r from-neon to-purple text-black font-black text-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(0,255,255,0.3)]"
                    >
                        APPROVE & STAKE
                    </button>
                </div>

                {/* Staking Rules Panel */}
                <div className="glass rounded-3xl p-10 border border-white/10 space-y-6">
                    <h3 className="text-xl font-bold mb-4">Staking Rules</h3>
                    <RuleItem text="7-day unbonding period for standard stakers." icon="⏳" />
                    <RuleItem text="Governance voting power proportional to stake." icon="🗳️" />
                    <RuleItem text="Bonus rewards for privacy-node operators." icon="🛡️" />

                    <div className="mt-12 p-6 bg-accent/10 border border-accent/20 rounded-2xl">
                        <span className="text-[10px] text-accent font-black uppercase">Alpha Feature</span>
                        <p className="text-sm font-medium mt-1 italic">
                            "Staked assets are insured against node failures via Obscura Insurance Pool."
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};

function StakeStat({ icon, label, value, delay }: { icon: React.ReactNode, label: string, value: string, delay: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="glass p-8 rounded-3xl border border-white/10 flex items-center gap-6"
        >
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-neon">
                {icon}
            </div>
            <div>
                <div className="text-xs text-gray-400 uppercase font-black tracking-widest">{label}</div>
                <div className="text-3xl font-black">{value}</div>
            </div>
        </motion.div>
    );
}

function StakeTier({ title, apy, min, active = false }: { title: string, apy: string, min: string, active?: boolean }) {
    return (
        <div className={`p-6 rounded-2xl border transition-all cursor-pointer ${active ? 'bg-neon/10 border-neon' : 'bg-white/5 border-white/10 hover:border-white/30'}`}>
            <div className="flex justify-between items-start mb-2">
                <span className="font-bold">{title}</span>
                {active && <div className="w-2 h-2 rounded-full bg-neon animate-pulse" />}
            </div>
            <div className="text-2xl font-black text-white">{apy} <span className="text-xs text-gray-500 font-medium">APY</span></div>
            <div className="text-[10px] text-gray-400 mt-2 uppercase">Min. Stake: {min} $OBS</div>
        </div>
    );
}

function RuleItem({ text, icon }: { text: string, icon: string }) {
    return (
        <div className="flex gap-4 items-start text-gray-300 text-sm">
            <span className="text-lg">{icon}</span>
            <p>{text}</p>
        </div>
    );
}

export default StakeGuard;
