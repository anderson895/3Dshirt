/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* components/Three/Mannequin.tsx */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import { useDesign } from "../../store/designStore";
import type { UVRects } from "../../store/designStore";

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
function findLargestMesh(root: THREE.Object3D) {
  let best: (THREE.Mesh | THREE.SkinnedMesh) | null = null;
  let bestScore = -1;
  root.traverse((o) => {
    if (isRenderableMesh(o) && o.geometry) {
      const geom = o.geometry as THREE.BufferGeometry;
      const tri = Math.floor(
        (geom.getIndex()?.count ?? geom.attributes.position?.count ?? 0) / 3
      );
      if (tri > bestScore) {
        best = o;
        bestScore = tri;
      }
    }
  });
  return best;
}
function findHipLikeNode(root: THREE.Object3D) {
  let hit: THREE.Object3D | null = null;
  const hipRegexes = [/^hips?$/i, /pelvis/i, /mixamorig[:]hips/i, /^root$/i, /spine_?0/i];
  root.traverse((o) => {
    if (hit) return;
    const name = o.name || "";
    const isBone = (o as any).isBone || o.type === "Bone";
    if (isBone && /hips?|pelvis|root/i.test(name)) {
      hit = o;
      return;
    }
    if (hipRegexes.some((r) => r.test(name))) hit = o;
  });
  return hit;
}

function setMorphByNameSafe(
  mesh: THREE.SkinnedMesh,
  morphName: string,
  value: number
) {
  const dict = mesh.morphTargetDictionary;
  const infl = mesh.morphTargetInfluences;
  if (!dict || !infl) return false;
  const idx = dict[morphName];
  if (idx !== undefined) {
    infl[idx] = value;
    return true;
  }
  return false;
}

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

// Helper: get first colorable MeshStandardMaterial from a mesh
function getFirstColorableMaterial(
  mesh: (THREE.Mesh | THREE.SkinnedMesh) | null
): THREE.MeshStandardMaterial | null {
  if (!mesh || !mesh.material) return null;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const m of mats) {
    const std = m as THREE.MeshStandardMaterial;
    if ((std as any).isMeshStandardMaterial && std.color instanceof THREE.Color) {
      return std;
    }
  }
  return null;
}

