import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

function RotatingMars() {
  const marsRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (marsRef.current) {
      marsRef.current.rotation.y += delta * 0.15;
    }
  });

  return (
    <mesh ref={marsRef}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial color="#c1440e" roughness={0.9} metalness={0} />
    </mesh>
  );
}

export default function MarsGlobe() {
  return (
    <div style={{ width: "100%", height: "500px" }}>
      <Canvas camera={{ position: [0, 0, 3.2], fov: 45 }}>
        <color attach="background" args={["#0b0f19"]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 2, 4]} intensity={2} />
        <RotatingMars />
      </Canvas>
    </div>
  );
}
