/* components/Three/SceneCanvas.tsx */
import { Canvas } from '@react-three/fiber'
import {
  OrbitControls,
  Environment,
  ContactShadows,
  Grid,
  Bounds,
} from '@react-three/drei'
import type { PropsWithChildren } from 'react'
import { forwardRef, useImperativeHandle, useRef } from 'react'
import * as THREE from 'three'

function Ground() {
  return (
    <>
      {/* Big shadow-catching plane */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial
          color="#14161a"
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* Fading checker grid (like the screenshot) */}
      <Grid
        position={[0, 0.001, 0]}
        args={[100, 100]}
        cellSize={0.5}
        cellThickness={0.6}
        cellColor="#2b2f35"
        sectionSize={3}
        sectionThickness={1.0}
        sectionColor="#3b4048"
        fadeDistance={28}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />

      {/* Soft contact shadow under feet */}
      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.45}
        scale={12}
        blur={2.4}
        far={6}
        resolution={2048}
        frames={1}
      />
    </>
  )
}

export type SceneCanvasHandle = {
  capturePngDataUrl: () => string | null
}

export default forwardRef<SceneCanvasHandle, PropsWithChildren>(function SceneCanvas({ children }, ref) {
  const glRef = useRef<THREE.WebGLRenderer | null>(null)

  useImperativeHandle(ref, () => ({
    capturePngDataUrl: () => {
      const gl = glRef.current
      if (!gl) return null
      try {
        return gl.domElement.toDataURL('image/png')
      } catch {
        return null
      }
    },
  }), [])
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 32, near: 0.1, far: 100, position: [0, 1.65, 3.15] }}
      shadows
      gl={{ preserveDrawingBuffer: true }}
      onCreated={({ gl, scene }) => {
        glRef.current = gl
        gl.outputColorSpace = THREE.SRGBColorSpace
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        // Subtle atmospheric falloff like the render
        scene.fog = new THREE.Fog('#0f1115', 10, 26)
      }}
    >
      {/* Background matches the dark studio look */}
      <color attach="background" args={['#0f1115']} />

      {/* Key light from above/front-right */}
      <directionalLight
        position={[5, 7, 4]}
        intensity={1.65}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
      />

      {/* Fill light from left to lift shadows */}
      <directionalLight position={[-6, 2, 0]} intensity={0.35} />

      {/* Rim/back light to separate silhouette */}
      <directionalLight position={[0, 6, -6]} intensity={0.8} />

      {/* Subtle ambient base */}
      <ambientLight intensity={0.12} />

      {/* Specular environment for materials (not as background) */}
      <Environment preset="studio" intensity={0.7} />

      <Ground />

      <Bounds clip observe margin={1.05}>
        {children}
      </Bounds>

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={1.3}
        maxDistance={4.2}
        target={[0, 1.1, 0]}
        // Keep camera above horizon so the floor reads like the shot
        minPolarAngle={Math.PI * 0.15}
        maxPolarAngle={Math.PI * 0.49}
      />
    </Canvas>
  )
})