// NEW: colorize skin by REUSING the 'human' material instance everywhere
function colorizeSkin(root: THREE.Object3D, color: string) {
  const targets = findMeshesByHeuristics(root, SKIN_INCLUDE, SKIN_EXCLUDE);
  if (!targets.length) {
    warn("No SKIN-like meshes detected.");
    return;
  }

  const human =
    findMeshByName(root, /^human$/i) ||
    findMeshByName(root, /character|avatar|body/i);

  let baseMat = getFirstColorableMaterial(human);
  if (!baseMat) baseMat = getFirstColorableMaterial(targets[0])!;

  gStart("🧴 Apply Skin Material (shared)");
  info("Skin meshes", targets.map((m) => m.name));
  info("Using base material from", human?.name ?? "(first skin target)");

  if (baseMat) {
    // configure once
    baseMat.color.set(color);
    baseMat.metalness = 0.0;
    baseMat.roughness = 0.65;
    baseMat.needsUpdate = true;

    // assign SAME instance to all skin meshes
    for (const mesh of targets) {
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map(() => baseMat!);
      } else {
        mesh.material = baseMat;
      }
      (mesh.material as any).needsUpdate = true;
    }
  } else {
    // Fallback: per-mesh tint
    warn("No colorable MeshStandardMaterial found; tinting per mesh.");
    for (const mesh of targets) {
      ensureUniqueMaterial(mesh);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        if ((std as any).isMeshStandardMaterial) {
          std.color.set(color);
          std.metalness = 0.0;
          std.roughness = 0.65;
          std.needsUpdate = true;
        }
      }
    }
  }
  gEnd();
}

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
export default function Mannequin() {
  // Known fields from your store
  const {
    gender,
    morphs,
    heightScale,
    baseColor,
    shirtTexCanvas,
    shirtTexStamp,
    setUVRects,
  } = useDesign();

  // Optional fields (if present in store)
  const designAny = useDesign() as any;
  const skinColor: string = designAny.skinColor ?? "#e6c8b5";
  const pantsColor: string | undefined = designAny.pantsColor;
  const pantsTexCanvas: HTMLCanvasElement | null = designAny.pantsTexCanvas ?? null;
  const pantsTexStamp: number | undefined = designAny.pantsTexStamp;

  const url = gender === "male" ? "/models/male.glb" : "/models/female.glb";
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
    if (cloned) listEditableParts(cloned);
  }, [cloned]);

  // Apply shared skin material from 'human'
  useEffect(() => {
    if (!cloned) return;
    colorizeSkin(cloned, skinColor);
  }, [cloned, skinColor]);

  // Compute UV rects (shirt)
  useEffect(() => {
    if (!cloned) return;
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
  }, [cloned, setUVRects]);

  // Base shirt color when NO custom shirt texture is active
  useEffect(() => {
    if (!cloned || shirtTexCanvas) return;
    const tshirt =
      findMeshByName(cloned, /^t[-\s_]?shirt$/i) ||
      findMeshByName(cloned, /upper|top/i);
    if (!tshirt) {
      warn("No shirt mesh found for base color.");
      return;
    }

    ensureUniqueMaterial(tshirt);
    gStart("🎨 Apply Base Color → Shirt");
    info("Target Mesh", {
      name: tshirt.name,
      material: materialName(tshirt.material),
    });
    info("Color", baseColor);

    const mats = Array.isArray(tshirt.material)
      ? tshirt.material
      : [tshirt.material];
    mats.forEach((m) => {
      const std = m as THREE.MeshStandardMaterial;
      std.map = null;
    });
    applyColor(tshirt.material as any, baseColor);
    gEnd();
  }, [cloned, baseColor, shirtTexCanvas]);

  // Shirt: attach CanvasTexture once
  useEffect(() => {
    if (!cloned || !shirtTexCanvas) return;

    const tshirt =
      findMeshByName(cloned, /^t[-\s_]?shirt$/i) ||
      findMeshByName(cloned, /upper|top/i);
    if (!tshirt) {
      warn("No shirt mesh found to apply texture.");
      return;
    }

    ensureUniqueMaterial(tshirt);
    const mats = Array.isArray(tshirt.material)
      ? tshirt.material
      : [tshirt.material];

    if (!shirtTexRef.current) {
      shirtTexRef.current = new THREE.CanvasTexture(shirtTexCanvas);
      shirtTexRef.current.flipY = false;
      (shirtTexRef.current as any).colorSpace =
        (THREE as any).SRGBColorSpace ?? undefined;
      shirtTexRef.current.needsUpdate = true;

      gStart("🖼️ Attach Shirt Texture (once)");
      info("Target Mesh", { name: tshirt.name });
      info(
        "Materials",
        mats.map((m) => ({ name: materialName(m), uuid: (m as any).uuid }))
      );
      info("Atlas", {
        width: shirtTexCanvas.width,
        height: shirtTexCanvas.height,
      });
      mats.forEach((m) => {
        const std = m as THREE.MeshStandardMaterial;
        std.map = shirtTexRef.current!;
        std.color.set("#ffffff");
        std.needsUpdate = true;
      });
      gEnd();
    }
  }, [cloned, shirtTexCanvas]);

  // Shirt: mark texture for update when atlas changes
  useEffect(() => {
    if (shirtTexRef.current) {
      shirtTexRef.current.needsUpdate = true;
    }
  }, [shirtTexStamp]);

  // Pants: apply canvas or flat color
  useEffect(() => {
    if (!cloned) return;
    applyPantsMaterial(
      cloned,
      { color: pantsColor, canvas: pantsTexCanvas, stamp: pantsTexStamp },
      pantsTexRef
    );
  }, [cloned, pantsColor, pantsTexCanvas, pantsTexStamp]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shirtTexRef.current?.dispose();
      shirtTexRef.current = null;
      pantsTexRef.current?.dispose();
      pantsTexRef.current = null;
    };
  }, []);

  // Morphs + height scale
  useEffect(() => {
    if (!cloned) return;
    const body =
      findMeshByName(cloned, /human|body|character|avatar/i) ||
      findLargestMesh(cloned);
    const shirt =
      findMeshByName(cloned, /^t[-\s_]?shirt$/i) ||
      findMeshByName(cloned, /upper|top/i);

    const targets: (THREE.Mesh | THREE.SkinnedMesh | null)[] = [body, shirt];
    const MORPH_MAP = {
      waist: "macrodetails-waist",
      shoulder: "macrodetails-shoulder",
      chest: "macrodetails-chest",
      arms: "macrodetails-arms",
    } as const;

    gStart("🧬 Apply Morphs");
    for (const t of targets) {
      if (!t) continue;
      const skinned = (t as any).isSkinnedMesh;
      if (!skinned) continue;
      const sm = t as THREE.SkinnedMesh;
      setMorphByNameSafe(sm, MORPH_MAP.waist, morphs.waist);
      setMorphByNameSafe(sm, MORPH_MAP.shoulder, morphs.shoulder);
      setMorphByNameSafe(sm, MORPH_MAP.chest, morphs.chest);
      setMorphByNameSafe(sm, MORPH_MAP.arms, morphs.arms);
      sm.updateMorphTargets?.();
    }
    gEnd();

    const hipLike = findHipLikeNode(cloned);
    const s = THREE.MathUtils.clamp(heightScale, 0.9, 1.2);
    if (hipLike) {
      hipLike.scale.setScalar(s);
      hipLike.updateMatrixWorld(true);
    } else {
      cloned.scale.setScalar(s);
      cloned.updateMatrixWorld(true);
    }
  }, [cloned, morphs, heightScale]);

  return <primitive object={cloned} dispose={null} />;
}

useGLTF.preload("/models/male.glb");
useGLTF.preload("/models/female.glb");
