export type FitStatus = 'Too Tight'|'Perfect Fit'|'Too Loose'

export function computeFit(
  body: { chestCm:number; waistCm:number; shouldersCm:number },
  garment: { widthIn?: number; lengthIn?: number; sleeveIn?: number; preset?: 'S'|'M'|'L'|'XL'; style: 'fit'|'regular'|'loose' }
): { status: FitStatus; diffChest:number; diffWaist:number; diffShoulders:number } {
  // Size charts (flat width ×2 = circumference approximations). Customize for your brand.
  const chart: Record<'S'|'M'|'L'|'XL', { chestCm:number; waistCm:number; shouldersCm:number }> = {
    S:  { chestCm: 92, waistCm: 80, shouldersCm: 44 },
    M:  { chestCm: 98, waistCm: 86, shouldersCm: 46 },
    L:  { chestCm: 106, waistCm: 94, shouldersCm: 48 },
    XL: { chestCm: 114, waistCm: 102, shouldersCm: 50 },
  }
  const ease = garment.style==='fit' ? -2 : garment.style==='loose' ? 6 : 2 // cm
  const base = garment.preset ? chart[garment.preset] : {
    chestCm: (garment.widthIn??20) * 2.54 * 2 * 0.95, // lay-flat width → circumference (approx)
    waistCm: (garment.widthIn??20) * 2.54 * 2 * 0.90,
    shouldersCm: (garment.widthIn??20) * 2.54 * 0.9,
  }
  const gChest = base.chestCm + ease
  const gWaist = base.waistCm + ease
  const gShoulders = base.shouldersCm + (ease*0.3)

  const diffChest = gChest - body.chestCm
  const diffWaist = gWaist - body.waistCm
  const diffShoulders = gShoulders - body.shouldersCm

  const tooTight = diffChest < 2 || diffWaist < 2 || diffShoulders < 1
  const tooLoose = diffChest > 12 || diffWaist > 12 || diffShoulders > 5
  const status: FitStatus = tooTight ? 'Too Tight' : tooLoose ? 'Too Loose' : 'Perfect Fit'
  return { status, diffChest, diffWaist, diffShoulders }
}

// Rough body size suggestion from measurements. Client wants XXS–XXXL text label.
export function sizeLabelFromMeasurements(body: { heightCm:number; chestCm:number; waistCm:number }): 'XXS'|'XS'|'S'|'M'|'L'|'XL'|'XXL'|'XXXL' {
  // Use chest primarily; tweak by height. Tweak thresholds to taste.
  const chest = body.chestCm
  const height = body.heightCm
  const adj = height < 155 ? -1 : height > 185 ? 1 : 0
  const score = chest + adj * 3
  if (score < 84) return 'XXS'
  if (score < 90) return 'XS'
  if (score < 96) return 'S'
  if (score < 102) return 'M'
  if (score < 110) return 'L'
  if (score < 118) return 'XL'
  if (score < 126) return 'XXL'
  return 'XXXL'
}