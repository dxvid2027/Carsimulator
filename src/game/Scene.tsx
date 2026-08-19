import { useRef } from 'react';
import { Environment, Lightformer } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import type { Object3D } from 'three';
import { PHYSIK_DT } from './config/vehicleConfig';
import { Car } from './vehicle/Car';
import { Ground } from './world/Ground';
import { ChaseCamera } from './camera/ChaseCamera';
import { telemetrie } from './telemetrie';

/** Debug-Schalter: zeigt die Kollisionskörper als Drahtgitter (?debug in der URL). */
const DEBUG = new URLSearchParams(window.location.search).has('debug');

// Im Entwicklungsmodus die Telemetrie in der Browser-Konsole verfügbar machen:
// einfach `telemetrie` in die Konsole tippen.
if (import.meta.env.DEV) {
  (window as unknown as { telemetrie: typeof telemetrie }).telemetrie = telemetrie;
}

export function Scene() {
  /** Das sichtbare Auto – die Kamera folgt diesem Objekt. */
  const autoRef = useRef<Object3D>(null);

  return (
    <>
      {/* ---------- Beleuchtung ---------- */}
      <hemisphereLight args={['#bcd7ff', '#4a4535', 0.55]} />
      <directionalLight
        position={[45, 60, 25]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        // Der Schattenbereich muss das Auto umschließen. Klein halten = scharfe Schatten.
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-camera-near={1}
        shadow-camera-far={160}
      />

      {/*
        Environment ohne Datei: Die Lichtformen unten werden zu einer
        Umgebungstextur gerendert. Dadurch bekommen die PBR-Materialien
        echte Spiegelungen – ganz ohne HDRI-Download.
        Ein richtiges HDRI kommt im Grafik-Schritt.
      */}
      <Environment resolution={128}>
        <Lightformer intensity={2.4} form="ring" scale={12} position={[0, 8, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Lightformer intensity={0.8} form="rect" scale={[20, 6, 1]} position={[-12, 4, -8]} color="#8ab4ff" />
        <Lightformer intensity={0.6} form="rect" scale={[20, 6, 1]} position={[12, 4, 8]} color="#ffd9a0" />
      </Environment>

      {/* Himmel/Nebel: blendet die Kante der Testebene aus */}
      <color attach="background" args={['#8fb4d8']} />
      <fog attach="fog" args={['#8fb4d8', 90, 460]} />

      {/* ---------- Physik ---------- */}
      {/*
        timeStep fest auf 1/60: Die Fahrphysik rechnet mit genau diesem Wert
        (PHYSIK_DT). Bei variablem Zeitschritt würde sich das Auto auf
        schnellen und langsamen Rechnern unterschiedlich verhalten.
      */}
      <Physics timeStep={PHYSIK_DT} interpolate debug={DEBUG}>
        <Ground />
        <Car followRef={autoRef} />
      </Physics>

      <ChaseCamera ziel={autoRef} />
    </>
  );
}
