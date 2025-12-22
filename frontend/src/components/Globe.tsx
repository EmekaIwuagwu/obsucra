import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const Stars: React.FC = () => {
    const points = useMemo(() => {
        const p = new Float32Array(5000 * 3);
        for (let i = 0; i < 5000; i++) {
            p[i * 3] = (Math.random() - 0.5) * 100;
            p[i * 3 + 1] = (Math.random() - 0.5) * 100;
            p[i * 3 + 2] = (Math.random() - 0.5) * 100;
        }
        return p;
    }, []);

    return (
        <points>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={points.length / 3}
                    array={points}
                    itemSize={3}
                    args={[points, 3]}
                />
            </bufferGeometry>
            <pointsMaterial size={0.05} color="#00FFFF" transparent opacity={0.6} sizeAttenuation />
        </points>
    );
};

const Globe: React.FC = () => {
    const meshRef = useRef<THREE.Mesh>(null!);

    useFrame(() => {
        if (meshRef.current) {
            meshRef.current.rotation.y += 0.002;
        }
    });

    return (
        <>
            <Stars />
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1.5} color="#00FFFF" />

            <mesh ref={meshRef}>
                <sphereGeometry args={[2.5, 64, 64]} />
                <meshStandardMaterial
                    color="#0A0A2A"
                    roughness={0.1}
                    metalness={0.9}
                    emissive="#4B0082"
                    emissiveIntensity={0.2}
                />
            </mesh>

            {/* Simulated Node Points */}
            {[...Array(30)].map((_, i) => (
                <mesh key={i} position={[
                    Math.cos(i * 1.3) * 2.6,
                    Math.sin(i * 1.5) * 2.6,
                    Math.sin(i * 0.8) * 2.6
                ]}>
                    <sphereGeometry args={[0.04, 16, 16]} />
                    <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={5} />
                </mesh>
            ))}
        </>
    );
};

export default Globe;
