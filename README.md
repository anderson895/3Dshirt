# 3D Shirt Designer

A simple, client-friendly web app to design a T‑shirt on a 3D mannequin. You can:
- Adjust the mannequin’s body (male/female, body type, height)
- Design each shirt part (front, back, left/right sleeves)
- See instant 3D preview with lighting and shadows
- Get basic fit feedback (e.g., Too Tight / Perfect Fit / Too Loose)

### 1) Quick start
- **Requirements**: Node.js 18+ and a modern browser (Chrome, Edge, Safari).
- **Install**:
  - Open a terminal in this folder
  - Run: `npm install`
- **Start**: `npm run dev` then open the shown local URL.

Optional: `npm run build` to create a production build, `npm run preview` to preview the build.

### 2) How to use (for clients)
- From the landing page, click “Start Designing”.
- Step 1 (Customize):
  - Switch Male/Female
  - Pick a body type (Ectomorph / Endomorph / Mesomorph) and move the Intensity slider
  - Adjust Height if needed
  - Click “Next: Design Shirt”
- Step 2 (Design + Live 3D Preview):
  - Choose a part: Front, Back, Left Sleeve, Right Sleeve
  - Upload an image or add text; drag to move, scale to resize
  - Change shirt color with the color picker or quick swatches
  - The 3D preview updates instantly on the right while you design
- Step 3 (Review & Export):
  - See your mannequin with the final design
  - Read the simple fit status (Too Tight / Perfect Fit / Too Loose)
  - Download Picture (PNG): a 3D snapshot including sizes in the footer
  - Download Front/Back PNG: flat design slices from the atlas

### 3) Project structure (what’s where)
- `src/pages`
  - `Landing.tsx`: Welcome screen with CTA to start
  - `Customize.tsx`: Body adjustments (gender, body type, intensity, height)
  - `Design.tsx`: Main designer (upload images, add text, build texture atlas, live 3D preview)
  - `Preview.tsx`: Optional separate preview page with fit feedback
  - `Review.tsx`: Step 3 page combining preview, fit status, and export placeholders
  - `ExportPage.tsx`: Older placeholder (kept for reference)
- `src/components/Three`
  - `SceneCanva.tsx`: 3D scene setup (camera, lights, grid, orbit controls)
  - `Mannequin.tsx`: Loads the GLB model, applies skin/shirt/pants materials, morphs, and live textures
- `src/store/designStore.ts`: Central app state using Zustand (gender, body type, measurements, layers, shirt texture canvas, etc.)
- `src/utils`
  - `morphs.ts`: Estimates basic body measurements from sliders
  - `fit.ts`: Computes a simple fit label from measurements and size preset
  - `modelInspector.ts`: Dev helper to log available morph targets in the model

### 4) How the 3D preview works (plain language)
- The shirt design is edited per part on simple 2D canvases (front/back/sleeves).
- Those canvases are combined into one big “texture atlas”.
- The mannequin’s shirt uses that atlas as its material map. When you change the design, we refresh the atlas, and the 3D shirt updates instantly.
- Lighting, shadows, and camera controls are handled by the 3D scene for a realistic look.

### 5) Notes and limits
- Export buttons are placeholders; production apps typically render each part to PNG and assemble a PDF.
- Size/fit math is intentionally simple for demo purposes and should be calibrated to your brand’s size chart for real orders.
- GLB models are preloaded from `/models/malev3.glb` and `/models/female.glb`.

### 6) Tech stack
- React + TypeScript + Vite
- React Three Fiber + Drei + Three.js
- Zustand state management
- Tailwind CSS for styling

### 7) Common questions
- “Can I use my own size chart?” — Yes. Update `src/utils/fit.ts` with your measurements.
- “Can I export print‑ready files?” — Add the PNG/PDF logic in `ExportPage.tsx` (e.g., `canvas.toDataURL()`, `pdf-lib/jsPDF`).
- “Can I change the mannequin?” — Replace the GLB files and, if needed, adjust mesh name matching in `Mannequin.tsx`.
