/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* components/Three/Mannequin.tsx */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import { useDesign } from "../../store/designStore";
import type { UVRects } from "../../store/designStore";
import { inspectModelMorphs } from "../../utils/modelInspector";

type GLTFScene = { scene: THREE.Group };

// ──────────────────────────────────────────────────────────────────────────────
// Name heuristics
// ──────────────────────────────────────────────────────────────────────────────
const SKIN_INCLUDE =
  /(body|skin|head|face|neck|torso|arm|forearm|hand|leg|thigh|calf|foot|toe|ear)/i;
const SKIN_EXCLUDE =
  /(shirt|short|pant|jean|trouser|cloth|garment|hair|brow|lash|eye|iris|pupil|teeth|tongue|gum|mouth|cap|hat|sock|shoe)/i;

const PANTS_INCLUDE =
  /(pant|pants|trouser|jean|denim|short|bottom|lower|legwear)/i;
const PANTS_EXCLUDE =
  /(shirt|upper|top|dress|skirt|hood|sleeve|sock|shoe|boot)/i;

// ──────────────────────────────────────────────────────────────────────────────
// Debug helpers
// ──────────────────────────────────────────────────────────────────────────────
const DEBUG = true;
function gStart(title: string, style = "color:#0b6; font-weight:600;") {
  if (DEBUG) console.groupCollapsed(`%c${title}`, style);
}
function gEnd() {
  if (DEBUG) console.groupEnd();
}
function info(title: string, payload?: any) {
  if (DEBUG)
    payload !== undefined ? console.info(title, payload) : console.info(title);
}
function warn(title: string, payload?: any) {
  if (DEBUG)
    payload !== undefined ? console.warn(title, payload) : console.warn(title);
}

// ──────────────────────────────────────────────────────────────────────────────
/** Type/mesh utils */
// ──────────────────────────────────────────────────────────────────────────────
function isRenderableMesh(
  o: THREE.Object3D
): o is THREE.Mesh | THREE.SkinnedMesh {
  return (o as any).isMesh || (o as any).isSkinnedMesh;
}

function materialName(
  mat: THREE.Material | THREE.Material[] | null | undefined
) {
  if (!mat) return "(no material)";
  if (Array.isArray(mat))
    return mat.map((m) => m.name || (m as any).type || "Material").join(", ");
  return mat.name || (mat as any).type || "Material";
}

function ensureUniqueMaterial(mesh: THREE.Mesh | THREE.SkinnedMesh) {
  if (!mesh.material) return;
  mesh.material = Array.isArray(mesh.material)
    ? mesh.material.map((m) => m.clone())
    : mesh.material.clone();
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mats.forEach((m) => ((m as any).needsUpdate = true));
}

// Preserve deform-related shader flags when assigning/tinting materials
function adoptDeformFlags(
  mesh: THREE.Mesh | THREE.SkinnedMesh,
  mat: THREE.Material
) {
  const std = mat as THREE.MeshStandardMaterial;
  if ((std as any).isMeshStandardMaterial) {
    (std as any).skinning = (mesh as any).isSkinnedMesh || (std as any).skinning;
    (std as any).morphTargets = !!(mesh as any).morphTargetDictionary || (std as any).morphTargets;
    const hasMorphNormals = !!((mesh.geometry as THREE.BufferGeometry).morphAttributes?.normal?.length);
    (std as any).morphNormals = hasMorphNormals || (std as any).morphNormals;
    (std as any).needsUpdate = true;
  }
}

// Nudge cloth in front of body to avoid z-fighting, while keeping depth testing
function setClothOverlayBias(mesh: THREE.Mesh | THREE.SkinnedMesh, mat: THREE.Material) {
  const std = mat as THREE.MeshStandardMaterial;
  if ((std as any).isMeshStandardMaterial) {
    std.polygonOffset = true;
    std.polygonOffsetFactor = -2; // pull a touch towards camera
    std.polygonOffsetUnits = -2;
    adoptDeformFlags(mesh, std);
    std.needsUpdate = true;
  }
}

function nameWithMaterial(o: THREE.Mesh | THREE.SkinnedMesh) {
  return `${o.name || ""} ${materialName(o.material)}`.trim();
}

