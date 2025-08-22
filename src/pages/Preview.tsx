import Mannequin from '../components/Three/Mannequin'
import SceneCanvas from '../components/Three/SceneCanva'
import { useDesign } from '../store/designStore'
import { computeFit } from '../utils/fit'

export default function Preview() {
  const { measurements, garment } = useDesign()
  const fit = computeFit(measurements, garment)
  return (
    <div className="grid md:grid-cols-[1fr,360px] h-[calc(100vh-56px)]">
      <div className="bg-gray-50">
        <SceneCanvas>
          <Mannequin />
        </SceneCanvas>
      </div>
      <aside className="p-4 space-y-3 border-l">
        <h2 className="font-semibold">Preview & Fit Feedback</h2>
        <div>
          <span className={`px-2 py-1 rounded ${fit.status==='Perfect Fit'?'bg-green-100 text-green-700': fit.status==='Too Tight'?'bg-red-100 text-red-700':'bg-yellow-100 text-yellow-700'}`}>{fit.status}</span>
        </div>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>Chest diff: {fit.diffChest.toFixed(1)} cm</li>
          <li>Waist diff: {fit.diffWaist.toFixed(1)} cm</li>
          <li>Shoulders diff: {fit.diffShoulders.toFixed(1)} cm</li>
        </ul>
      </aside>
    </div>
  )
}