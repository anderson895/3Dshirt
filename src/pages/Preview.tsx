import Mannequin from '../components/Three/Mannequin'
import SceneCanvas from '../components/Three/SceneCanva'
import { useDesign } from '../store/designStore'
import { computeFit } from '../utils/fit'

export default function Preview() {
  const { measurements, garment } = useDesign()
  const fit = computeFit(measurements, garment)
  return (
    <div className="flex flex-col lg:grid lg:grid-cols-[1fr,360px] h-screen">
      <div className="bg-gray-50 h-[50vh] lg:h-full">
        <SceneCanvas>
          <Mannequin />
        </SceneCanvas>
      </div>
      <aside className="p-3 sm:p-4 space-y-3 border-t lg:border-t-0 lg:border-l h-[50vh] lg:h-full overflow-auto">
        <h2 className="font-semibold text-base sm:text-lg">Preview & Fit Feedback</h2>
        <div>
          <span className={`px-2 py-1 rounded text-xs sm:text-sm ${fit.status==='Perfect Fit'?'bg-green-100 text-green-700': fit.status==='Too Tight'?'bg-red-100 text-red-700':'bg-yellow-100 text-yellow-700'}`}>{fit.status}</span>
        </div>
        <ul className="text-xs sm:text-sm text-gray-700 space-y-1">
          <li>Chest diff: {fit.diffChest.toFixed(1)} cm</li>
          <li>Waist diff: {fit.diffWaist.toFixed(1)} cm</li>
          <li>Shoulders diff: {fit.diffShoulders.toFixed(1)} cm</li>
        </ul>
      </aside>
    </div>
  )
}