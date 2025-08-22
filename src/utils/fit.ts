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