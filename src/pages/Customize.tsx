import Mannequin from '../components/Three/Mannequin'
import SceneCanvas from '../components/Three/SceneCanva'
import { useDesign } from '../store/designStore'
import { estimateMeasurementsFromMorphs } from '../utils/morphs'
import { useNavigate } from 'react-router-dom'

export default function Customize() {
  const nav = useNavigate()
  const { gender, setGender, morphs, setMorph, heightScale, setHeightScale, measurements, setMeasurements } = useDesign()

  // derive measurements on change (simple example)
  function onMorphChange(key: keyof typeof morphs, value: number) {
    setMorph(key, value)
    const m = estimateMeasurementsFromMorphs({ ...morphs, [key]: value })
    setMeasurements(m)
  }

  return (
    <div className="grid grid-cols-2 ">
      <div className="bg-gray-50 h-screen">
        <SceneCanvas>
          <Mannequin />
        </SceneCanvas>
      </div>
      <aside className="p-4 space-y-4 overflow-auto border-l">
        <div className="space-x-2">
          <button className={`px-3 py-1 rounded ${gender==='male'?'bg-black text-white':'border'}`} onClick={()=>setGender('male')}>Male</button>
          <button className={`px-3 py-1 rounded ${gender==='female'?'bg-black text-white':'border'}`} onClick={()=>setGender('female')}>Female</button>
        </div>
        <div className="space-y-3">
          {(['height','waist','shoulder','chest','arms'] as const).map(k=> (
            <label key={k} className="block text-sm">
              <div className="flex justify-between"><span>{k}</span><span>{morphs[k].toFixed(2)}</span></div>
              <input type="range" min={0} max={1} step={0.01} value={morphs[k]} onChange={(e)=>onMorphChange(k, parseFloat(e.target.value))} className="w-full"/>
            </label>
          ))}
          <label className="block text-sm">
            <div className="flex justify-between"><span>heightScale</span><span>{heightScale.toFixed(2)}</span></div>
            <input type="range" min={0.9} max={1.2} step={0.005} value={heightScale} onChange={(e)=>setHeightScale(parseFloat(e.target.value))} className="w-full"/>
          </label>
        </div>

        <div className="mt-4 text-sm">
          <h3 className="font-semibold mb-2">Measurements (est.)</h3>
          <ul className="space-y-1 text-gray-700">
            <li>Height: {measurements.heightCm.toFixed(0)} cm</li>
            <li>Chest: {measurements.chestCm.toFixed(0)} cm</li>
            <li>Waist: {measurements.waistCm.toFixed(0)} cm</li>
            <li>Shoulders: {measurements.shouldersCm.toFixed(0)} cm</li>
            <li>Sleeve: {measurements.sleeveCm.toFixed(0)} cm</li>
          </ul>
        </div>

        <button onClick={()=>nav('/design')} className="w-full mt-2 px-4 py-2 rounded bg-black text-white">Next: Design Shirt</button>
      </aside>
    </div>
  )
}