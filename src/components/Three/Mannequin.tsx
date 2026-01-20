/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* components/Three/Mannequin.tsx */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { SkeletonUtils } from "three-stdlib";
import { useDesign } from "../../store/designStore";
import type { UVRects } from "../../store/designStore";
import { inspectModelMorphs } from "../../utils/modelInspector";

type GLTFScene = { scene: THREE.Group };

// Baseline measurements (cm) - gender-specific
const getBaseMeasurements = (gender: 'male' | 'female') => ({
  chestCm: gender === 'female' ? 86 : 96,
  waistCm: gender === 'female' ? 70 : 82,
  shouldersCm: gender === 'female' ? 40 : 46,
  sleeveCm: gender === 'female' ? 58 : 60,
});

// ──────────────────────────────────────────────────────────────────────────────
// Name heuristics
// ──────────────────────────────────────────────────────────────────────────────
const SKIN_INCLUDE =
  /(body|skin|head|face|neck|torso|arm|forearm|hand|leg|thigh|calf|foot|toe|ear|human)/i;
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

function findMeshesByHeuristics(
  root: THREE.Object3D,
  include: RegExp,
  exclude: RegExp
) {
  const hits: Array<THREE.Mesh | THREE.SkinnedMesh> = [];
  root.traverse((o) => {
    if (!isRenderableMesh(o)) return;
    const nm = nameWithMaterial(o);
    const includeMatch = include.test(nm);
    const excludeMatch = exclude.test(nm);
    
    console.log(`🔍 Mesh "${o.name}": nameWithMaterial="${nm}", include=${includeMatch}, exclude=${excludeMatch}`);
    
    if (includeMatch && !excludeMatch) {
      hits.push(o);
      console.log(`✅ Added mesh "${o.name}" to hits`);
    } else {
      console.log(`❌ Skipped mesh "${o.name}" (include: ${includeMatch}, exclude: ${excludeMatch})`);
    }
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
  // Debug: Log all meshes and their names for skin detection debugging
  console.log(`🔍 SKIN DETECTION DEBUG:`);
  console.log(`SKIN_INCLUDE pattern:`, SKIN_INCLUDE);
  console.log(`SKIN_EXCLUDE pattern:`, SKIN_EXCLUDE);
  
  const allMeshes: (THREE.Mesh | THREE.SkinnedMesh)[] = [];
  root.traverse((o) => {
    if (o.type === 'Mesh' || o.type === 'SkinnedMesh') {
      allMeshes.push(o as THREE.Mesh | THREE.SkinnedMesh);
    }
  });
  
  console.log(`All meshes found (${allMeshes.length}):`, allMeshes.map(m => m.name));
  
  const targets = findMeshesByHeuristics(root, SKIN_INCLUDE, SKIN_EXCLUDE) as (THREE.Mesh | THREE.SkinnedMesh)[];
  console.log(`Skin targets found (${targets.length}):`, targets.map(m => m.name));
  
  if (!targets.length) {
    warn("No SKIN-like meshes detected.");
    return;
  }

  gStart("🧴 Apply Skin Material (per-mesh clones, keeping deform flags)");
  info("Skin meshes", targets.map((m) => m.name));

  // More flexible material detection for different model types
  const TARGET_MATERIAL_PATTERNS = [
    /^(SkinMaterial)$/i,           // Exact match
    /skin/i,                       // Contains "skin"
    /body/i,                       // Contains "body" 
    /human/i,                      // Contains "human"
    /flesh/i,                      // Contains "flesh"
    /^Material$/i,                 // Generic "Material" name
    /^Material\.001$/i,            // Specific "Material.001" name
    /^.*Material$/i                // Ends with "Material"
  ];

  for (const mesh of targets) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const newMats = mats.map((m) => {
      const src = m as THREE.MeshStandardMaterial;
      const matName = src.name || materialName(src);
      
      // Special logging for Material.001
      if (matName === 'Material.001') {
        console.log(`🎯 FOUND Material.001 on mesh "${mesh.name}"!`);
      }
      
      // Check if material matches any of our patterns
      const shouldRecolor = TARGET_MATERIAL_PATTERNS.some(pattern => pattern.test(matName));
      
      if (shouldRecolor) {
        console.log(`🎨 Recoloring material "${matName}" on mesh "${mesh.name}" to color ${color}`);
        const std = src.clone();
        std.color.set(color);
        std.metalness = 0.0;
        std.roughness = 0.65;
        adoptDeformFlags(mesh, std);
        return std;
      } else {
        console.log(`⏭️ Skipping material "${matName}" on mesh "${mesh.name}" (doesn't match skin patterns)`);
        adoptDeformFlags(mesh, src);
        return src;
      }
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
    measurements,
  } = useDesign();

  // Optional fields (if present in store)
  const designAny = useDesign() as any;
  const skinColor: string = designAny.skinColor ?? "#e6c8b5";
  const pantsColor: string | undefined = designAny.pantsColor;
  const pantsTexCanvas: HTMLCanvasElement | null = designAny.pantsTexCanvas ?? null;
  const pantsTexStamp: number | undefined = designAny.pantsTexStamp;

  // Load model based on gender selection
  const url = gender === 'female' ? "/models/femalev4.glb" : "/models/malev6.glb";
  const { scene } = useGLTF(url) as unknown as GLTFScene;
  const cloned = useMemo<THREE.Group>(
    () => SkeletonUtils.clone(scene) as THREE.Group,
    [scene, gender]
  );

  // Persistent CanvasTextures
  const shirtTexRef = useRef<THREE.CanvasTexture | null>(null);
  const pantsTexRef = useRef<THREE.CanvasTexture | null>(null);
  
  // T-shirt mesh ref for dragging
  const tshirtMeshRef = useRef<THREE.Mesh | THREE.SkinnedMesh | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartOffsetRef = useRef(0);

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
      
      // Debug: Log all morph targets for the current gender
      console.log(`🔍 Debugging morph targets for ${gender} model:`);
      cloned.traverse((o) => {
        const m = o as any;
        if (m.isSkinnedMesh && m.morphTargetDictionary) {
          const morphNames = Object.keys(m.morphTargetDictionary);
          console.log(`Mesh "${m.name}":`, morphNames);
          
          // Look for waist-related morphs
          const waistMorphs = morphNames.filter(name => 
            /waist|abdomen|stomach|belly|hip/i.test(name)
          );
          if (waistMorphs.length > 0) {
            console.log(`  🎯 Waist-related morphs found:`, waistMorphs);
          }
        }
      });

      // Comprehensive mesh analysis for female model
      if (gender === 'female') {
        console.group(`🔍 FEMALE MODEL - All Modifiable Meshes Analysis`);
        
        const allMeshes: Array<{
          name: string;
          type: 'Mesh' | 'SkinnedMesh';
          hasMorphs: boolean;
          morphCount: number;
          morphNames: string[];
          hasBones: boolean;
          boneCount: number;
          boneNames: string[];
          vertexCount: number;
          materialCount: number;
          materialNames: string[];
        }> = [];

        const allBones: Array<{
          name: string;
          type: string;
          hasChildren: boolean;
          childCount: number;
          childNames: string[];
        }> = [];

        // Analyze all meshes
        cloned.traverse((o) => {
          if (o.type === 'Mesh' || o.type === 'SkinnedMesh') {
            const mesh = o as THREE.Mesh | THREE.SkinnedMesh;
            const skinnedMesh = mesh as THREE.SkinnedMesh;
            
            const morphDict = skinnedMesh.morphTargetDictionary;
            const morphNames = morphDict ? Object.keys(morphDict) : [];
            
            const skeleton = skinnedMesh.skeleton;
            const bones = skeleton ? skeleton.bones : [];
            const boneNames = bones.map(b => b.name);
            
            const geometry = mesh.geometry as THREE.BufferGeometry;
            const positionAttr = geometry.attributes.position;
            const vertexCount = positionAttr ? positionAttr.count : 0;
            
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            const materialNames = materials.map(m => m.name || m.type || 'unnamed');
            
            allMeshes.push({
              name: mesh.name || 'unnamed',
              type: o.type as 'Mesh' | 'SkinnedMesh',
              hasMorphs: morphNames.length > 0,
              morphCount: morphNames.length,
              morphNames,
              hasBones: bones.length > 0,
              boneCount: bones.length,
              boneNames,
              vertexCount,
              materialCount: materials.length,
              materialNames
            });
          }
          
          // Analyze bones
          if (o.type === 'Bone' || (o as any).isBone) {
            const bone = o as THREE.Bone;
            allBones.push({
              name: bone.name || 'unnamed',
              type: o.type,
              hasChildren: bone.children.length > 0,
              childCount: bone.children.length,
              childNames: bone.children.map(c => c.name || 'unnamed')
            });
          }
        });

        // Log mesh summary
        console.log(`📊 MESH SUMMARY (${allMeshes.length} total):`);
        console.table(allMeshes.map(m => ({
          name: m.name,
          type: m.type,
          morphs: m.morphCount,
          bones: m.boneCount,
          vertices: m.vertexCount,
          materials: m.materialCount
        })));

        // Log meshes with morph targets
        const meshesWithMorphs = allMeshes.filter(m => m.hasMorphs);
        console.log(`🎭 MESHES WITH MORPH TARGETS (${meshesWithMorphs.length}):`);
        meshesWithMorphs.forEach(mesh => {
          console.group(`📦 ${mesh.name} (${mesh.type})`);
          console.log(`Morphs (${mesh.morphCount}):`, mesh.morphNames);
          console.log(`Materials:`, mesh.materialNames);
          console.log(`Vertices: ${mesh.vertexCount}`);
          console.groupEnd();
        });

        // Log skinned meshes
        const skinnedMeshes = allMeshes.filter(m => m.type === 'SkinnedMesh');
        console.log(`🦴 SKINNED MESHES (${skinnedMeshes.length}):`);
        skinnedMeshes.forEach(mesh => {
          console.group(`🦴 ${mesh.name}`);
          console.log(`Bones (${mesh.boneCount}):`, mesh.boneNames);
          console.log(`Morphs: ${mesh.morphCount > 0 ? mesh.morphNames.join(', ') : 'none'}`);
          console.groupEnd();
        });

        // Log bone hierarchy
        console.log(`🦴 BONE HIERARCHY (${allBones.length} total):`);
        console.table(allBones.map(b => ({
          name: b.name,
          type: b.type,
          children: b.childCount,
          childNames: b.childNames.join(', ')
        })));

        // Categorize meshes by body parts
        const bodyPartCategories = {
          skin: allMeshes.filter(m => /body|skin|head|face|neck|torso|arm|forearm|hand|leg|thigh|calf|foot|toe|ear/i.test(m.name)),
          clothing: allMeshes.filter(m => /shirt|short|pant|jean|trouser|cloth|garment|dress|skirt|hood|sleeve|sock|shoe|boot/i.test(m.name)),
          hair: allMeshes.filter(m => /hair|brow|lash/i.test(m.name)),
          other: allMeshes.filter(m => !/body|skin|head|face|neck|torso|arm|forearm|hand|leg|thigh|calf|foot|toe|ear|shirt|short|pant|jean|trouser|cloth|garment|dress|skirt|hood|sleeve|sock|shoe|boot|hair|brow|lash/i.test(m.name))
        };

        // Special analysis for breast bones and their connected meshes
        console.log(`🍑 BREAST BONE ANALYSIS:`);
        const breastBones = allBones.filter(b => /breast/i.test(b.name));
        if (breastBones.length > 0) {
          breastBones.forEach(bone => {
            console.group(`🍑 Breast bone: ${bone.name}`);
            console.log(`Type: ${bone.type}`);
            console.log(`Children: ${bone.childCount}`);
            
            // Find meshes that might be influenced by this bone
            const relatedMeshes = allMeshes.filter(mesh => 
              mesh.boneNames.some(boneName => boneName === bone.name)
            );
            console.log(`Connected meshes (${relatedMeshes.length}):`, relatedMeshes.map(m => m.name));
            
            if (relatedMeshes.length === 0) {
              console.warn(`⚠️ No meshes found connected to breast bone "${bone.name}"`);
              console.log(`Available bone names in meshes:`, allMeshes.flatMap(m => m.boneNames).filter(name => name));
            }
            console.groupEnd();
          });
        } else {
          console.log(`No breast bones found in bone hierarchy`);
        }

        console.log(`🏷️ MESHES BY CATEGORY:`);
        Object.entries(bodyPartCategories).forEach(([category, meshes]) => {
          if (meshes.length > 0) {
            console.group(`📂 ${category.toUpperCase()} (${meshes.length})`);
            meshes.forEach(mesh => {
              console.log(`• ${mesh.name} - ${mesh.type} - ${mesh.morphCount} morphs - ${mesh.boneCount} bones`);
            });
            console.groupEnd();
          }
        });

        console.groupEnd();
      }
    }
  }, [cloned, gender]);

  // Toggle clothing visibility and store t-shirt mesh ref
  useEffect(() => {
    if (!cloned) return;
    // Shirt
    const tshirt =
      findMeshByName(cloned, /^t[-\s_]?shirt$/i) ||
      findMeshByName(cloned, /upper|top/i);
    if (tshirt) {
      (tshirt as THREE.Mesh).visible = showClothes;
      tshirtMeshRef.current = tshirt as THREE.Mesh | THREE.SkinnedMesh;
    }
    // Pants
    const pants = findMeshesByHeuristics(cloned, PANTS_INCLUDE, PANTS_EXCLUDE);
    pants.forEach((p) => (p.visible = showClothes));
  }, [cloned, showClothes]);

  // Apply shared skin material from 'human'
  useEffect(() => {
    if (!cloned) return;
    
    // Debug: Log all materials in the model for skin color debugging
    console.log(`🎨 SKIN COLOR DEBUG for ${gender} model:`);
    cloned.traverse((o) => {
      if (o.type === 'Mesh' || o.type === 'SkinnedMesh') {
        const mesh = o as THREE.Mesh | THREE.SkinnedMesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((mat, index) => {
          console.log(`Mesh "${mesh.name}" - Material ${index}:`, {
            name: mat.name || 'unnamed',
            type: mat.type,
            color: (mat as THREE.MeshStandardMaterial).color?.getHexString() || 'no color'
          });
        });
      }
    });
    
    colorizeSkin(cloned, skinColor);
  }, [cloned, skinColor, gender]);

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
    
    // Target specific material name for both genders
    const targetMaterialPatterns = [
      /^tshirtmat$/i,     // Exact match for "tshirtmat"
      /tshirtmat/i,       // Contains "tshirtmat" 
      /shirt/i,           // Contains "shirt" (fallback)
      /tshirt/i           // Contains "tshirt" (fallback)
    ];
    
    mats.forEach((m: THREE.Material, index: number) => {
      const std = m as THREE.MeshStandardMaterial;
      const matName = m.name || m.type || 'unnamed';
      
      // Check if this material should be recolored (skips skin materials)
      const shouldColor = targetMaterialPatterns.some(pattern => pattern.test(matName));
      
      if (shouldColor) {
        console.log(`🎨 Recoloring "tshirtmat" material "${matName}" (index ${index}) on mesh "${shirtMesh.name}" to color ${baseColor}`);
        std.map = null;
        std.color.set(baseColor);
        std.metalness = 0.0;
        std.roughness = 0.8;
        setClothOverlayBias(shirtMesh, m);
        std.needsUpdate = true;
      } else {
        console.log(`⏭️ Skipping material "${matName}" on mesh "${shirtMesh.name}" (not tshirtmat)`);
      }
    });
    gEnd();
  }, [cloned, baseColor, shirtTexCanvas, showClothes, garment]);

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
  // Region morphs (macrodetails-*): shoulders, chest, arms, waist
  const chestHandlesRef = useRef<Array<{ infl: number[]; index: number; meshName: string }>>([]);
  const waistHandlesRef = useRef<Array<{ infl: number[]; index: number; meshName: string }>>([]);
  const shouldersHandlesRef = useRef<Array<{ infl: number[]; index: number; meshName: string }>>([]);
  const armsHandlesRef = useRef<Array<{ infl: number[]; index: number; meshName: string }>>([]);
  
  // T-shirt shape keys: width and height for size & fit control (both genders)
  const tshirtWidthHandlesRef = useRef<Array<{ infl: number[]; index: number; meshName: string }>>([]);
  const tshirtHeightHandlesRef = useRef<Array<{ infl: number[]; index: number; meshName: string }>>([]);

  useEffect(() => {
    if (!cloned) return;
    endoHandlesRef.current = [];
    ectoHandlesRef.current = [];
    mesoHandlesRef.current = [];
    chestHandlesRef.current = [];
    waistHandlesRef.current = [];
    shouldersHandlesRef.current = [];
    armsHandlesRef.current = [];
    tshirtWidthHandlesRef.current = [];
    tshirtHeightHandlesRef.current = [];
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
      } else {
        // Debug: Log when no endomorph morph is found
        const endoRelated = keys.filter(k => /endo|belly|waist|abdomen|stomach|fat/i.test(k));
        if (endoRelated.length > 0) {
          console.warn(`⚠️ Found endomorph-related morphs but pickBestMorph didn't select any:`, endoRelated);
        } else {
          console.log(`ℹ️ No endomorph-related morphs found in mesh "${m.name}". Available morphs:`, keys);
        }
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

      // Region morphs (macrodetails-*): look for common names with variations
      const findMacro = (exact: string, alt: RegExp) => pickBestMorph(keys, exact, alt);
      const chestName = findMacro('macrodetails-chest', /chest/i);
      if (chestName) {
        chestHandlesRef.current.push({ infl: m.morphTargetInfluences, index: dict[chestName], meshName: m.name || '(mesh)' });
        info(`↳ Chest macro on ${m.name}: ${chestName}`);
      }
      const waistName = findMacro('macrodetails-waist', /waist|abdomen|stomach/i);
      if (waistName) {
        waistHandlesRef.current.push({ infl: m.morphTargetInfluences, index: dict[waistName], meshName: m.name || '(mesh)' });
        info(`↳ Waist macro on ${m.name}: ${waistName}`);
      }
      const shouldersName = findMacro('macrodetails-shoulder', /shoulder|shoulders/i) || findMacro('macrodetails-shoulders', /shoulder|shoulders/i);
      if (shouldersName) {
        shouldersHandlesRef.current.push({ infl: m.morphTargetInfluences, index: dict[shouldersName], meshName: m.name || '(mesh)' });
        info(`↳ Shoulders macro on ${m.name}: ${shouldersName}`);
      }
      const armsName = findMacro('macrodetails-arms', /arm|arms/i);
      if (armsName) {
        armsHandlesRef.current.push({ infl: m.morphTargetInfluences, index: dict[armsName], meshName: m.name || '(mesh)' });
        info(`↳ Arms macro on ${m.name}: ${armsName}`);
      }

      // T-shirt specific shape keys for size & fit control (both genders)
      // Check if this is a t-shirt mesh and log all its shape keys
      const isTshirtMesh = /t[-\s_]?shirt|upper|top/i.test(m.name || '');
      if (isTshirtMesh) {
        console.group(`👕 T-SHIRT MESH: "${m.name}" (${gender})`);
        console.log(`📋 All shape keys (${keys.length}):`, keys);
        console.log(`🎯 Shape key indices:`, keys.map(key => `${key}: ${dict[key]}`));
        console.log(`📊 Morph target influences length:`, m.morphTargetInfluences?.length);
        console.groupEnd();
      }

      // Look for t-shirt width shape key
      const tshirtWidthKey = pickBestMorph(keys, 'tshirtwidth', /t[-\s_]?shirt.*width|width.*t[-\s_]?shirt|shirt.*width|garment.*width/i);
      if (tshirtWidthKey) {
        tshirtWidthHandlesRef.current.push({ infl: m.morphTargetInfluences, index: dict[tshirtWidthKey], meshName: m.name || '(mesh)' });
        info(`↳ T-shirt Width shape key on ${m.name}: ${tshirtWidthKey}`);
        console.log(`✅ FOUND t-shirt width shape key "${tshirtWidthKey}" at index ${dict[tshirtWidthKey]} on mesh "${m.name}" (${gender})`);
      } else if (isTshirtMesh) {
        console.warn(`⚠️ No t-shirt WIDTH shape key found in mesh "${m.name}". Available keys:`, keys);
      }
      
      // Look for t-shirt height shape key
      const tshirtHeightKey = pickBestMorph(keys, 'tshirtheight', /t[-\s_]?shirt.*height|height.*t[-\s_]?shirt|shirt.*height|garment.*height|t[-\s_]?shirt.*length|length.*t[-\s_]?shirt/i);
      if (tshirtHeightKey) {
        tshirtHeightHandlesRef.current.push({ infl: m.morphTargetInfluences, index: dict[tshirtHeightKey], meshName: m.name || '(mesh)' });
        info(`↳ T-shirt Height shape key on ${m.name}: ${tshirtHeightKey}`);
        console.log(`✅ FOUND t-shirt height shape key "${tshirtHeightKey}" at index ${dict[tshirtHeightKey]} on mesh "${m.name}" (${gender})`);
      } else if (isTshirtMesh) {
        console.warn(`⚠️ No t-shirt HEIGHT shape key found in mesh "${m.name}". Available keys:`, keys);
      }
    });
    info('🧩 All unique shape keys found:', Array.from(uniqueMorphs).sort());
    // zero all on discovery
    endoHandlesRef.current.forEach((h) => (h.infl[h.index] = 0));
    ectoHandlesRef.current.forEach((h) => (h.infl[h.index] = 0));
    mesoHandlesRef.current.forEach((h) => (h.infl[h.index] = 0));
    chestHandlesRef.current.forEach((h) => (h.infl[h.index] = 0));
    waistHandlesRef.current.forEach((h) => (h.infl[h.index] = 0));
    shouldersHandlesRef.current.forEach((h) => (h.infl[h.index] = 0));
    armsHandlesRef.current.forEach((h) => (h.infl[h.index] = 0));
    tshirtWidthHandlesRef.current.forEach((h) => (h.infl[h.index] = 0));
    tshirtHeightHandlesRef.current.forEach((h) => (h.infl[h.index] = 0));
  }, [cloned]);

  // Drive morphs when slider/bodyType changes; also apply height scale
  useEffect(() => {
    if (!cloned) return;
    const vEndo = bodyType === 'endomorph' ? THREE.MathUtils.clamp(bodyTypeIntensity, 0, 1) : 0;
    const vEcto = bodyType === 'ectomorph' ? THREE.MathUtils.clamp(bodyTypeIntensity, 0, 1) : 0;
    const vMeso = bodyType === 'mesomorph' ? THREE.MathUtils.clamp(bodyTypeIntensity, 0, 1) : 0;
    if (endoHandlesRef.current.length > 0) {
      console.log(`🏃 Applying ENDOMORPH morphs (${endoHandlesRef.current.length} handles) with intensity ${vEndo.toFixed(3)}:`, endoHandlesRef.current.map(h => h.meshName));
      endoHandlesRef.current.forEach((h) => (h.infl[h.index] = vEndo));
    } else {
      console.warn(`⚠️ No ENDOMORPH handles found for ${gender} model! Body type intensity ${vEndo.toFixed(3)} will have no effect.`);
    }
    if (ectoHandlesRef.current.length > 0) {
      console.log(`🏃 Applying ECTOMORPH morphs (${ectoHandlesRef.current.length} handles) with intensity ${vEcto.toFixed(3)}:`, ectoHandlesRef.current.map(h => h.meshName));
      ectoHandlesRef.current.forEach((h) => (h.infl[h.index] = vEcto));
    }
    if (mesoHandlesRef.current.length > 0) {
      console.log(`🏃 Applying MESOMORPH morphs (${mesoHandlesRef.current.length} handles) with intensity ${vMeso.toFixed(3)}:`, mesoHandlesRef.current.map(h => h.meshName));
      mesoHandlesRef.current.forEach((h) => (h.infl[h.index] = vMeso));
    }
    // Support 130–200 cm (baseline 175 cm ≈ scale 0.74–1.15)
    const sY = THREE.MathUtils.clamp(heightScale, 0.74, 1.2);
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
    console.log(`📏 Scaling entire model: X=${sX.toFixed(3)}, Y=${sY.toFixed(3)}, Z=${sZ.toFixed(3)} (heightScale=${heightScale.toFixed(3)}, widthFactor=${widthFactor.toFixed(3)})`);
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
          console.log(`👕 Scaling SHIRT mesh "${mesh.name}" for endomorph: widen=${widen.toFixed(3)} (X=${(ud.__baseScale.x * widen).toFixed(3)}, Z=${(ud.__baseScale.z * widen).toFixed(3)})`);
          mesh.scale.set(ud.__baseScale.x * widen, ud.__baseScale.y, ud.__baseScale.z * widen);
          mesh.updateMatrixWorld(true);
        }
      }
    }

    // Female-specific endomorph: use t-shirt's endomorph shape key when body morphs are not available
    if (gender === 'female' && bodyType === 'endomorph' && endoHandlesRef.current.length === 0) {
      const tshirt =
        findMeshByName(cloned, /^t[-\s_]?shirt$/i) ||
        findMeshByName(cloned, /shirt|upper|top/i);
      if (tshirt) {
        const mesh = tshirt as THREE.SkinnedMesh;
        const morphDict = mesh.morphTargetDictionary as Record<string, number> | undefined;
        const morphInfluences = mesh.morphTargetInfluences as number[] | undefined;
        
        if (morphDict && morphInfluences) {
          // Look for endomorph shape key on the t-shirt
          const endoKey = morphDict['endomorph'];
          if (endoKey !== undefined) {
            morphInfluences[endoKey] = vEndo;
            console.log(`👕 FEMALE ENDOMORPH: Applied endomorph shape key to t-shirt "${mesh.name}" with intensity ${vEndo.toFixed(3)}`);
          } else {
            console.warn(`⚠️ FEMALE ENDOMORPH: No 'endomorph' shape key found on t-shirt "${mesh.name}". Available shape keys:`, Object.keys(morphDict));
          }
        } else {
          console.warn(`⚠️ FEMALE ENDOMORPH: T-shirt "${mesh.name}" has no morph targets`);
        }
      } else {
        console.warn(`⚠️ FEMALE ENDOMORPH: No t-shirt mesh found for endomorph shape key application`);
      }
    }

  // Apply separate garment scaling logic for male and female genders
  const tshirt =
    findMeshByName(cloned, /^t[-\s_]?shirt$/i) ||
    findMeshByName(cloned, /shirt|upper|top/i);
  
  if (tshirt && garment && !garment.useMorphOnly) {
    const mesh = tshirt as THREE.Mesh | THREE.SkinnedMesh;
    const ud: any = (mesh as any).userData;
      if (!ud.__gsBase) {
        ud.__gsBase = mesh.scale.clone();
      }
      
      // Ensure material is unique and preserve color
      ensureUniqueMaterial(mesh);
    
    if( gender === 'female' ) {
      // FEMALE GENDER: Apply style scaling alongside shape keys (more noticeable range)
      const styleFactor = garment.style === 'fit' ? 0.90 : garment.style === 'loose' ? 1.10 : 1.0;
      
      // Get dimensions from preset or custom values for female
      const femalePresets: Record<'S'|'M'|'L'|'XL', { widthIn:number; lengthIn:number }> = {
        S:  { widthIn: 19, lengthIn: 27 },
        M:  { widthIn: 20, lengthIn: 28 },
        L:  { widthIn: 22, lengthIn: 29 },
        XL: { widthIn: 24, lengthIn: 31 },
      };
      
      const preset = (garment.preset ?? 'L') as 'S'|'M'|'L'|'XL';
      const fromPreset = femalePresets[preset];
      const widthIn = garment.custom?.widthIn ?? fromPreset.widthIn;
      const lengthIn = garment.custom?.lengthIn ?? fromPreset.lengthIn;
      
      // Apply style factor AND dimension scaling for females
      const widthScale = styleFactor * (widthIn / 20); // Female baseline width
      const lengthScale = styleFactor * (lengthIn / 28); // Female baseline length
      
      console.log(`👔 FEMALE Scaling GARMENT mesh "${mesh.name}": widthScale=${widthScale.toFixed(3)}, lengthScale=${lengthScale.toFixed(3)} (style=${garment.style} factor=${styleFactor}, preset=${garment.preset})`);
      mesh.scale.set(ud.__gsBase.x * widthScale, ud.__gsBase.y * lengthScale, ud.__gsBase.z * widthScale);
      
      // Ensure color is preserved after material changes
      if (!shirtTexCanvas && baseColor) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m: THREE.Material) => {
            const std = m as THREE.MeshStandardMaterial;
            const matName = m.name || m.type || 'unnamed';
            
            const shouldColor = /^tshirtmat$/i.test(matName) || /tshirtmat/i.test(matName);
            if (shouldColor) {
              console.log(`🎨 Reapplying color to "tshirtmat" material "${matName}" after ${gender} scaling`);
              std.color.set(baseColor);
              std.needsUpdate = true;
            }
          });
      }
      
    } else {
      // MALE GENDER: Traditional scaling-based approach
      const styleFactor = garment.style === 'fit' ? 0.98 : garment.style === 'loose' ? 1.04 : 1.0;
      
      // Gender-specific preset mappings
      const presetToIn: Record<'S'|'M'|'L'|'XL', { widthIn:number; lengthIn:number }> = {
        S:  { widthIn: 21, lengthIn: 28 }, // Male sizes tend to be larger
        M:  { widthIn: 23.5, lengthIn: 29.2 },
        L:  { widthIn: 24, lengthIn: 30 },
        XL: { widthIn: 26, lengthIn: 31 },
      };
      
      const preset = (garment.preset ?? 'M') as 'S'|'M'|'L'|'XL';
      const fromPreset = presetToIn[preset];
      const widthIn = garment.custom?.widthIn ?? fromPreset.widthIn;
      const lengthIn = garment.custom?.lengthIn ?? fromPreset.lengthIn;
      
      // Male-specific scaling calculations
      const widthScale = styleFactor * (widthIn / 23.5); // Male baseline width (M preset)
      const lengthScale = (lengthIn / 29.2); // Male baseline length (M preset)
      
      console.log(`👔 MALE Scaling GARMENT mesh "${mesh.name}": widthScale=${widthScale.toFixed(3)}, lengthScale=${lengthScale.toFixed(3)} (style=${garment.style}, preset=${garment.preset})`);
      mesh.scale.set(ud.__gsBase.x * widthScale, ud.__gsBase.y * lengthScale, ud.__gsBase.z * widthScale);
      
      // Ensure color is preserved after material changes
      if (!shirtTexCanvas && baseColor) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m: THREE.Material) => {
          const std = m as THREE.MeshStandardMaterial;
          const matName = m.name || m.type || 'unnamed';
          
          const shouldColor = /^(?!SkinMaterial)(?!skin)(?!body)(?!human)(?!flesh).*$/i.test(matName);
          if (shouldColor) {
            console.log(`🎨 Reapplying color to material "${matName}" after male scaling`);
            std.color.set(baseColor);
            std.needsUpdate = true;
          }
        });
      }
    }
    
    mesh.updateMatrixWorld(true);
  }
  }, [cloned, bodyType, bodyTypeIntensity, heightScale, garment]);

  // ──────────────────────────────────────────────────────────────────────────────
  // Apply t-shirt shape keys based on size & fit measurements (both genders)
  // Uses shape keys when available instead of mesh scaling for more accurate deformation
  // ──────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cloned) return;
    if (!showClothes) return; // skip when clothes hidden

    // Only apply shape keys if garment.useMorphOnly is false (to prioritize shape keys over scaling)
    if (garment?.useMorphOnly === true) return;

    // Calculate shape key values - combine preset base with custom slider adjustments
    let widthValue = 0.0;
    let heightValue = 0.0;
    
    // Gender-specific preset values
    const presetWidthInches = gender === 'female'
      ? (garment?.preset === 'S' ? 19 : 
         garment?.preset === 'M' ? 20 : 
         garment?.preset === 'L' ? 22 : 
         garment?.preset === 'XL' ? 24 : 20) // default M
      : (garment?.preset === 'S' ? 21 : 
         garment?.preset === 'M' ? 23.5 : 
         garment?.preset === 'L' ? 24 : 
         garment?.preset === 'XL' ? 26 : 23.5); // default M for male
    
    const presetHeightInches = gender === 'female'
      ? (garment?.preset === 'S' ? 27 :
         garment?.preset === 'M' ? 28 :
         garment?.preset === 'L' ? 29 :
         garment?.preset === 'XL' ? 31 : 28) // default M
      : (garment?.preset === 'S' ? 28 :
         garment?.preset === 'M' ? 29.2 :
         garment?.preset === 'L' ? 30 :
         garment?.preset === 'XL' ? 31 : 29.2); // default M for male
    
    // Use custom values if provided, otherwise use preset base
    const finalWidthInches = garment?.custom?.widthIn ?? presetWidthInches;
    const finalHeightInches = garment?.custom?.lengthIn ?? presetHeightInches;
    
    // Convert to shape key values (-1 to +1 range) with gender-specific ranges
    if (gender === 'female') {
      widthValue = THREE.MathUtils.mapLinear(finalWidthInches, 19, 24, -1, 1);
      heightValue = THREE.MathUtils.mapLinear(finalHeightInches, 27, 31, -1, 1);
    } else {
      // Male ranges: width 21-27, height 28-32 (increased max values for larger adjustments)
      widthValue = THREE.MathUtils.mapLinear(finalWidthInches, 19, 24, -1, 1);
      heightValue = THREE.MathUtils.mapLinear(finalHeightInches, 27, 32, -1, 1);
    }

    // Apply t-shirt width shape keys
    if (tshirtWidthHandlesRef.current.length > 0) {
      console.log(`👕 Applying T-shirt WIDTH shape keys for ${gender} (${tshirtWidthHandlesRef.current.length} handles) with value ${widthValue.toFixed(3)}:`, tshirtWidthHandlesRef.current.map(h => h.meshName));
      tshirtWidthHandlesRef.current.forEach((h) => (h.infl[h.index] = widthValue));
    } else {
      console.warn(`⚠️ No t-shirt WIDTH shape key handles found for ${gender} model! Width adjustment will fall back to mesh scaling.`);
    }

    // Apply t-shirt height shape keys
    if (tshirtHeightHandlesRef.current.length > 0) {
      console.log(`👕 Applying T-shirt HEIGHT shape keys for ${gender} (${tshirtHeightHandlesRef.current.length} handles) with value ${heightValue.toFixed(3)}:`, tshirtHeightHandlesRef.current.map(h => h.meshName));
      tshirtHeightHandlesRef.current.forEach((h) => (h.infl[h.index] = heightValue));
    } else {
      console.warn(`⚠️ No t-shirt HEIGHT shape key handles found for ${gender} model! Height adjustment will fall back to mesh scaling.`);
    }

    console.log(`📏 T-shirt Shape Keys for ${gender} - Preset: ${garment?.preset || 'default'}, Width: ${widthValue.toFixed(3)}, Height: ${heightValue.toFixed(3)}`);
    console.log(`📐 Values: Width ${finalWidthInches}" (preset: ${presetWidthInches}", slider: ${garment?.custom?.widthIn ?? 'none'}), Height ${finalHeightInches}" (preset: ${presetHeightInches}", slider: ${garment?.custom?.lengthIn ?? 'none'})`);
    console.log(`🎯 Shape key range: Width ${widthValue.toFixed(3)}, Height ${heightValue.toFixed(3)}`);
  }, [cloned, gender, measurements, garment, showClothes]);

  // ──────────────────────────────────────────────────────────────────────────────
  // Fallback body-region scaling (when per-area morphs are unavailable)
  // Drives chest/waist/shoulders/arms length using bone scale heuristics
  // ──────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cloned) return;
    const hasRegionMorphs =
      chestHandlesRef.current.length +
      waistHandlesRef.current.length +
      shouldersHandlesRef.current.length +
      armsHandlesRef.current.length > 0;
    if (hasRegionMorphs) return; // skip fallback when proper morphs exist

    const allBones: THREE.Bone[] = [] as any;
    cloned.traverse((o) => { if ((o as any).isBone) allBones.push(o as THREE.Bone); });
    const findBones = (rx: RegExp) => allBones.filter(b => rx.test(b.name || ""));

    // For female model, use only breast bones for chest scaling
    const chestBones = gender === 'female' 
      ? findBones(/breastL|breastR/i)
      : findBones(/upper.?chest|chest|spine.?2|spine.?03/i);
    // For female model, use pelvis bones and lower spine for waist (more anatomically correct)
    const waistBones = gender === 'female' 
      ? findBones(/pelvisL|pelvisR|spine04|spine05|abdomen|stomach|waist|hips?/i)
      : findBones(/spine(?!.*\d)|abdomen|stomach|waist|hips?/i);
    const shoulderBones = findBones(/clavicle|shoulder(?!.*blade)/i);
    const upperArms = findBones(/upper.?arm|arm\.L|arm\.R/i);
    const foreArms = findBones(/lower.?arm|fore.?arm/i);

    // Debug: Log detected bones for each body part
    console.log(`🔍 BONE DETECTION for ${gender} model:`);
    console.log(`Chest bones (${chestBones.length}):`, chestBones.map(b => b.name));
    console.log(`Waist bones (${waistBones.length}):`, waistBones.map(b => b.name));
    console.log(`Shoulder bones (${shoulderBones.length}):`, shoulderBones.map(b => b.name));
    console.log(`Upper arm bones (${upperArms.length}):`, upperArms.map(b => b.name));
    console.log(`Forearm bones (${foreArms.length}):`, foreArms.map(b => b.name));

    const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
    const baseMeas = getBaseMeasurements(gender);
    const fChest = clamp(measurements.chestCm / baseMeas.chestCm, 0.85, 1.15);
    const fWaist = clamp(measurements.waistCm / baseMeas.waistCm, 0.85, 1.15);
    const fShoulders = clamp(measurements.shouldersCm / baseMeas.shouldersCm, 0.9, 1.15);
    const fArms = clamp(measurements.sleeveCm / baseMeas.sleeveCm, 0.9, 1.15);

    const setScaleX = (bones: THREE.Bone[], factor: number, key: string) => {
      bones.forEach((b) => {
        const ud: any = (b as any).userData;
        if (!ud[key]) ud[key] = { x: b.scale.x, y: b.scale.y, z: b.scale.z };
        
        // Special handling for breast bones - scale all axes for more visible effect
        if (b.name && /breast/i.test(b.name)) {
          console.log(`🍑 Scaling BREAST bone "${b.name}" by factor ${factor.toFixed(3)} on all axes`);
          b.scale.set(ud[key].x * factor, ud[key].y * factor, ud[key].z * factor);
        } else {
          b.scale.set(ud[key].x * factor, b.scale.y, b.scale.z);
        }
        b.updateMatrixWorld(true);
      });
    };
    const setScaleY = (bones: THREE.Bone[], factor: number, key: string) => {
      bones.forEach((b) => {
        const ud: any = (b as any).userData;
        if (!ud[key]) ud[key] = { x: b.scale.x, y: b.scale.y, z: b.scale.z };
        b.scale.set(b.scale.x, ud[key].y * factor, b.scale.z);
        b.updateMatrixWorld(true);
      });
    };

    if (chestBones.length) {
      console.log(`🦴 Scaling CHEST bones (${chestBones.length} bones) by factor ${fChest.toFixed(3)}:`, chestBones.map(b => b.name));
      setScaleX(chestBones, fChest, "__baseScaleChest");
    }
    if (waistBones.length) {
      console.log(`🦴 Scaling WAIST bones (${waistBones.length} bones) by factor ${fWaist.toFixed(3)}:`, waistBones.map(b => b.name));
      setScaleX(waistBones, fWaist, "__baseScaleWaist");
    }
    if (shoulderBones.length) {
      console.log(`🦴 Scaling SHOULDER bones (${shoulderBones.length} bones) by factor ${fShoulders.toFixed(3)}:`, shoulderBones.map(b => b.name));
      setScaleX(shoulderBones, fShoulders, "__baseScaleShoulder");
    }
    if (upperArms.length) {
      console.log(`🦴 Scaling UPPER ARM bones (${upperArms.length} bones) by factor ${fArms.toFixed(3)}:`, upperArms.map(b => b.name));
      setScaleY(upperArms, fArms, "__baseScaleUpperArm");
    }
    if (foreArms.length) {
      console.log(`🦴 Scaling FORE ARM bones (${foreArms.length} bones) by factor ${fArms.toFixed(3)}:`, foreArms.map(b => b.name));
      setScaleY(foreArms, fArms, "__baseScaleForeArm");
    }

    cloned.updateMatrixWorld(true);
  }, [cloned, measurements]);

  // ──────────────────────────────────────────────────────────────────────────────
  // Drive region morphs from measurements (cm)
  // Maps deltas from BASE_MEAS into 0..1 morph influences
  // ──────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cloned) return;
    const baseMeas = getBaseMeasurements(gender);
    const delta = {
      chest: THREE.MathUtils.clamp((measurements.chestCm - baseMeas.chestCm) / 25, 0, 1),
      waist: THREE.MathUtils.clamp((measurements.waistCm - baseMeas.waistCm) / 25, 0, 1),
      shoulders: THREE.MathUtils.clamp((measurements.shouldersCm - baseMeas.shouldersCm) / 12, 0, 1),
      arms: THREE.MathUtils.clamp((measurements.sleeveCm - baseMeas.sleeveCm) / 8, 0, 1),
    };
    if (chestHandlesRef.current.length > 0) {
      console.log(`🎭 Applying CHEST morphs (${chestHandlesRef.current.length} handles) with delta ${delta.chest.toFixed(3)}:`, chestHandlesRef.current.map(h => h.meshName));
      chestHandlesRef.current.forEach((h) => (h.infl[h.index] = delta.chest));
    }
    if (waistHandlesRef.current.length > 0) {
      console.log(`🎭 Applying WAIST morphs (${waistHandlesRef.current.length} handles) with delta ${delta.waist.toFixed(3)}:`, waistHandlesRef.current.map(h => h.meshName));
      waistHandlesRef.current.forEach((h) => (h.infl[h.index] = delta.waist));
    }
    if (shouldersHandlesRef.current.length > 0) {
      console.log(`🎭 Applying SHOULDER morphs (${shouldersHandlesRef.current.length} handles) with delta ${delta.shoulders.toFixed(3)}:`, shouldersHandlesRef.current.map(h => h.meshName));
      shouldersHandlesRef.current.forEach((h) => (h.infl[h.index] = delta.shoulders));
    }
    if (armsHandlesRef.current.length > 0) {
      console.log(`🎭 Applying ARMS morphs (${armsHandlesRef.current.length} handles) with delta ${delta.arms.toFixed(3)}:`, armsHandlesRef.current.map(h => h.meshName));
      armsHandlesRef.current.forEach((h) => (h.infl[h.index] = delta.arms));
    }
  }, [cloned, measurements, gender]);

  // Apply vertical offset to t-shirt position
  useEffect(() => {
    if (!cloned || !tshirtMeshRef.current) return;
    const tshirt = tshirtMeshRef.current;
    const verticalOffset = garment?.verticalOffset ?? 0;
    
    // Store base position if not already stored
    const ud: any = (tshirt as any).userData;
    if (ud.__basePositionY === undefined) {
      ud.__basePositionY = tshirt.position.y;
    }
    
    // Apply vertical offset
    tshirt.position.y = ud.__basePositionY + verticalOffset;
    tshirt.updateMatrixWorld(true);
  }, [cloned, garment?.verticalOffset]);

  // Set up drag handlers for t-shirt using canvas events and raycasting
  const { gl, camera, raycaster } = useThree();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  useEffect(() => {
    if (!cloned || !tshirtMeshRef.current) return;
    canvasRef.current = gl.domElement;
    
    const tshirt = tshirtMeshRef.current;
    const { setGarment } = useDesign.getState();
    
    const handlePointerMoveHover = (event: PointerEvent | MouseEvent | TouchEvent) => {
      if (!canvasRef.current || !tshirt || isDraggingRef.current) return;
      
      let clientX: number;
      let clientY: number;
      
      if ('touches' in event && event.touches.length > 0) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      } else if ('clientX' in event) {
        clientX = event.clientX;
        clientY = event.clientY;
      } else {
        return;
      }
      
      // Raycast to check if we're hovering over the t-shirt
      const rect = canvasRef.current.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const intersects = raycaster.intersectObject(tshirt, true);
      
      if (intersects.length > 0) {
        canvasRef.current.style.cursor = 'grab';
      } else {
        canvasRef.current.style.cursor = '';
      }
    };
    
    const handlePointerDown = (event: PointerEvent | MouseEvent | TouchEvent) => {
      if (!canvasRef.current || !tshirt) return;
      
      // Only handle left mouse button or primary touch
      if ('button' in event && event.button !== 0) return;
      
      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
      const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
      
      // Raycast to check if we clicked on the t-shirt
      const rect = canvasRef.current.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const intersects = raycaster.intersectObject(tshirt, true);
      
      if (intersects.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        isDraggingRef.current = true;
        dragStartYRef.current = clientY;
        dragStartOffsetRef.current = garment?.verticalOffset ?? 0;
        canvasRef.current.style.cursor = 'grabbing';
      }
    };
    
    const handlePointerMove = (event: PointerEvent | MouseEvent | TouchEvent) => {
      if (!isDraggingRef.current || !canvasRef.current) return;
      
      const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
      const deltaY = dragStartYRef.current - clientY;
      
      // Convert screen pixels to world units
      // Adjust sensitivity as needed - smaller values = less movement per pixel
      const sensitivity = 0.01;
      const newOffset = dragStartOffsetRef.current + (deltaY * sensitivity);
      
      // Clamp offset to reasonable range (e.g., -0.5 to 0.5 units)
      const clampedOffset = THREE.MathUtils.clamp(newOffset, -0.5, 0.5);
      
      setGarment({ verticalOffset: clampedOffset });
    };
    
    const handlePointerUp = () => {
      if (isDraggingRef.current && canvasRef.current) {
        canvasRef.current.style.cursor = '';
      }
      isDraggingRef.current = false;
    };
    
    // Add event listeners to the canvas
    const canvas = canvasRef.current;
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('touchstart', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMoveHover);
    canvas.addEventListener('mousemove', handlePointerMoveHover);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchend', handlePointerUp);
    
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('mousedown', handlePointerDown);
      canvas.removeEventListener('touchstart', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMoveHover);
      canvas.removeEventListener('mousemove', handlePointerMoveHover);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [cloned, garment?.verticalOffset, gl, camera, raycaster]);

  return <primitive object={cloned} dispose={null} />;
}

useGLTF.preload("/models/malev6.glb");
useGLTF.preload("/models/femalev4.glb");
