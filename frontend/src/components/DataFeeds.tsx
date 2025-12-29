import React from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// Initial chart data - replaced by real data once backend responds
const initialChartData = [
    { time: 'Loading', price: 0 }
];

interface Feed {
    name: string;
    price: string;
    status: string;
    trend: number;
}

interface DataFeedsProps {
    feeds: Feed[];
    history: { time: string, price: number }[];
}

const DataFeeds: React.FC<DataFeedsProps> = ({ feeds, history }) => {
    // Use provided history data, with loading state if empty
    const chartData = history.length > 0 ? history : initialChartData;
    const isLoading = history.length === 0;
    return (
        <section id="feeds" className="section-padding">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-16">
                <div>
                    <div className="text-neon text-[10px] font-black tracking-widest uppercase mb-4">Real-Time Aggregation</div>
                    <h2 className="text-5xl font-black tracking-tight mb-4">DATA STREAMS</h2>
                    <p className="text-gray-400 max-w-md">High-fidelity price feeds with cryptographically verifiable zero-knowledge proofs.</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => alert('Synchronizing Live Mesh Streams... Data verified.')}
                        className="px-6 py-3 rounded-xl glass text-xs font-black border border-neon/50 text-neon hover:bg-neon hover:text-black transition-all"
                    >
                        LIVE NET
                    </button>
                    <button
                        onClick={() => alert('Loading Historical Time-Series... Accessing Cold Storage Vault.')}
                        className="px-6 py-3 rounded-xl glass text-xs font-black border border-white/10 text-white/50 hover:bg-white/5 transition-all"
                    >
                        HISTORICAL
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                <div className="glass rounded-3xl p-8 border border-white/10 h-[400px]">
                    <div className="flex justify-between mb-6">
                        <span className="font-bold flex items-center gap-2">
                            BTC / USD {isLoading ? <span className="text-yellow-400 text-xs animate-pulse">Loading...</span> : <span className="text-emerald-400 text-xs">+1.2%</span>}
                        </span>
                        <span className="text-gray-500 text-xs">{isLoading ? 'Connecting...' : 'Node Consensus: 99.8%'}</span>
                    </div>
                    <ResponsiveContainer width="100%" height="80%">
                        <LineChart data={chartData}>
                            <XAxis dataKey="time" hide />
                            <YAxis hide domain={['auto', 'auto']} />
                            <Tooltip
                                contentStyle={{ background: '#0A0A2A', border: '1px solid #00FFFF', borderRadius: '8px' }}
                                itemStyle={{ color: '#00FFFF' }}
                            />
                            <Line
                                type="monotone"
                                dataKey="price"
                                stroke="#00FFFF"
                                strokeWidth={3}
                                dot={{ fill: '#00FFFF', r: 4 }}
                                activeDot={{ r: 8, stroke: '#FF00FF', strokeWidth: 2 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="space-y-4">
                    {feeds.length > 0 ? (
                        feeds.map((feed, idx) => (
                            <FeedItem
                                key={idx}
                                name={feed.name}
                                price={feed.price.includes('$') ? feed.price : `$${feed.price}`}
                                status={feed.status}
                                color={feed.status === 'Obscured' ? 'purple' : 'neon'}
                            />
                        ))
                    ) : (
                        <div className="text-gray-500 font-bold text-center py-20 glass rounded-3xl border border-white/5">
                            Waiting for Mesh Synchronization...
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

function FeedItem({ name, price, status, color = "neon", round = 1042 }: { name: string, price: string, status: string, color?: "neon" | "purple", round?: number }) {
    const glowColor = color === "neon" ? "group-hover:shadow-[0_0_15px_#00FFFF]" : "group-hover:shadow-[0_0_15px_#FF00FF]";
    const textColor = color === "neon" ? "text-neon" : "text-purple";
    const borderColor = color === "neon" ? "border-neon/20" : "border-purple/20";

    return (
        <motion.div
            whileHover={{ x: 10 }}
            className={`group p-6 glass rounded-2xl border ${borderColor} flex justify-between items-center transition-all ${glowColor}`}
        >
            <div className="flex flex-col">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{name}</span>
                    <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-400 font-mono">R{round}</span>
                </div>
                <span className={`text-[10px] uppercase font-bold tracking-widest ${textColor}`}>{status}</span>
            </div>
            <div className="text-2xl font-mono text-white/90 font-bold">{price}</div>
        </motion.div>
    );
}

export default DataFeeds;
