import { useMemo } from 'react';
import { RigidBody } from '@react-three/rapier';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

/** Größe der Testebene in Metern (Phase 1 – später kommt das echte Terrain). */
const GROESSE = 1000;
/** Kantenlänge einer Rasterzelle in Metern. */
const RASTER = 10;

/**
 * Erzeugt eine Rastertextur direkt im Browser (kein Bild-Download nötig).
 * Ohne so ein Muster sieht man auf einer leeren Fläche nicht, dass man fährt.
 */
function useRasterTextur() {
  return useMemo(() => {
    const groesse = 256;
    const c = document.createElement('canvas');
    c.width = c.height = groesse;
    const ctx = c.getContext('2d')!;

    ctx.fillStyle = '#3f4a3a';
    ctx.fillRect(0, 0, groesse, groesse);

    // leichte Farbvariation, damit die Fläche nicht steril wirkt
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 700; i++) {
      const x = Math.random() * groesse;
      const y = Math.random() * groesse;
      ctx.fillRect(x, y, 2, 2);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, groesse, groesse);

    const tex = new CanvasTexture(c);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(GROESSE / RASTER, GROESSE / RASTER);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, []);
}

/** Flache Testebene mit statischem Kollisionskörper. */
export function Ground() {
  const textur = useRasterTextur();

  return (
    <RigidBody type="fixed" colliders="cuboid" friction={1.2}>
      {/* Ein flacher Quader statt einer Plane: Planes haben keine Dicke und
          Raycasts können bei hohem Tempo hindurchrutschen. */}
      <mesh receiveShadow position={[0, -0.5, 0]}>
        <boxGeometry args={[GROESSE, 1, GROESSE]} />
        <meshStandardMaterial map={textur} roughness={0.95} metalness={0} />
      </mesh>
    </RigidBody>
  );
}
