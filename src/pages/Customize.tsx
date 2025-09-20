import Mannequin from '../components/Three/Mannequin'
import SceneCanvas from '../components/Three/SceneCanva'
import { useDesign } from '../store/designStore'
import { estimateMeasurementsFromMorphs } from '../utils/morphs'
import { useNavigate } from 'react-router-dom'

export default function Customize() {
  const nav = useNavigate()
  const { 
    gender, 
    setGender, 
    bodyType, 
    setBodyType, 
    bodyTypeIntensity, 
    setBodyTypeIntensity,
    morphs, 
    setMorph, 
    heightScale, 
    setHeightScale, 
    measurements, 
    setMeasurements 
  } = useDesign()

  const setIntensityClamped = (v: number) => setBodyTypeIntensity(Math.min(1, Math.max(0, v)))

  // derive measurements on change (simple example)
  function onMorphChange(key: keyof typeof morphs, value: number) {
    console.log(`🎚️ Slider changed: ${key} = ${value}`);
    setMorph(key, value)
    const m = estimateMeasurementsFromMorphs({ ...morphs, [key]: value })
    setMeasurements(m)
  }

  // Handle body type selection with preset intensity values
  function handleBodyTypeSelection(selectedBodyType: 'ectomorph' | 'endomorph' | 'mesomorph') {
    console.log(`🏃 Body type changed: ${bodyType} → ${selectedBodyType}`);
    setBodyType(selectedBodyType);
    
    // Set preset intensity values based on body type
    const presetIntensities = {
      ectomorph: 0.0,  // Start with normal body size
      endomorph: 0.0,  // Start with normal body size
      mesomorph: 0.0,  // Start with normal body size
    };
    
    const intensity = presetIntensities[selectedBodyType];
    setBodyTypeIntensity(intensity);
    console.log(`📊 Set intensity to ${intensity} for ${selectedBodyType}`);
  }

  return (
    <div className="grid grid-cols-2 ">
      <div className="relative bg-gray-50 h-screen">
        <SceneCanvas>
          <Mannequin showClothes={false} />
        </SceneCanvas>
        {/* Controls hint overlay */}
        <div className="pointer-events-none absolute left-3 top-3 text-[11px] text-white/90">
          <div className="rounded bg-black/40 backdrop-blur px-2 py-1 border border-white/10">
            Drag to orbit • Scroll to zoom
          </div>
        </div>
      </div>
      <aside className="p-5 space-y-4 overflow-auto border-l bg-white">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">Step 1 · Adjust Body</h2>
            <p className="text-xs text-gray-500">Pick a body type and fine‑tune the size. Clothes are hidden for clarity.</p>
          </div>
          <div className="inline-flex rounded border overflow-hidden">
            <button className={`px-3 py-1 text-sm ${gender==='male'?'bg-black text-white':'bg-white'}`} onClick={()=>setGender('male')}>Male</button>
            <button className={`px-3 py-1 text-sm ${gender==='female'?'bg-black text-white':'bg-white'}`} onClick={()=>setGender('female')}>Female</button>
          </div>
        </header>
        {/* Body Type Selection */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Body Type</h3>
          <div className="grid grid-cols-3 gap-2">
            {([
              {id:'ectomorph', title:'Ectomorph', sub:'Slim & Lean'},
              {id:'endomorph', title:'Endomorph', sub:'Round & Soft'},
              {id:'mesomorph', title:'Mesomorph', sub:'Athletic'}
            ] as const).map(opt => (
              <button
                key={opt.id}
                onClick={()=>handleBodyTypeSelection(opt.id)}
                className={`text-left p-2 rounded border transition hover:border-gray-400 ${bodyType===opt.id ? 'border-blue-600 ring-2 ring-blue-200' : 'border-gray-200'}`}
              >
                <div className={`text-[13px] font-medium ${bodyType===opt.id ? 'text-blue-700' : 'text-gray-800'}`}>{opt.title}</div>
                <div className="text-[11px] text-gray-500">{opt.sub}</div>
              </button>
            ))}
          </div>
          
          {/* Body Type Intensity Slider */}
          <div className="space-y-2">
            <label className="block text-sm">
              <div className="flex items-center justify-between mb-1">
                <span>Intensity ({bodyType})</span>
                <div className="flex items-center gap-2">
                  <button className="px-2 py-0.5 border rounded text-xs" onClick={()=>setIntensityClamped(bodyTypeIntensity-0.05)}>-</button>
                  <span className="tabular-nums text-xs w-14 text-right">{bodyTypeIntensity.toFixed(3)}</span>
                  <button className="px-2 py-0.5 border rounded text-xs" onClick={()=>setIntensityClamped(bodyTypeIntensity+0.05)}>+</button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.001}
                value={bodyTypeIntensity}
                onChange={(e)=>setIntensityClamped(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex items-center gap-2 mt-2">
                {[0,0.25,0.5,0.75,1].map(v=> (
                  <button key={v} className="px-2 py-0.5 border rounded text-xs" onClick={()=>setIntensityClamped(v)}>{v}</button>
                ))}
                <button className="ml-auto px-2 py-0.5 border rounded text-xs" onClick={()=>setIntensityClamped(0)}>Reset</button>
              </div>
            </label>
          </div>
        </div>

        {/* Additional Controls */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Additional Adjustments</h3>
          <label className="block text-sm">
            <div className="flex items-center justify-between mb-1">
              <span>Height</span>
              <div className="flex items-center gap-2">
                <button className="px-2 py-0.5 border rounded text-xs" onClick={()=>setHeightScale(Math.max(0.9, +(heightScale-0.01).toFixed(2)))}>-</button>
                <span className="tabular-nums text-xs w-12 text-right">{heightScale.toFixed(2)}×</span>
                <button className="px-2 py-0.5 border rounded text-xs" onClick={()=>setHeightScale(Math.min(1.2, +(heightScale+0.01).toFixed(2)))}>+</button>
              </div>
            </div>
            <input type="range" min={0.9} max={1.2} step={0.005} value={heightScale} onChange={(e)=>{
              const value = parseFloat(e.target.value);
              setHeightScale(value);
            }} className="w-full"/>
            <div className="flex items-center gap-2 mt-2">
              {[0.95,1.00,1.05,1.10,1.15].map(v=> (
                <button key={v} className="px-2 py-0.5 border rounded text-xs" onClick={()=>setHeightScale(v)}>{v.toFixed(2)}×</button>
              ))}
              <button className="ml-auto px-2 py-0.5 border rounded text-xs" onClick={()=>setHeightScale(1.0)}>Reset</button>
            </div>
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
        {/* Sticky footer CTA */}
        <div className="sticky bottom-0 bg-white pt-2">
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 border rounded text-sm" onClick={()=>{ setIntensityClamped(0); setHeightScale(1.0); }}>Reset All</button>
            <button onClick={()=>nav('/design')} className="flex-1 px-4 py-2 rounded bg-black text-white">Next: Design Shirt</button>
          </div>
        </div>
      </aside>
    </div>
  )
}