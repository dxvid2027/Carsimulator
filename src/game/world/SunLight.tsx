import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { DirectionalLight, Object3D } from 'three';
import { Vector3 } from 'three';

/**
 * Sonnenlicht, das dem Auto folgt.
 *
 * Warum? Ein Directional Light rendert seine Schatten nur innerhalb einer
 * festen Box (der "Shadow Camera"). Bliebe die Box am Weltursprung, hätte das
 * Auto nach 100 m Fahrt keinen Schatten mehr. Also verschieben wir Licht und
 * Zielpunkt jeden Frame mit dem Auto mit.
 *
 * Die Box bleibt dadurch klein und die Schatten scharf – das ist eine einfache
 * Variante dessen, was später Cascaded Shadow Maps machen.
 */

/** Richtung, aus der die Sonne scheint (Einheitsvektor mal Abstand). */
const SONNENRICHTUNG = new Vector3(0.55, 0.72, 0.42).normalize();
/** Abstand des Lichts zum Auto. Muss zu shadow-camera-far passen. */
const ABSTAND = 90;
/** Halbe Kantenlänge des Schattenbereichs in Metern. */
const SCHATTENBOX = 55;

interface SunLightProps {
  /** Das Objekt, dem der Schattenbereich folgt (das Auto). */
  ziel: React.RefObject<Object3D | null>;
}

export function SunLight({ ziel }: SunLightProps) {
  const lichtRef = useRef<DirectionalLight>(null);
  const zielObjekt = useRef<Object3D>(null);
  const autoPos = useRef(new Vector3());

  useFrame(() => {
    const licht = lichtRef.current;
    const zo = zielObjekt.current;
    const objekt = ziel.current;
    if (!licht || !zo || !objekt) return;

    objekt.getWorldPosition(autoPos.current);

    // Auf ganze Meter runden: verhindert das Flimmern der Schattenkanten,
    // das entsteht, wenn sich die Schattenbox in Sub-Pixel-Schritten bewegt.
    const zx = Math.round(autoPos.current.x);
    const zz = Math.round(autoPos.current.z);
    const zy = Math.round(autoPos.current.y);

    zo.position.set(zx, zy, zz);
    licht.position.set(
      zx + SONNENRICHTUNG.x * ABSTAND,
      zy + SONNENRICHTUNG.y * ABSTAND,
      zz + SONNENRICHTUNG.z * ABSTAND,
    );
    licht.target = zo;
    licht.target.updateMatrixWorld();
  });

  return (
    <>
      <directionalLight
        ref={lichtRef}
        intensity={2.6}
        color="#fff4e0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-normalBias={0.03}
        shadow-camera-left={-SCHATTENBOX}
        shadow-camera-right={SCHATTENBOX}
        shadow-camera-top={SCHATTENBOX}
        shadow-camera-bottom={-SCHATTENBOX}
        shadow-camera-near={1}
        shadow-camera-far={ABSTAND * 2.2}
      />
      {/* Unsichtbares Hilfsobjekt, auf das das Licht zeigt */}
      <object3D ref={zielObjekt} />
    </>
  );
}