function findMeshByName(root: THREE.Object3D, matcher: RegExp) {
  let hit: (THREE.Mesh | THREE.SkinnedMesh) | null = null;
  root.traverse((o) => {
    if (!hit && isRenderableMesh(o) && matcher.test(o.name || "")) hit = o;
  });
  return hit;
}
// (removed unused findLargestMesh)

// (removed unused setMorphByNameSafe)

function applyColor(
  material: THREE.Material | THREE.Material[] | null | undefined,
  color: string
) {
  if (!material) return;
  const set = (m: THREE.Material) => {
    const std = m as THREE.MeshStandardMaterial;
    if ((std as any).isMeshStandardMaterial) {
      std.color = new THREE.Color(color);
      std.needsUpdate = true;
    }
  };
  if (Array.isArray(material)) material.forEach(set);
  else set(material);
}

function findMeshesByHeuristics(
  root: THREE.Object3D,
  include: RegExp,
  exclude: RegExp
) {
  const hits: Array<THREE.Mesh | THREE.SkinnedMesh> = [];
  root.traverse((o) => {
    if (!isRenderableMesh(o)) return;
    const nm = nameWithMaterial(o);
    if (include.test(nm) && !exclude.test(nm)) hits.push(o);
  });
  return hits;
}

// ──────────────────────────────────────────────────────────────────────────────
// Morph selection helpers (avoid driving duplicate channels like endomorph.001)
// ──────────────────────────────────────────────────────────────────────────────
function pickBestMorph(keys: string[], exactName: string, altRegex: RegExp): string | null {
  const exact = keys.find((n) => n.toLowerCase() === exactName);
  if (exact) return exact;
  // Prefer non-suffixed numbered variant first (e.g., 'endomorph' over 'endomorph.001')
  const numbered = keys.filter((n) => new RegExp(`^${exactName}(?:\\.\\d+)?$`, 'i').test(n));
  if (numbered.length) {
    const noSuffix = numbered.find((n) => !/\.\d+$/.test(n));
    return noSuffix ?? numbered.sort()[0];
  }
  const alt = keys.find((n) => altRegex.test(n));
  return alt ?? null;
}

// ──────────────────────────────────────────────────────────────────────────────
/** Reporting / overview */
// ──────────────────────────────────────────────────────────────────────────────
function listEditableParts(root: THREE.Object3D) {
  const morphTargets: Array<{ mesh: string; morphs: string[] }> = [];
  const bones: string[] = [];
  const colorables: Array<{ mesh: string; material: string }> = [];
  const meshes: Array<{
    name: string;
    type: string;
    tri: number;
    hasMorphs: boolean;
    materialCount: number;
  }> = [];

  root.traverse((o) => {
    if ((o as any).isBone || o.type === "Bone")
      bones.push(o.name || "(unnamed)");
    if (isRenderableMesh(o)) {
      const geom = o.geometry as THREE.BufferGeometry;
      const tri = Math.floor(
        (geom.getIndex()?.count ?? geom.attributes.position?.count ?? 0) / 3
      );
      const hasMorphs = !!(o as any as THREE.SkinnedMesh).morphTargetDictionary;
      const mat = o.material;
      const materialCount = Array.isArray(mat) ? mat.length : mat ? 1 : 0;
      meshes.push({
        name: o.name || "(unnamed)",
        type: (o as any).isSkinnedMesh ? "SkinnedMesh" : "Mesh",
        tri,
        hasMorphs,
        materialCount,
      });
      const sk = o as THREE.SkinnedMesh;
      if (sk.morphTargetDictionary)
        morphTargets.push({
          mesh: o.name || "(unnamed)",
          morphs: Object.keys(sk.morphTargetDictionary),
        });
      const addColorables = (m: THREE.Material | null | undefined) => {
        if (!m) return;
        const std = m as THREE.MeshStandardMaterial;
        const hasColor =
          (std as any).isMeshStandardMaterial &&
          std.color instanceof THREE.Color;
        if (hasColor)
          colorables.push({
            mesh: o.name || "(unnamed)",
            material: m.name || std.type,
          });
      };
      if (Array.isArray(mat)) mat.forEach(addColorables);
      else addColorables(mat as THREE.Material);
    }
  });

  gStart("🧩 Mannequin: Editable Parts Overview");
  gStart("🎭 Morph Targets (by Mesh)");
  morphTargets.forEach((row) => {
    gStart(row.mesh);
    console.table(row.morphs.map((n) => ({ morph: n })));
    gEnd();
  });
  gEnd();
  gStart("🦴 Bones");
  console.table(bones.map((b) => ({ bone: b })));
  gEnd();
  gStart("🎨 Color-editable Materials");
  console.table(colorables);
  gEnd();
  gStart("🧱 Meshes Summary");
  console.table(meshes);
  gEnd();
  gEnd();
  return { morphTargets, bones, colorables, meshes };
}

