import React, { useRef, useMemo, useState, useEffect } from 'react';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import Logo from './Logo'; // Updated import
import Features from './Features';
import DataFeeds from './DataFeeds';
import Footer from './Footer';
import { ObscuraSDK } from '../sdk/obscura';

// 3D Globe Component
const Globe = () => {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((_: any, delta: number) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.05;
        }
    });

    return (
        <mesh ref={meshRef}>
            <sphereGeometry args={[2.5, 64, 64]} />
            <meshStandardMaterial
                color="#000033"
                emissive="#0A0A2A"
                emissiveIntensity={0.5}
                wireframe
                transparent
                opacity={0.8}
            />
            <Nodes count={12} radius={2.5} />
        </mesh>
    );
};

// Orbiting Nodes
const Nodes = ({ count, radius }: { count: number, radius: number }) => {
    const nodes = useMemo(() => {
        return new Array(count).fill(0).map((_, i) => {
            const phi = Math.acos(-1 + (2 * i) / count);
            const theta = Math.sqrt(count * Math.PI) * phi;
            return {
                position: new THREE.Vector3(
                    radius * Math.cos(theta) * Math.sin(phi),
                    radius * Math.sin(theta) * Math.sin(phi),
                    radius * Math.cos(phi)
                ),
                id: i
            };
        });
    }, [count, radius]);

    return (
        <>
            {nodes.map((node, i) => (
                <mesh key={i} position={node.position}>
                    <sphereGeometry args={[0.08, 16, 16]} />
                    <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={2} />
                </mesh>
            ))}
        </>
    );
};

