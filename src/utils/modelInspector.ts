import * as THREE from 'three';

export function inspectModelMorphs(scene: THREE.Group): void {
  console.group('🔍 Model Morph Target Inspection');
  
  scene.traverse((object) => {
    if ((object as any).isSkinnedMesh) {
      const mesh = object as THREE.SkinnedMesh;
      const morphDict = mesh.morphTargetDictionary;
      
      if (morphDict) {
        console.group(`📦 Mesh: ${mesh.name || 'unnamed'}`);
        console.log('Available morph targets:', Object.keys(morphDict));
        console.log('Morph influences:', mesh.morphTargetInfluences);
        console.groupEnd();
      } else {
        console.log(`📦 Mesh: ${mesh.name || 'unnamed'} - No morph targets`);
      }
    }
  });
  
  console.groupEnd();
}

export function findMorphTargets(scene: THREE.Group): Record<string, string[]> {
  const morphTargets: Record<string, string[]> = {};
  
  scene.traverse((object) => {
    if ((object as any).isSkinnedMesh) {
      const mesh = object as THREE.SkinnedMesh;
      const morphDict = mesh.morphTargetDictionary;
      
      if (morphDict) {
        morphTargets[mesh.name || 'unnamed'] = Object.keys(morphDict);
      }
    }
  });
  
  return morphTargets;
}
