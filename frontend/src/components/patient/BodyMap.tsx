import { useState, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useSymptoms } from '../../context/SymptomContext'
import type { BodyRegion } from '../../types'
import SymptomModal from './SymptomModal'

const regionLabels: Record<BodyRegion, string> = {
  LLQ: 'Left Lower Quadrant',
  RLQ: 'Right Lower Quadrant',
  pelvic_midline: 'Pelvic Midline',
  suprapubic: 'Suprapubic',
  vulva: 'Vulva',
  low_back: 'Lower Back',
  left_thigh: 'Left Thigh',
  right_thigh: 'Right Thigh',
}

// maps severity 0-10 to a color
function severityColor(severity: number | undefined): string {
  if (!severity || severity === 0) return '#e5e7eb'
  if (severity <= 3) return '#fde68a'
  if (severity <= 6) return '#fb923c'
  return '#dc2626'
}

interface RegionMeshProps {
  region: BodyRegion
  position: [number, number, number]
  size: [number, number, number]
  severity?: number
  onClick: (region: BodyRegion) => void
}

function RegionMesh({ region, position, size, severity, onClick }: RegionMeshProps) {
  const ref = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  useFrame(() => {
    if (!ref.current) return
    const target = hovered ? 1.08 : 1
    ref.current.scale.lerp(new THREE.Vector3(target, target, target), 0.1)
  })

  const color = hovered ? '#dc2626' : severityColor(severity)

  return (
    <mesh
      ref={ref}
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick(region) }}
      onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default' }}
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={hovered ? 0.9 : severity ? 0.8 : 0.3}
      />
    </mesh>
  )
}

// simple body outline
function BodyOutline() {
  return (
    <group>
      {/* torso */}
      <mesh position={[0, 0.6, 0]}>
        <capsuleGeometry args={[0.4, 1.2, 8, 16]} />
        <meshStandardMaterial color="#f9d5c2" transparent opacity={0.4} />
      </mesh>
      {/* head */}
      <mesh position={[0, 1.8, 0]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color="#f9d5c2" transparent opacity={0.4} />
      </mesh>
      {/* left leg */}
      <mesh position={[-0.2, -1.0, 0]}>
        <capsuleGeometry args={[0.15, 1.0, 8, 16]} />
        <meshStandardMaterial color="#f9d5c2" transparent opacity={0.4} />
      </mesh>
      {/* right leg */}
      <mesh position={[0.2, -1.0, 0]}>
        <capsuleGeometry args={[0.15, 1.0, 8, 16]} />
        <meshStandardMaterial color="#f9d5c2" transparent opacity={0.4} />
      </mesh>
    </group>
  )
}

export default function BodyMap() {
  const { maxSeverityByRegion } = useSymptoms()
  const [selectedRegion, setSelectedRegion] = useState<BodyRegion | null>(null)
  const severityMap = maxSeverityByRegion()

  const regions: { region: BodyRegion; pos: [number, number, number]; size: [number, number, number] }[] = [
    { region: 'RLQ', pos: [-0.25, -0.15, 0.2], size: [0.3, 0.25, 0.3] },
    { region: 'LLQ', pos: [0.25, -0.15, 0.2], size: [0.3, 0.25, 0.3] },
    { region: 'pelvic_midline', pos: [0, -0.35, 0.2], size: [0.35, 0.2, 0.3] },
    { region: 'suprapubic', pos: [0, -0.55, 0.2], size: [0.4, 0.2, 0.3] },
    { region: 'vulva', pos: [0, -0.75, 0.25], size: [0.25, 0.15, 0.2] },
    { region: 'low_back', pos: [0, -0.2, -0.25], size: [0.5, 0.35, 0.2] },
    { region: 'left_thigh', pos: [0.22, -1.0, 0.1], size: [0.2, 0.4, 0.2] },
    { region: 'right_thigh', pos: [-0.22, -1.0, 0.1], size: [0.2, 0.4, 0.2] },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1f2937', margin: '0 0 4px' }}>Symptom Body Map</h2>
          <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>tap a region to log a symptom</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11, color: '#9ca3af' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#fde68a' }} /> mild
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#fb923c' }} /> moderate
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#dc2626' }} /> severe
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{
          flex: 1, height: 520, backgroundColor: '#fff', borderRadius: 12,
          border: '1px solid #e5e7eb', overflow: 'hidden',
        }}>
          <Canvas camera={{ position: [0, 0, 3.5], fov: 45 }}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[2, 3, 2]} intensity={0.8} />
            <BodyOutline />
            {regions.map((r) => (
              <RegionMesh
                key={r.region}
                region={r.region}
                position={r.pos}
                size={r.size}
                severity={severityMap[r.region]}
                onClick={setSelectedRegion}
              />
            ))}
            <OrbitControls enableZoom={true} enablePan={false} minDistance={2} maxDistance={6} />
          </Canvas>
        </div>

        {/* region legend */}
        <div style={{ width: 200, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 8px' }}>
            regions
          </h3>
          {regions.map((r) => (
            <button
              key={r.region}
              onClick={() => setSelectedRegion(r.region)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb',
                backgroundColor: '#fff', cursor: 'pointer', fontSize: 12,
                fontWeight: 500, color: '#374151', textAlign: 'left',
              }}
            >
              <span style={{
                width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                backgroundColor: severityColor(severityMap[r.region]),
              }} />
              {regionLabels[r.region]}
            </button>
          ))}
        </div>
      </div>

      {selectedRegion && (
        <SymptomModal
          region={selectedRegion}
          regionLabel={regionLabels[selectedRegion]}
          onClose={() => setSelectedRegion(null)}
        />
      )}
    </div>
  )
}
