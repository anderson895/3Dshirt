import { useDesign } from '../store/designStore'

export default function ExportPage() {
  const { measurements, garment } = useDesign()
  // Placeholder: in a real app, render canvases to PNG and create a PDF via pdf-lib or jsPDF.
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h2 className="text-2xl font-semibold">Export</h2>
      <p className="text-gray-600">Click the buttons below to export your print files and summary PDF. (Stub)</p>
      <div className="bg-gray-50 rounded p-4">
        <h3 className="font-medium mb-2">Summary</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>Shirt size: {garment.preset ?? `${garment.custom?.widthIn || ''}×${garment.custom?.lengthIn || ''} in`}</li>
          <li>Fit: {garment.style}</li>
          <li>Measurements: H {measurements.heightCm.toFixed(0)} / C {measurements.chestCm.toFixed(0)} / W {measurements.waistCm.toFixed(0)} / S {measurements.shouldersCm.toFixed(0)} cm</li>
        </ul>
      </div>
      <div className="flex gap-2">
        <button className="px-3 py-2 rounded bg-black text-white">Download PNGs</button>
        <button className="px-3 py-2 rounded border">Download PDF</button>
      </div>
    </div>
  )
}