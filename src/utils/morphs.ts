import * as THREE from 'three'

export function setMorphByName(mesh: THREE.SkinnedMesh, name: string, value: number) {
  const dict = mesh.morphTargetDictionary as Record<string, number> | undefined
  const infl = mesh.morphTargetInfluences as number[] | undefined
  if (!dict || !infl) return
  const idx = dict[name]
  if (idx !== undefined) infl[idx] = THREE.MathUtils.clamp(value, 0, 1)
}

// VERY rough measurement estimation; replace with your calibrated mapping.
export function estimateMeasurementsFromMorphs(morphs: {height:number; waist:number; shoulder:number; chest:number; arms:number}): {
  heightCm: number; chestCm: number; waistCm: number; shouldersCm: number; sleeveCm: number
} {
  const heightCm = 160 + morphs.height * 30 // 160–190
  const chestCm = 85 + morphs.chest * 25
  const waistCm = 70 + morphs.waist * 25
  const shouldersCm = 40 + morphs.shoulder * 12
  const sleeveCm = 55 + morphs.arms * 8
  return { heightCm, chestCm, waistCm, shouldersCm, sleeveCm }
}