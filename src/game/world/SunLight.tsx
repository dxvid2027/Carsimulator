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

/**
 * Richtung, aus der die Sonne scheint.
 * Wird auch vom Himmel in Scene.tsx benutzt – beide müssen übereinstimmen,
 * sonst kommt das Licht aus einer anderen Ecke als die Sonne am Himmel steht.
 */
export const SONNE = new Vector3(0.5, 0.62, 0.38).normalize();

/** Alter Name, intern weiterverwendet. */
const SONNENRICHTUNG = SONNE;
/** Abstand des Lichts zum Auto. Muss zu shadow-camera-far passen. */
const ABSTAND = 95;
/**
 * Halbe Kantenlänge des Schattenbereichs in Metern.
 * Groß genug, dass die Grenze außerhalb des Blickfelds liegt – an dieser Kante
 * endet sonst sichtbar die Verschattung und man sieht ein Rechteck im Gelände.
 */
const SCHATTENBOX = 48;

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
        /*
          normalBias verschiebt den Schatten-Testpunkt entlang der Normalen.
          Zu klein -> Streifenmuster auf schrägen Flächen ("Shadow Acne"),
          das an der Grenze des Schattenbereichs als Rechteck sichtbar wird.
        */
        /*
          Bias gegen "Shadow Acne" – aber sparsam dosiert.

          Zu klein: feines Streifenmuster auf ebenen Flächen.
          Zu groß: der gesamte Bereich innerhalb der Schattenkamera wird
          gleichmäßig abgedunkelt, und man sieht ein dunkles Rechteck, das
          mit dem Auto mitwandert. Genau das passierte bei 0,35.
        */
        shadow-normalBias={0.02}
        shadow-bias={-0.00008}
        shadow-camera-left={-SCHATTENBOX}
        shadow-camera-right={SCHATTENBOX}
        shadow-camera-top={SCHATTENBOX}
        shadow-camera-bottom={-SCHATTENBOX}
        /*
          Nah- und Fernebene eng um das Auto legen.

          Die Schattenkamera steht ABSTAND Meter entfernt. Mit near=1 müsste
          sie einen Tiefenbereich von über 200 m in der Schattentextur
          unterbringen – die Genauigkeit reicht dann nicht mehr, und der
          gesamte Bereich innerhalb der Schattenkamera wird gleichmäßig
          abgedunkelt. Sichtbar als dunkles Rechteck, das mitwandert.

          Mit einem engen Bereich (hier gut 100 m) steckt die volle
          Genauigkeit dort, wo sie gebraucht wird.
        */
        shadow-camera-near={ABSTAND - 45}
        shadow-camera-far={ABSTAND + 70}
      />
      {/* Unsichtbares Hilfsobjekt, auf das das Licht zeigt */}
      <object3D ref={zielObjekt} />
    </>
  );
}
