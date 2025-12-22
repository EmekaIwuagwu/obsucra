import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import { motion } from 'framer-motion';
import * as THREE from 'three';

// 3D Globe Component
const Globe = () => {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.1;
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
                    <Html distanceFactor={10}>
                        <div className="text-[6px] text-cyan-300 font-mono opacity-60">Node-{node.id}</div>
                    </Html>
                </mesh>
            ))}
        </>
    );
};

// Data Particles Flowing
const DataFlow = () => {
    const particlesRef = useRef<THREE.Points>(null);
    const particleCount = 200;

    const [positions, speeds] = useMemo(() => {
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
            const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
            for (let i = 0; i < particleCount; i++) {
                positions[i * 3 + 1] += speeds[i]; // Move Up
                if (positions[i * 3 + 1] > 5) positions[i * 3 + 1] = -5;
            }
            particlesRef.current.geometry.attributes.position.needsUpdate = true;
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
                />
            </bufferGeometry>
            <pointsMaterial color="#FF00FF" size={0.03} transparent opacity={0.6} />
        </points>
    )
}

const Dashboard: React.FC = () => {
    return (
        <div className="relative h-screen w-full bg-[#000033] overflow-hidden">
            {/* 3D Scene Layer */}
            <div className="absolute inset-0 z-0">
                <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} intensity={1} color="#FFD700" />
                    <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
                    <Globe />
                    <DataFlow />
                    <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
                </Canvas>
            </div>

            {/* UI Overlay */}
            <div className="relative z-10 p-8 h-full flex flex-col pointer-events-none">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-between items-start pointer-events-auto"
                >
                    <div>
                        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600 animate-pulse text-glow-neon">
                            OBSCURA
                        </h1>
                        <p className="text-xl text-cyan-100 tracking-[0.3em] font-light mt-2">
                            THE INVISIBLE ORACLE MATRIX
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <div className="card-glass text-center p-4">
                            <div className="text-gray-400 text-xs uppercase tracking-widest">Active Nodes</div>
                            <div className="text-3xl font-bold text-[#00FFFF]">1,248</div>
                        </div>
                        <div className="card-glass text-center p-4">
                            <div className="text-gray-400 text-xs uppercase tracking-widest">Jobs Processed</div>
                            <div className="text-3xl font-bold text-[#FF00FF]">8.5M</div>
                        </div>
                        <div className="card-glass text-center p-4">
                            <div className="text-gray-400 text-xs uppercase tracking-widest">Network Health</div>
                            <div className="text-3xl font-bold text-[#00FF00]">99.9%</div>
                        </div>
                    </div>
                </motion.div>

                {/* Hero Content */}
                <div className="flex-1 flex items-center mt-12 pointer-events-auto">
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 }}
                        className="max-w-xl"
                    >
                        <div className="bg-black/40 backdrop-blur-xl p-8 rounded-2xl border-l-4 border-cyan-500 shadow-[0_0_50px_rgba(0,255,255,0.2)]">
                            <h2 className="text-3xl font-bold mb-4 text-white">
                                Next-Gen <span className="text-[#FFD700]">Privacy-First</span> Data Feeds
                            </h2>
                            <p className="text-gray-300 mb-6 leading-relaxed">
                                Secure your smart contracts with ZK-proven data aggregation, AI-driven predictive feeds, and total confidentiality.
                                The future of DeFi is obscured.
                            </p>
                            <div className="flex gap-4">
                                <button className="btn-cosmic text-lg">
                                    Launch App
                                </button>
                                <button className="px-6 py-3 border border-cyan-500 text-cyan-400 font-bold rounded-full hover:bg-cyan-900/30 transition-all">
                                    Read Docs
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