// ──────────────────────────────────────────────────────────────────────────────
// Domain-specific: SKIN & PANTS material application
// ──────────────────────────────────────────────────────────────────────────────

// (removed unused getFirstColorableMaterial helper)

// NEW: colorize skin by REUSING the 'human' material instance everywhere
function colorizeSkin(root: THREE.Object3D, color: string) {
  const targets = findMeshesByHeuristics(root, SKIN_INCLUDE, SKIN_EXCLUDE) as (THREE.Mesh | THREE.SkinnedMesh)[];
  if (!targets.length) {
    warn("No SKIN-like meshes detected.");
    return;
  }

  gStart("🧴 Apply Skin Material (per-mesh clones, keeping deform flags)");
  info("Skin meshes", targets.map((m) => m.name));

    for (const mesh of targets) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const newMats = mats.map((m) => {
      const std = (m as THREE.MeshStandardMaterial).clone();
          std.color.set(color);
          std.metalness = 0.0;
          std.roughness = 0.65;
      adoptDeformFlags(mesh, std);
      return std;
    });
    mesh.material = Array.isArray(mesh.material) ? newMats : newMats[0];
  }
  gEnd();
}

// (helper inlined in the effect below to reduce bundle size)

type PantsOpts = {
  color?: string;
  canvas?: HTMLCanvasElement | null;
  stamp?: number; // any changing number to flag updates
};

function applyPantsMaterial(
  root: THREE.Object3D,
  opts: PantsOpts,
  ref: React.MutableRefObject<THREE.CanvasTexture | null>
) {
  const { color = "#444444", canvas, stamp } = opts;
  const pants = findMeshesByHeuristics(root, PANTS_INCLUDE, PANTS_EXCLUDE);
  if (!pants.length) {
    warn("No PANTS-like meshes detected.");
    return;
  }

  if (canvas) {
    if (!ref.current) {
      ref.current = new THREE.CanvasTexture(canvas);
      ref.current.flipY = false;
      (ref.current as any).colorSpace = (THREE as any).SRGBColorSpace ?? undefined;
      ref.current.needsUpdate = true;
    }
    if (stamp !== undefined) ref.current!.needsUpdate = true;

    gStart("👖 Apply PANTS CanvasTexture");
    info("Pants Meshes", pants.map((p) => p.name));
    info("Atlas", { w: canvas.width, h: canvas.height });
    for (const mesh of pants) {
      ensureUniqueMaterial(mesh);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        const std = m as THREE.MeshStandardMaterial;
        std.map = ref.current!;
        std.color.set("#ffffff");
        std.metalness = 0.0;
        std.roughness = 0.8;
        adoptDeformFlags(mesh as any, std);
        std.needsUpdate = true;
      });
    }
    gEnd();
  } else {
    gStart("👖 Apply PANTS Flat Color");
    info("Pants Meshes", pants.map((p) => p.name));
    info("Color", color);
    for (const mesh of pants) {
      ensureUniqueMaterial(mesh);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        const std = m as THREE.MeshStandardMaterial;
        std.map = null;
        std.color.set(color);
        std.metalness = 0.05;
        std.roughness = 0.85;
        adoptDeformFlags(mesh as any, std);
        std.needsUpdate = true;
      });
    }
    gEnd();
  }
}

