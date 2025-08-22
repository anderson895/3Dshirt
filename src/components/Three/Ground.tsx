// components/Three/Ground.tsx
import { Grid } from '@react-three/drei'

export default function Ground() {
  return (
    <group rotation-x={-Math.PI / 2}>
      {/* Shadow-receiving floor */}
      <mesh receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial
          color="#171a1f"        // dark charcoal
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* Checker / sectional grid overlay (slightly above to avoid z-fighting) */}
      <Grid
        position={[0, 0.002, 0]}
        args={[200, 200]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#2a2f36"
        sectionSize={5}
        sectionThickness={1.2}
        sectionColor="#3a4048"
        infiniteGrid
        fadeDistance={38}
        fadeStrength={1}
        followCamera={false}
      />
    </group>
  )
}
