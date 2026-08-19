import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, Object3D, Quaternion, Vector3 } from 'three';
import { telemetrie } from '../telemetrie';

/** Die verfügbaren Kameraperspektiven (Taste C schaltet durch). */
const ANSICHTEN = [
  {
    name: 'Verfolger',
    /** Position relativ zum Auto: hinter ihm (-Z) und darüber (+Y). */
    versatz: new Vector3(0, 2.3, -6.8),
    /** Punkt, auf den die Kamera schaut, relativ zum Auto. */
    ziel: new Vector3(0, 0.9, 3.0),
    /** Wie träge die Kamera folgt. Kleiner = mehr Nachlauf ("Lag"). */
    traegheitPos: 4.5,
    traegheitBlick: 7,
    /** Kamera behält die Fahrzeugneigung nicht bei (bleibt waagerecht). */
    starr: false,
    fov: 62,
  },
  {
    name: 'Nah',
    versatz: new Vector3(0, 1.7, -4.4),
    ziel: new Vector3(0, 0.8, 4.0),
    traegheitPos: 8,
    traegheitBlick: 10,
    starr: false,
    fov: 68,
  },
  {
    name: 'Cockpit',
    versatz: new Vector3(-0.34, 1.12, 0.15),
    ziel: new Vector3(-0.34, 1.05, 8.0),
    traegheitPos: 60, // fast starr am Auto
    traegheitBlick: 40,
    starr: true,
    fov: 75,
  },
  {
    name: 'Übersicht',
    versatz: new Vector3(0, 9, -13),
    ziel: new Vector3(0, 0.5, 2.0),
    traegheitPos: 2.5,
    traegheitBlick: 4,
    starr: false,
    fov: 55,
  },
] as const;

/** Name der aktiven Ansicht – wird vom HUD gelesen. */
export const kameraStatus: { name: (typeof ANSICHTEN)[number]['name'] } = {
  name: ANSICHTEN[0].name,
};

interface ChaseCameraProps {
  /** Das Objekt, dem die Kamera folgt (das sichtbare Auto). */
  ziel: React.RefObject<Object3D | null>;
}

/**
 * Weiche Verfolgerkamera.
 *
 * Der Trick für ein gutes Gefühl ist "Framerate-unabhängiges Glätten":
 *   faktor = 1 - exp(-traegheit * dt)
 * Damit fühlt sich die Kamera bei 30 und bei 144 FPS gleich an. Ein einfaches
 * `lerp(a, b, 0.1)` pro Frame würde bei hoher Bildrate viel schneller folgen.
 */
export function ChaseCamera({ ziel }: ChaseCameraProps) {
  const camera = useThree((s) => s.camera);
  const ansicht = useRef(0);

  // Wiederverwendete Vektoren – im Frame-Loop nichts Neues erzeugen (Garbage Collector!)
  const wunschPos = useRef(new Vector3());
  const blickPunkt = useRef(new Vector3());
  const geglaettetesZiel = useRef(new Vector3());
  const autoPos = useRef(new Vector3());
  const autoQuat = useRef(new Quaternion());
  const flachQuat = useRef(new Quaternion());
  const initialisiert = useRef(false);

  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.code !== 'KeyC') return;
      ansicht.current = (ansicht.current + 1) % ANSICHTEN.length;
      kameraStatus.name = ANSICHTEN[ansicht.current].name;
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, []);

  useFrame((_, delta) => {
    const objekt = ziel.current;
    if (!objekt) return;

    // Sehr große Zeitsprünge abfangen (z.B. wenn der Tab im Hintergrund war)
    const dt = Math.min(delta, 0.1);
    const a = ANSICHTEN[ansicht.current];

    objekt.getWorldPosition(autoPos.current);
    objekt.getWorldQuaternion(autoQuat.current);

    // Für die Außenansichten nur die Drehung um die Hochachse übernehmen.
    // Sonst würde die Kamera bei jedem Nicken und Wanken mitkippen – das macht seekrank.
    let drehung = autoQuat.current;
    if (!a.starr) {
      const e = autoQuat.current;
      const gierWinkel = Math.atan2(
        2 * (e.w * e.y + e.x * e.z),
        1 - 2 * (e.y * e.y + e.z * e.z),
      );
      flachQuat.current.setFromAxisAngle(new Vector3(0, 1, 0), gierWinkel);
      drehung = flachQuat.current;
    }

    wunschPos.current.copy(a.versatz).applyQuaternion(drehung).add(autoPos.current);
    blickPunkt.current.copy(a.ziel).applyQuaternion(drehung).add(autoPos.current);

    if (!initialisiert.current) {
      // Beim ersten Frame direkt setzen, sonst fliegt die Kamera vom Ursprung heran
      camera.position.copy(wunschPos.current);
      geglaettetesZiel.current.copy(blickPunkt.current);
      initialisiert.current = true;
    } else {
      camera.position.lerp(wunschPos.current, 1 - Math.exp(-a.traegheitPos * dt));
      geglaettetesZiel.current.lerp(blickPunkt.current, 1 - Math.exp(-a.traegheitBlick * dt));
    }

    // Maximalabstand begrenzen.
    // Bei niedriger Bildrate legt das Auto zwischen zwei Frames viele Meter
    // zurück, und die weiche Nachführung würde immer weiter zurückfallen.
    // Ohne diese Grenze sieht man das Auto auf langsamen Rechnern nur noch
    // als winzigen Punkt.
    const maxAbstand = a.versatz.length() * 1.6;
    const abstand = camera.position.distanceTo(autoPos.current);
    if (abstand > maxAbstand) {
      camera.position
        .sub(autoPos.current)
        .multiplyScalar(maxAbstand / abstand)
        .add(autoPos.current);
    }

    // Kamera nicht unter den Boden sinken lassen
    const bodenAbstand = autoPos.current.y - 0.4;
    if (camera.position.y < bodenAbstand) camera.position.y = bodenAbstand;

    camera.lookAt(geglaettetesZiel.current);

    // Sichtfeld leicht mit dem Tempo aufziehen – erzeugt Geschwindigkeitsgefühl
    if ('fov' in camera) {
      const tempoAnteil = Math.min(1, telemetrie.tempoKmh / 200);
      const zielFov = a.fov + tempoAnteil * 12;
      camera.fov = MathUtils.damp(camera.fov, zielFov, 3, dt);
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