// ──────────────────────────────────────────────────────────────────────────────
/** UV helpers */
// ──────────────────────────────────────────────────────────────────────────────
function expand(
  b: { minU: number; minV: number; maxU: number; maxV: number },
  u: number,
  v: number
) {
  if (u < b.minU) b.minU = u;
  if (v < b.minV) b.minV = v;
  if (u > b.maxU) b.maxU = u;
  if (v > b.maxV) b.maxV = v;
}

// ──────────────────────────────────────────────────────────────────────────────
/** Component */
// ──────────────────────────────────────────────────────────────────────────────
export default function Mannequin({ showClothes = true }: { showClothes?: boolean }) {
  // Known fields from your store
  const {
    gender,
    heightScale,
    baseColor,
    shirtTexCanvas,
    shirtTexStamp,
    setUVRects,
    bodyType,
    bodyTypeIntensity,
    garment,
  } = useDesign();

  // Optional fields (if present in store)
  const designAny = useDesign() as any;
  const skinColor: string = designAny.skinColor ?? "#e6c8b5";
  const pantsColor: string | undefined = designAny.pantsColor;
  const pantsTexCanvas: HTMLCanvasElement | null = designAny.pantsTexCanvas ?? null;
  const pantsTexStamp: number | undefined = designAny.pantsTexStamp;

  const url = gender === "male" ? "/models/malev3.glb" : "/models/female.glb";
  const { scene } = useGLTF(url) as unknown as GLTFScene;
  const cloned = useMemo<THREE.Group>(
    () => SkeletonUtils.clone(scene) as THREE.Group,
    [scene]
  );

  // Persistent CanvasTextures
  const shirtTexRef = useRef<THREE.CanvasTexture | null>(null);
  const pantsTexRef = useRef<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    if (!cloned) return;
    cloned.traverse((o) => {
      const isMesh = (o as any).isMesh || (o as any).isSkinnedMesh;
      if (isMesh) {
        const m = o as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
  }, [cloned]);

  useEffect(() => {
    if (cloned) {
      listEditableParts(cloned);
      inspectModelMorphs(cloned);
    }
  }, [cloned]);

  // Toggle clothing visibility
  useEffect(() => {
    if (!cloned) return;
    // Shirt
    const tshirt =
      findMeshByName(cloned, /^t[-\s_]?shirt$/i) ||
      findMeshByName(cloned, /upper|top/i);
    if (tshirt) (tshirt as THREE.Mesh).visible = showClothes;
    // Pants
    const pants = findMeshesByHeuristics(cloned, PANTS_INCLUDE, PANTS_EXCLUDE);
    pants.forEach((p) => (p.visible = showClothes));
  }, [cloned, showClothes]);

  // Apply shared skin material from 'human'
  useEffect(() => {
    if (!cloned) return;
    colorizeSkin(cloned, skinColor);
  }, [cloned, skinColor]);

  // Compute UV rects (shirt)
  useEffect(() => {
    if (!cloned) return;
    if (!showClothes) return; // skip when clothes hidden
    const tshirt =
      findMeshByName(cloned, /^t[-\s_]?shirt$/i) ||
      findMeshByName(cloned, /upper|top/i);
    if (!tshirt) return;
    const geom = (tshirt as THREE.Mesh).geometry as THREE.BufferGeometry;
    const uv = geom.attributes.uv as THREE.BufferAttribute | undefined;
    if (!uv) return;

    const Q = {
      TL: { minU: 1, minV: 1, maxU: 0, maxV: 0 },
      TR: { minU: 1, minV: 1, maxU: 0, maxV: 0 },
      BL: { minU: 1, minV: 1, maxU: 0, maxV: 0 },
      BR: { minU: 1, minV: 1, maxU: 0, maxV: 0 },
    } as const;

    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      const v = 1 - uv.getY(i);
      const col = u < 0.5 ? "L" : "R";
      const row = v < 0.5 ? "T" : "B";
      expand(Q[(row + col) as "TL" | "TR" | "BL" | "BR"], u, v);
    }

    const bleed = 0.005;
    const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
    const rects: UVRects = {
      front: {
        x: clamp01(Q.TL.minU - bleed),
        y: clamp01(Q.TL.minV - bleed),
        w: clamp01(Q.TL.maxU - Q.TL.minU + 2 * bleed),
        h: clamp01(Q.TL.maxV - Q.TL.minV + 2 * bleed),
      },
      back: {
        x: clamp01(Q.TR.minU - bleed),
        y: clamp01(Q.TR.minV - bleed),
        w: clamp01(Q.TR.maxU - Q.TR.minU + 2 * bleed),
        h: clamp01(Q.TR.maxV - Q.TR.minV + 2 * bleed),
      },
      sleeveL: {
        x: clamp01(Q.BL.minU - bleed),
        y: clamp01(Q.BL.minV - bleed),
        w: clamp01(Q.BL.maxU - Q.BL.minU + 2 * bleed),
        h: clamp01(Q.BL.maxV - Q.BL.minV + 2 * bleed),
      },
      sleeveR: {
        x: clamp01(Q.BR.minU - bleed),
        y: clamp01(Q.BR.minV - bleed),
        w: clamp01(Q.BR.maxU - Q.BR.minU + 2 * bleed),
        h: clamp01(Q.BR.maxV - Q.BR.minV + 2 * bleed),
      },
    };
    info("📐 UV rects (normalized)", rects);
    setUVRects(rects);
  }, [cloned, setUVRects, showClothes]);

  // Base shirt color when NO custom shirt texture is active
  useEffect(() => {
    if (!cloned || shirtTexCanvas) return;
    if (!showClothes) return; // skip when clothes hidden
    const tshirt =
      findMeshByName(cloned, /^t[-\s_]?shirt$/i) ||
      findMeshByName(cloned, /upper|top/i);
    if (!tshirt) {
      warn("No shirt mesh found for base color.");
      return;
    }

    const shirtMesh = tshirt as THREE.Mesh | THREE.SkinnedMesh;
    ensureUniqueMaterial(shirtMesh);
    gStart("🎨 Apply Base Color → Shirt");
    info("Target Mesh", {
      name: shirtMesh.name,
      material: materialName(shirtMesh.material),
    });
    info("Color", baseColor);

    const mats = Array.isArray(shirtMesh.material)
      ? shirtMesh.material
      : [shirtMesh.material];
    mats.forEach((m: THREE.Material) => {
      const std = m as THREE.MeshStandardMaterial;
      std.map = null;
      setClothOverlayBias(shirtMesh, m);
    });
    applyColor(shirtMesh.material as any, baseColor);
    gEnd();
  }, [cloned, baseColor, shirtTexCanvas, showClothes]);

  // Shirt: attach CanvasTexture once
  useEffect(() => {
    if (!cloned || !shirtTexCanvas) return;
    if (!showClothes) return; // skip when clothes hidden

    const tshirt =
      findMeshByName(cloned, /^t[-\s_]?shirt$/i) ||
      findMeshByName(cloned, /upper|top/i);
    if (!tshirt) {
      warn("No shirt mesh found to apply texture.");
      return;
    }

    const shirtMesh = tshirt as THREE.Mesh | THREE.SkinnedMesh;
    ensureUniqueMaterial(shirtMesh);
    const mats = Array.isArray(shirtMesh.material)
      ? shirtMesh.material
      : [shirtMesh.material];

    if (!shirtTexRef.current) {
      shirtTexRef.current = new THREE.CanvasTexture(shirtTexCanvas);
      shirtTexRef.current.flipY = false;
      (shirtTexRef.current as any).colorSpace =
        (THREE as any).SRGBColorSpace ?? undefined;
      shirtTexRef.current.needsUpdate = true;

      gStart("🖼️ Attach Shirt Texture (once)");
      info("Target Mesh", { name: shirtMesh.name });
      info(
        "Materials",
        mats.map((m: THREE.Material) => ({ name: materialName(m), uuid: (m as any).uuid }))
      );
      info("Atlas", {
        width: shirtTexCanvas.width,
        height: shirtTexCanvas.height,
      });
      mats.forEach((m: THREE.Material) => {
        const std = m as THREE.MeshStandardMaterial;
        std.map = shirtTexRef.current!;
        std.color.set("#ffffff");
        setClothOverlayBias(shirtMesh, m);
        std.needsUpdate = true;
      });
      gEnd();
    }
  }, [cloned, shirtTexCanvas, showClothes]);

  // Shirt: mark texture for update when atlas changes
  useEffect(() => {
    if (!showClothes) return;
    if (shirtTexRef.current) {
      shirtTexRef.current.needsUpdate = true;
    }
  }, [shirtTexStamp, showClothes]);

  // Pants: apply canvas or flat color
  useEffect(() => {
    if (!cloned) return;
    if (!showClothes) return; // skip when clothes hidden
    applyPantsMaterial(
      cloned,
      { color: pantsColor, canvas: pantsTexCanvas, stamp: pantsTexStamp },
      pantsTexRef
    );
  }, [cloned, showClothes, pantsColor, pantsTexCanvas, pantsTexStamp]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shirtTexRef.current?.dispose();
      shirtTexRef.current = null;
      pantsTexRef.current?.dispose();
      pantsTexRef.current = null;
    };
  }, []);

  // Morphs: discover handles once
  const endoHandlesRef = useRef<Array<{ infl: number[]; index: number; meshName: string }>>([]);
  const ectoHandlesRef = useRef<Array<{ infl: number[]; index: number; meshName: string }>>([]);
  const mesoHandlesRef = useRef<Array<{ infl: number[]; index: number; meshName: string }>>([]);

  useEffect(() => {
    if (!cloned) return;
    endoHandlesRef.current = [];
    ectoHandlesRef.current = [];
    mesoHandlesRef.current = [];
    const uniqueMorphs = new Set<string>();
    cloned.traverse((o) => {
      const m = o as any;
      if (!m.isMesh || !m.morphTargetDictionary || !m.morphTargetInfluences) return;
      info("[morphs] " + (m.name || "(mesh)"));
      const dict = m.morphTargetDictionary as Record<string, number>;
      const keys = Object.keys(dict);
      info(`• Shape keys on ${m.name || '(mesh)'}:`, keys);
      keys.forEach((k) => uniqueMorphs.add(k));
      const endoBest = pickBestMorph(keys, 'endomorph', /endo|belly|waist|abdomen|stomach|fat/i);
      if (endoBest) {
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat: THREE.Material) => adoptDeformFlags(m, mat));
        endoHandlesRef.current.push({ infl: m.morphTargetInfluences, index: dict[endoBest], meshName: m.name || '(mesh)' });
        info(`↳ Endomorph handle on ${m.name}: index ${dict[endoBest]} (${endoBest})`)
      }
      const ectoBest = pickBestMorph(keys, 'ectomorph', /ecto|slim|thin/i);
      if (ectoBest) {
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat: THREE.Material) => adoptDeformFlags(m, mat));
        ectoHandlesRef.current.push({ infl: m.morphTargetInfluences, index: dict[ectoBest], meshName: m.name || '(mesh)' });
        info(`↳ Ectomorph handle on ${m.name}: index ${dict[ectoBest]} (${ectoBest})`)
      }
      const mesoBest = pickBestMorph(keys, 'mesomorph', /meso|athletic|muscle/i);
      if (mesoBest) {
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat: THREE.Material) => adoptDeformFlags(m, mat));
        mesoHandlesRef.current.push({ infl: m.morphTargetInfluences, index: dict[mesoBest], meshName: m.name || '(mesh)' });
        info(`↳ Mesomorph handle on ${m.name}: index ${dict[mesoBest]} (${mesoBest})`)
      }
    });
    info('🧩 All unique shape keys found:', Array.from(uniqueMorphs).sort());
    // zero all on discovery
    endoHandlesRef.current.forEach((h) => (h.infl[h.index] = 0));
    ectoHandlesRef.current.forEach((h) => (h.infl[h.index] = 0));
    mesoHandlesRef.current.forEach((h) => (h.infl[h.index] = 0));
  }, [cloned]);

  // Drive morphs when slider/bodyType changes; also apply height scale
  useEffect(() => {
    if (!cloned) return;
    const vEndo = bodyType === 'endomorph' ? THREE.MathUtils.clamp(bodyTypeIntensity, 0, 1) : 0;
    const vEcto = bodyType === 'ectomorph' ? THREE.MathUtils.clamp(bodyTypeIntensity, 0, 1) : 0;
    const vMeso = bodyType === 'mesomorph' ? THREE.MathUtils.clamp(bodyTypeIntensity, 0, 1) : 0;
    endoHandlesRef.current.forEach((h) => (h.infl[h.index] = vEndo));
    ectoHandlesRef.current.forEach((h) => (h.infl[h.index] = vEcto));
    mesoHandlesRef.current.forEach((h) => (h.infl[h.index] = vMeso));
    const sY = THREE.MathUtils.clamp(heightScale, 0.9, 1.2);
    // For ectomorph, also slim X/Z proportionally for a visible effect
    const hasMesoMorph = mesoHandlesRef.current.length > 0;
    const widthFactor =
      bodyType === 'ectomorph' ? (1 - 0.15 * vEcto) :
      bodyType === 'mesomorph' && !hasMesoMorph ? (1 + 0.12 * vMeso) :
      1; // mesomorph: prefer morph; fallback widen only if no morph exists
    if (bodyType === 'mesomorph' && !hasMesoMorph && vMeso > 0) {
      info('Mesomorph shape key not found. Using width scaling fallback.');
    }
    const sX = THREE.MathUtils.clamp(sY * widthFactor, 0.8, 1.3);
    const sZ = THREE.MathUtils.clamp(sY * widthFactor, 0.8, 1.3);
    cloned.scale.set(sX, sY, sZ);
    cloned.updateMatrixWorld(true);

    // Endomorph clothing fallback: if shirt has no endo morph and NOT morph-only, widen only the shirt mesh
    if (bodyType === 'endomorph' && !garment?.useMorphOnly) {
      const hasEndoOnShirt = endoHandlesRef.current.some((h) => /t[-\s_]?shirt/i.test(h.meshName));
      if (!hasEndoOnShirt) {
        const tshirt =
          findMeshByName(cloned, /^t[-\s_]?shirt$/i) ||
          findMeshByName(cloned, /shirt|upper|top/i);
        if (tshirt) {
          const mesh = tshirt as THREE.Mesh | THREE.SkinnedMesh;
          const ud: any = (mesh as any).userData;
          if (!ud.__baseScale) ud.__baseScale = mesh.scale.clone();
          const widen = 1 + 0.12 * vEndo;
          mesh.scale.set(ud.__baseScale.x * widen, ud.__baseScale.y, ud.__baseScale.z * widen);
          mesh.updateMatrixWorld(true);
        }
      }
    }

    // Apply garment width/length adjustments unless user wants morphs-only (to match Blender)
    const tshirt =
      findMeshByName(cloned, /^t[-\s_]?shirt$/i) ||
      findMeshByName(cloned, /shirt|upper|top/i);
    if (tshirt && garment && !garment.useMorphOnly) {
      const mesh = tshirt as THREE.Mesh | THREE.SkinnedMesh;
      const ud: any = (mesh as any).userData;
      if (!ud.__gsBase) ud.__gsBase = mesh.scale.clone();
      const styleFactor = garment.style === 'fit' ? 0.98 : garment.style === 'loose' ? 1.04 : 1.0;
      const widthIn = garment.custom?.widthIn ?? 20;   // baseline M ~20in
      const lengthIn = garment.custom?.lengthIn ?? 28; // baseline M ~28in
      const widthScale = styleFactor * (widthIn / 20);
      const lengthScale = (lengthIn / 28);
      mesh.scale.set(ud.__gsBase.x * widthScale, ud.__gsBase.y * lengthScale, ud.__gsBase.z * widthScale);
      mesh.updateMatrixWorld(true);
    }
  }, [cloned, bodyType, bodyTypeIntensity, heightScale, garment]);

  return <primitive object={cloned} dispose={null} />;
}

useGLTF.preload("/models/malev3.glb");
useGLTF.preload("/models/female.glb");
