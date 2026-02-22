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
  isHovered: boolean
  onHoverChange: (region: BodyRegion | null) => void
  onClick: (region: BodyRegion) => void
}

function RegionMesh({ region, position, size, severity, isHovered, onHoverChange, onClick }: RegionMeshProps) {
  const ref = useRef<THREE.Mesh>(null)

  // Smoothly scale up the block when hovered (either from mouse or from sidebar)
  useFrame(() => {
    if (!ref.current) return
    const target = isHovered ? 1.08 : 1
    ref.current.scale.lerp(new THREE.Vector3(target, target, target), 0.15)
  })

  // Flash pinkish-red when hovered, otherwise show severity color
  const color = isHovered ? '#ec4899' : severityColor(severity)

  return (
    <mesh
      ref={ref}
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick(region) }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHoverChange(region);
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onHoverChange(null);
        document.body.style.cursor = 'default'
      }}
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={isHovered ? 0.95 : severity ? 0.8 : 0.25}
        roughness={0.4}
      />
    </mesh>
  )
}

function BodyOutline() {
  const skinColor = "#e5e7eb"
  const skinOpacity = 0.6

  return (
    <group>
      <mesh position={[0, 1.8, 0]}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial color={skinColor} transparent opacity={skinOpacity} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.45, 0]}>
        <cylinderGeometry args={[0.12, 0.15, 0.3, 16]} />
        <meshStandardMaterial color={skinColor} transparent opacity={skinOpacity} />
      </mesh>
      <mesh position={[0, 0.8, 0]}>
        <capsuleGeometry args={[0.45, 0.8, 16, 32]} />
        <meshStandardMaterial color={skinColor} transparent opacity={skinOpacity} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <capsuleGeometry args={[0.48, 0.4, 16, 32]} />
        <meshStandardMaterial color={skinColor} transparent opacity={skinOpacity} />
      </mesh>
      <mesh position={[-0.65, 0.6, 0]} rotation={[0, 0, -0.15]}>
        <capsuleGeometry args={[0.12, 1.1, 16, 16]} />
        <meshStandardMaterial color={skinColor} transparent opacity={skinOpacity} />
      </mesh>
      <mesh position={[0.65, 0.6, 0]} rotation={[0, 0, 0.15]}>
        <capsuleGeometry args={[0.12, 1.1, 16, 16]} />
        <meshStandardMaterial color={skinColor} transparent opacity={skinOpacity} />
      </mesh>
      <mesh position={[-0.22, -1.1, 0]}>
        <capsuleGeometry args={[0.18, 1.4, 16, 16]} />
        <meshStandardMaterial color={skinColor} transparent opacity={skinOpacity} />
      </mesh>
      <mesh position={[0.22, -1.1, 0]}>
        <capsuleGeometry args={[0.18, 1.4, 16, 16]} />
        <meshStandardMaterial color={skinColor} transparent opacity={skinOpacity} />
      </mesh>
    </group>
  )
}

export default function BodyMap() {
  const { maxSeverityByRegion } = useSymptoms()
  const [selectedRegion, setSelectedRegion] = useState<BodyRegion | null>(null)

  // This state powers the two-way sync between Canvas and DOM
  const [hoveredRegion, setHoveredRegion] = useState<BodyRegion | null>(null)

  const severityMap = maxSeverityByRegion()

  const regions: { region: BodyRegion; pos: [number, number, number]; size: [number, number, number] }[] = [
    { region: 'RLQ', pos: [-0.25, 0.05, 0.3], size: [0.35, 0.25, 0.3] },
    { region: 'LLQ', pos: [0.25, 0.05, 0.3], size: [0.35, 0.25, 0.3] },
    { region: 'pelvic_midline', pos: [0, -0.2, 0.35], size: [0.45, 0.25, 0.3] },
    { region: 'suprapubic', pos: [0, -0.45, 0.35], size: [0.4, 0.2, 0.3] },
    { region: 'vulva', pos: [0, -0.7, 0.3], size: [0.25, 0.15, 0.25] },
    { region: 'low_back', pos: [0, 0.1, -0.3], size: [0.6, 0.4, 0.25] },
    { region: 'left_thigh', pos: [0.22, -0.8, 0.2], size: [0.25, 0.4, 0.3] },
    { region: 'right_thigh', pos: [-0.22, -0.8, 0.2], size: [0.25, 0.4, 0.3] },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1f2937', margin: '0 0 4px' }}>Symptom Body Map</h2>
          <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Tap an anatomical region to log a symptom</p>
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
        {/* 3D Canvas Viewport */}
        <div style={{
          flex: 1, height: 550, backgroundColor: '#f8fafc', borderRadius: 12,
          border: '1px solid #e5e7eb', overflow: 'hidden',
          boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)'
        }}>
          <Canvas camera={{ position: [0, -0.2, 3.8], fov: 40 }}>
            <ambientLight intensity={0.7} />
            <directionalLight position={[2, 4, 3]} intensity={0.9} />
            <directionalLight position={[-2, -2, -2]} intensity={0.3} color="#ec4899" />

            <BodyOutline />

            {regions.map((r) => (
              <RegionMesh
                key={r.region}
                region={r.region}
                position={r.pos}
                size={r.size}
                severity={severityMap[r.region]}
                isHovered={hoveredRegion === r.region}
                onHoverChange={setHoveredRegion}
                onClick={setSelectedRegion}
              />
            ))}

            <OrbitControls
              enableZoom={true}
              enablePan={false}
              minDistance={2}
              maxDistance={5}
              minPolarAngle={Math.PI / 3}
              maxPolarAngle={Math.PI / 1.5}
            />
          </Canvas>
        </div>

        {/* 2D Sidebar with Two-Way Hover Sync */}
        <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 8px' }}>
            Pelvic & Abdominal
          </h3>
          {regions.map((r) => {
            const isHovered = hoveredRegion === r.region
            const activeColor = severityColor(severityMap[r.region])

            return (
              <button
                key={r.region}
                onClick={() => setSelectedRegion(r.region)}
                onMouseEnter={() => setHoveredRegion(r.region)}
                onMouseLeave={() => setHoveredRegion(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 12px', borderRadius: 8,
                  border: isHovered ? '1px solid #ec4899' : '1px solid #e5e7eb',
                  backgroundColor: isHovered ? '#fdf2f8' : (severityMap[r.region] ? '#fff' : '#f9fafb'),
                  cursor: 'pointer', fontSize: 13,
                  fontWeight: 500, color: isHovered ? '#be185d' : '#374151', textAlign: 'left',
                  transform: isHovered ? 'translateX(-4px)' : 'translateX(0)', // Nice little slide effect
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <span style={{
                  width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                  backgroundColor: isHovered ? '#ec4899' : activeColor,
                  border: severityMap[r.region] || isHovered ? 'none' : '1px solid #d1d5db',
                  transition: 'background-color 0.2s'
                }} />
                {regionLabels[r.region]}
              </button>
            )
          })}
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
