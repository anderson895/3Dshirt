import Mannequin from '../components/Three/Mannequin'
import SceneCanvas from '../components/Three/SceneCanva'
import { useDesign } from '../store/designStore'
import { estimateMeasurementsFromMorphs } from '../utils/morphs'
import { sizeLabelFromMeasurements } from '../utils/fit'
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
    setMeasurements,
    skinColor,
    setSkinColor
  } = useDesign()

  const setIntensityClamped = (v: number) => setBodyTypeIntensity(Math.min(1, Math.max(0, v)))

  // Height in centimeters UX (maps to 3D scale with a 175 cm baseline)
  // Client asks for 130–200 cm safe range
  const BASE_HEIGHT_CM = 175
  const clampScale = (s: number) => Math.max(130/BASE_HEIGHT_CM, Math.min(200/BASE_HEIGHT_CM, s))
  const setHeightCm = (cm: number) => {
    const scale = clampScale(cm / BASE_HEIGHT_CM)
    setHeightScale(+scale.toFixed(2))
    setMeasurements({ heightCm: Math.round(cm) })
  }

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
          <Mannequin showClothes={true} />
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
            <p className="text-xs text-gray-500">Pick a body type and fine‑tune the size. Clothes are visible for preview.</p>
          </div>
        </header>
        
        {/* Gender Selection */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Gender</h3>
          <div className="grid grid-cols-2 gap-2">
            {([
              {id:'male', title:'Male', sub:'Masculine build'},
              {id:'female', title:'Female', sub:'Feminine build'}
            ] as const).map(opt => (
              <button
                key={opt.id}
                onClick={()=>setGender(opt.id)}
                className={`text-left p-2 rounded border transition hover:border-gray-400 ${gender===opt.id ? 'border-blue-600 ring-2 ring-blue-200' : 'border-gray-200'}`}
              >
                <div className={`text-[13px] font-medium ${gender===opt.id ? 'text-blue-700' : 'text-gray-800'}`}>{opt.title}</div>
                <div className="text-[11px] text-gray-500">{opt.sub}</div>
              </button>
            ))}
          </div>
        </div>
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
          
        {/* Body Type Intensity (in centimeters) */}
        <div className="space-y-2">
          {(() => {
            const MAX_DELTA_CM = 15
            const cm = Math.round(bodyTypeIntensity * MAX_DELTA_CM)
            const labelByType = bodyType === 'ectomorph'
              ? `Slimness (${cm} cm)`
              : bodyType === 'endomorph'
                ? `Fullness (${cm} cm)`
                : `Athletic build (${cm} cm)`
            return (
              <label className="block text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span>{labelByType}</span>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-2 py-0.5 border rounded text-xs"
                      onClick={()=>setIntensityClamped(Math.max(0, bodyTypeIntensity - 1/MAX_DELTA_CM))}
                    >-</button>
                    <span className="tabular-nums text-xs w-24 text-right">{cm} cm</span>
                    <button
                      className="px-2 py-0.5 border rounded text-xs"
                      onClick={()=>setIntensityClamped(Math.min(1, bodyTypeIntensity + 1/MAX_DELTA_CM))}
                    >+</button>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={MAX_DELTA_CM}
                  step={1}
                  value={cm}
                  onChange={(e)=>{
                    const v = Math.max(0, Math.min(MAX_DELTA_CM, parseInt(e.target.value,10)))
                    setIntensityClamped(v / MAX_DELTA_CM)
                  }}
                  className="w-full"
                />
                <div className="flex items-center gap-2 mt-2">
                  {[0,5,10,15].map(v=> (
                    <button key={v} className="px-2 py-0.5 border rounded text-xs" onClick={()=>setIntensityClamped(v/MAX_DELTA_CM)}>{v} cm</button>
                  ))}
                  <button className="ml-auto px-2 py-0.5 border rounded text-xs" onClick={()=>setIntensityClamped(0)}>Reset</button>
                </div>
                <div className="text-[11px] text-gray-500 mt-1">Internally mapped to intensity {bodyTypeIntensity.toFixed(3)}</div>
              </label>
            )
          })()}
        </div>
        </div>

        {/* Additional Controls */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Additional Adjustments</h3>
          {/* Skin Color */}
          <label className="block text-sm">
            <div className="flex items-center justify-between mb-1">
              <span>Skin Color</span>
              <input
                type="color"
                value={skinColor}
                onChange={(e)=>setSkinColor(e.target.value)}
                className="w-10 h-6 p-0 border rounded overflow-hidden"
                title="Pick skin color"
              />
            </div>
            <div className="flex items-center gap-2">
              {["#e6c8b5","#d8a48f","#b67f5f","#8d5a3b","#603d22","#3a2616"].map(hex => (
                <button key={hex} className="w-6 h-6 rounded border" style={{ backgroundColor: hex }} onClick={()=>setSkinColor(hex)} />
              ))}
              <span className="ml-2 text-[11px] text-gray-500">{skinColor}</span>
            </div>
          </label>
          <label className="block text-sm">
            <div className="flex items-center justify-between mb-1">
              <span>Height (cm)</span>
              <div className="flex items-center gap-2">
                <button className="px-2 py-0.5 border rounded text-xs" onClick={()=>setHeightCm((measurements.heightCm||BASE_HEIGHT_CM)-1)}>-</button>
                <span className="tabular-nums text-xs w-24 text-right">{(measurements.heightCm||BASE_HEIGHT_CM)} cm</span>
                <button className="px-2 py-0.5 border rounded text-xs" onClick={()=>setHeightCm((measurements.heightCm||BASE_HEIGHT_CM)+1)}>+</button>
              </div>
            </div>
            <input
              type="range"
              min={130}
              max={200}
              step={1}
              value={measurements.heightCm}
              onChange={(e)=>setHeightCm(parseInt(e.target.value,10))}
              className="w-full"
            />
            <div className="flex items-center gap-2 mt-2">
              {[160,170,175,180,190].map(v=> (
                <button key={v} className="px-2 py-0.5 border rounded text-xs" onClick={()=>setHeightCm(v)}>{v} cm</button>
              ))}
              <button className="ml-auto px-2 py-0.5 border rounded text-xs" onClick={()=>{ setHeightCm(BASE_HEIGHT_CM) }}>Reset</button>
            </div>
            <div className="text-[11px] text-gray-500 mt-1">Scale: {heightScale.toFixed(2)}× (baseline {BASE_HEIGHT_CM} cm)</div>
          </label>
        </div>

        {/* Direct measurements (cm) */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Measurements (cm)</h3>
          <div className="grid grid-cols-2 gap-4">
            {/* Chest */}
            <label className="block text-sm">
              <div className="flex items-center justify-between mb-1">
                <span>Chest</span>
                <span className="tabular-nums text-xs">{measurements.chestCm.toFixed(0)} cm</span>
              </div>
              <input
                type="range"
                min={85}
                max={110}
                step={1}
                value={measurements.chestCm}
                onChange={(e)=>{
                  const cm = parseInt(e.target.value,10)
                  // invert mapping from utils/morphs.ts
                  const intensity = Math.max(0, Math.min(1, (cm - 85) / 25))
                  onMorphChange('chest', intensity)
                }}
                className="w-full"
              />
            </label>

            {/* Waist */}
            <label className="block text-sm">
              <div className="flex items-center justify-between mb-1">
                <span>Waist</span>
                <span className="tabular-nums text-xs">{measurements.waistCm.toFixed(0)} cm</span>
              </div>
              <input
                type="range"
                min={70}
                max={95}
                step={1}
                value={measurements.waistCm}
                onChange={(e)=>{
                  const cm = parseInt(e.target.value,10)
                  const intensity = Math.max(0, Math.min(1, (cm - 70) / 25))
                  onMorphChange('waist', intensity)
                }}
                className="w-full"
              />
            </label>

            {/* Shoulders */}
            <label className="block text-sm">
              <div className="flex items-center justify-between mb-1">
                <span>Shoulders</span>
                <span className="tabular-nums text-xs">{measurements.shouldersCm.toFixed(0)} cm</span>
              </div>
              <input
                type="range"
                min={40}
                max={52}
                step={1}
                value={measurements.shouldersCm}
                onChange={(e)=>{
                  const cm = parseInt(e.target.value,10)
                  const intensity = Math.max(0, Math.min(1, (cm - 40) / 12))
                  onMorphChange('shoulder', intensity)
                }}
                className="w-full"
              />
            </label>

            {/* Arms (sleeve length) */}
            <label className="block text-sm">
              <div className="flex items-center justify-between mb-1">
                <span>Arms</span>
                <span className="tabular-nums text-xs">{measurements.sleeveCm.toFixed(0)} cm</span>
              </div>
              <input
                type="range"
                min={55}
                max={63}
                step={1}
                value={measurements.sleeveCm}
                onChange={(e)=>{
                  const cm = parseInt(e.target.value,10)
                  const intensity = Math.max(0, Math.min(1, (cm - 55) / 8))
                  onMorphChange('arms', intensity)
                }}
                className="w-full"
              />
            </label>
          </div>
          <p className="text-[11px] text-gray-500">These controls change the body by centimeters and map internally to model morphs.</p>
        </div>

        <div className="mt-4 text-sm">
          <h3 className="font-semibold mb-2">Measurements (est.)</h3>
          <ul className="space-y-1 text-gray-700">
            <li>Height: {measurements.heightCm.toFixed(0)} cm</li>
            <li>Chest: {measurements.chestCm.toFixed(0)} cm</li>
            <li>Waist: {measurements.waistCm.toFixed(0)} cm</li>
            <li>Shoulders: {measurements.shouldersCm.toFixed(0)} cm</li>
            <li>Sleeve: {measurements.sleeveCm.toFixed(0)} cm</li>
            <li>Body size: <span className="font-semibold">{sizeLabelFromMeasurements({ heightCm: measurements.heightCm, chestCm: measurements.chestCm, waistCm: measurements.waistCm })}</span></li>
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