// Data Particles Flowing
const DataFlow = () => {
    const particlesRef = useRef<THREE.Points>(null);
    const particleCount = 200;

    const [positions] = useMemo(() => {
        const pos = new Float32Array(particleCount * 3);
        const spd = new Float32Array(particleCount);
        for (let i = 0; i < particleCount; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 10;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
            spd[i] = Math.random() * 0.02 + 0.01;
        }
        return [pos, spd];
    }, []);

    useFrame(() => {
        if (particlesRef.current) {
            // const positions = particlesRef.current.geometry.attributes.position.array as Float32Array; // Read-only in TS?
            // Needs proper attribute update logic
        }
    });

    return (
        <points ref={particlesRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={positions.length / 3}
                    array={positions}
                    itemSize={3}
                    args={[positions, 3]}
                />
            </bufferGeometry>
            <pointsMaterial color="#FF00FF" size={0.03} transparent opacity={0.6} />
        </points>
    )
}

const LandingPage: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
    const [feeds, setFeeds] = useState<any[]>([]);
    const [networkStats, setNetworkStats] = useState({
        total_value_secured: 0,
        active_nodes: 0,
        data_points_per_day: 0,
        uptime_percent: 99.99
    });

    useEffect(() => {
        const sdk = new ObscuraSDK();

        const fetchFeeds = async () => {
            try {
                const data = await sdk.getFeeds();
                // Map backend FeedLiveStatus to DataFeeds format
                const mapped = data.map((f: any) => ({
                    name: f.id,
                    price: f.value,
                    status: f.is_zk ? 'ZK-Verified' : 'Standard',
                    trend: 0
                }));
                setFeeds(mapped);
            } catch (err) {
                console.error("LandingPage: Failed to fetch feeds", err);
            }
        };

        const fetchNetworkStats = async () => {
            try {
                const data = await sdk.getNetworkInfo();
                setNetworkStats(data);
            } catch (err) {
                console.error("LandingPage: Failed to fetch network stats", err);
            }
        };

        fetchFeeds();
        fetchNetworkStats();
        const interval = setInterval(() => {
            fetchFeeds();
            fetchNetworkStats();
        }, 5000);
        return () => clearInterval(interval);
    }, []);
    return (
        <div className="relative w-full bg-[#000033] text-white overflow-hidden overflow-y-auto h-screen scroll-smooth">
            {/* Hero Section (Full Screen) */}
            <section className="relative h-screen w-full flex flex-col">
                {/* 3D Scene Layer */}
                <div className="absolute inset-0 z-0">
                    <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
                        <ambientLight intensity={0.5} />
                        <pointLight position={[10, 10, 10]} intensity={1} color="#FFD700" />
                        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
                        <Globe />
                        <DataFlow />
                        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} enablePan={false} />
                    </Canvas>
                </div>

                {/* New Logo Header */}
                <div className="relative z-10 p-8 flex justify-between items-center pointer-events-none">
                    <div className="flex items-center gap-4 pointer-events-auto cursor-pointer" onClick={() => onNavigate('home')}>
                        <Logo />
                        <div>
                            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600 tracking-wider">
                                OBSCURA
                            </h1>
                        </div>
                    </div>

                    <div className="flex gap-6 pointer-events-auto">
                        <button className="text-gray-300 hover:text-white transition-colors" onClick={() => onNavigate('nodes')}>Nodes</button>
                        <button className="text-gray-300 hover:text-white transition-colors" onClick={() => onNavigate('developers')}>Documentation</button>
                        <button
                            onClick={() => onNavigate('dashboard')}
                            className="px-6 py-2 border border-[#00FFFF] text-[#00FFFF] rounded-full hover:bg-[#00FFFF]/20 transition-all font-bold"
                        >
                            Launch App
                        </button>
                    </div>
                </div>

                {/* Hero Text */}
                <div className="flex-1 flex flex-col justify-center px-12 z-10 pointer-events-none">
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                        className="max-w-3xl pointer-events-auto"
                    >
                        <h1 className="text-7xl font-bold leading-tight mb-6 text-white drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]">
                            The Invisible <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00FFFF] to-[#FF00FF]">Oracle Matrix</span>
                        </h1>
                        <p className="text-xl text-cyan-100 mb-8 max-w-2xl leading-relaxed drop-shadow-md">
                            Secure your smart contracts with ZK-proven data aggregation, AI-driven predictive feeds, and total confidentiality.
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => onNavigate('dashboard')}
                                className="btn-cosmic text-xl px-10 py-4 shadow-[0_0_30px_#00FFFF]"
                            >
                                Get Started
                            </button>
                            <button
                                onClick={() => onNavigate('enterprise')}
                                className="px-8 py-4 border border-white/30 backdrop-blur-md rounded-full text-white font-bold hover:bg-white/10 transition-all"
                            >
                                View Enterprise
                            </button>
                        </div>
                    </motion.div>
                </div>

                {/* Scroll Indicator */}
                <motion.div
                    animate={{ y: [0, 10, 0] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/50 z-10"
                >
                    SCROLL TO EXPLORE
                </motion.div>
            </section>

            {/* Features Section */}
            <div id="feeds" className="max-w-7xl mx-auto px-6">
                <DataFeeds feeds={feeds} history={[]} />
            </div>

            <div id="features">
                <Features />
            </div>

            {/* Stats Section */}
            <section className="py-20 bg-[#0A0A2A] relative">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
                    {[
                        { label: "Total Value Secured", val: networkStats.total_value_secured > 1000000000 ? `$${(networkStats.total_value_secured / 1000000000).toFixed(1)}B+` : networkStats.total_value_secured > 1000000 ? `$${(networkStats.total_value_secured / 1000000).toFixed(1)}M+` : `$${networkStats.total_value_secured.toLocaleString()}` },
                        { label: "Active Nodes", val: networkStats.active_nodes > 0 ? `${networkStats.active_nodes.toLocaleString()}+` : "Syncing..." },
                        { label: "Data Points/Day", val: networkStats.data_points_per_day > 1000000 ? `${(networkStats.data_points_per_day / 1000000).toFixed(1)}M` : networkStats.data_points_per_day > 1000 ? `${(networkStats.data_points_per_day / 1000).toFixed(1)}K` : `${networkStats.data_points_per_day}` },
                        { label: "Uptime", val: `${networkStats.uptime_percent.toFixed(2)}%` }
                    ].map((s, i) => (
                        <div key={i}>
                            <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-[#FFD700] to-[#FF4500] mb-2">{s.val}</div>
                            <div className="text-gray-400 uppercase text-sm tracking-widest">{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <Footer />
        </div>
    );
};

export default LandingPage;
