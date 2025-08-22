/* store/designStore.ts */
import { create } from 'zustand'

export type Gender = 'male' | 'female'
export type BodyPreset = 'slim' | 'average' | 'plus'
export type GarmentStyle = 'fit' | 'regular' | 'loose'
export type ShirtPart = 'front' | 'back' | 'sleeveL' | 'sleeveR'

export type MorphSet = { height: number; waist: number; shoulder: number; chest: number; arms: number }
export type Measurements = { heightCm: number; chestCm: number; waistCm: number; shouldersCm: number; sleeveCm: number }
export type GarmentConfig = { preset?: 'S'|'M'|'L'|'XL'; custom?: { widthIn: number; lengthIn: number; sleeveIn: number }; style: GarmentStyle }

export type Layer = {
  id: string
  kind: 'image' | 'text'
  part: ShirtPart
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
  text?: string
  font?: string
  size?: number
  color?: string
  src?: string
  fitOnLoad?: boolean
  z: number
}

export type UVRect = { x: number; y: number; w: number; h: number }
export type UVRects = Record<ShirtPart, UVRect>

export type DesignState = {
  gender: Gender
  preset: BodyPreset
  morphs: MorphSet
  heightScale: number
  measurements: Measurements
  garment: GarmentConfig
  layers: Layer[]

  baseColor: string
  setBaseColor: (hex: string) => void

  shirtTexCanvas: HTMLCanvasElement | null
  shirtTexStamp: number
  setShirtTexCanvas: (c: HTMLCanvasElement | null) => void
  bumpShirtTexStamp: () => void

  uvRects: UVRects
  setUVRects: (rects: Partial<UVRects>) => void

  setGender: (g: Gender) => void
  setPreset: (p: BodyPreset) => void
  setMorph: (k: keyof MorphSet, v: number) => void
  setHeightScale: (v: number) => void
  setMeasurements: (m: Partial<Measurements>) => void
  setGarment: (g: Partial<GarmentConfig>) => void
  addLayer: (l: Layer) => void
  updateLayer: (id: string, patch: Partial<Layer>) => void
  removeLayer: (id: string) => void
}

export const useDesign = create<DesignState>((set) => ({
  gender: 'male',
  preset: 'average',
  morphs: { height: 0.5, waist: 0.5, shoulder: 0.5, chest: 0.5, arms: 0.5 },
  heightScale: 1.0,
  measurements: { heightCm: 175, chestCm: 96, waistCm: 82, shouldersCm: 46, sleeveCm: 60 },
  garment: { style: 'regular', preset: 'M' },
  layers: [],

  baseColor: '#b91c1c',
  setBaseColor: (hex) => set({ baseColor: hex }),

  shirtTexCanvas: null,
  shirtTexStamp: 0,
  setShirtTexCanvas: (c) => set({ shirtTexCanvas: c }),
  bumpShirtTexStamp: () => set((s) => ({ shirtTexStamp: s.shirtTexStamp + 1 })),

  uvRects: {
    front:   { x: 0.0, y: 0.0, w: 0.5, h: 0.5 },
    back:    { x: 0.5, y: 0.0, w: 0.5, h: 0.5 },
    sleeveL: { x: 0.0, y: 0.5, w: 0.5, h: 0.5 },
    sleeveR: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  },
  setUVRects: (rects) => set((s) => ({ uvRects: { ...s.uvRects, ...rects } })),

  setGender: (gender) => set({ gender }),
  setPreset: (preset) => set({ preset }),
  setMorph: (k, v) => set((s) => ({ morphs: { ...s.morphs, [k]: v } })),
  setHeightScale: (v) => set({ heightScale: v }),
  setMeasurements: (m) => set((s) => ({ measurements: { ...s.measurements, ...m } })),
  setGarment: (g) => set((s) => ({ garment: { ...s.garment, ...g } })),
  addLayer: (l) => set((s) => ({ layers: [...s.layers, l] })),
  updateLayer: (id, patch) => set((s) => ({ layers: s.layers.map((L) => (L.id === id ? { ...L, ...patch } : L)) })),
  removeLayer: (id) => set((s) => ({ layers: s.layers.filter((L) => L.id !== id) })),
}))
