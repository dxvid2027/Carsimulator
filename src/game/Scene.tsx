import { useMemo, useRef } from 'react';
import { Environment, Lightformer } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import type { Object3D } from 'three';
import { PHYSIK_DT } from './config/vehicleConfig';
import { Car } from './vehicle/Car';
import { Terrain } from './world/Terrain';
import { SunLight } from './world/SunLight';
import { Weltgrenze } from './world/Weltgrenze';
import { erzeugeTerrain } from './world/heightmap';
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

  /**
   * Die Heightmap wird einmal berechnet und dann behalten.
   * useMemo verhindert, dass sie bei jedem Render neu erzeugt wird –
   * das würde 257 × 257 Höhenwerte pro Frame kosten.
   */
  const terrain = useMemo(() => erzeugeTerrain(), []);

  return (
    <>
      {/* ---------- Beleuchtung ---------- */}
      <hemisphereLight args={['#bcd7ff', '#4a4535', 0.55]} />
      <SunLight ziel={autoRef} />

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
      <fog attach="fog" args={['#8fb4d8', 160, 900]} />

      {/* ---------- Physik ---------- */}
      {/*
        timeStep fest auf 1/60: Die Fahrphysik rechnet mit genau diesem Wert
        (PHYSIK_DT). Bei variablem Zeitschritt würde sich das Auto auf
        schnellen und langsamen Rechnern unterschiedlich verhalten.
      */}
      <Physics timeStep={PHYSIK_DT} interpolate debug={DEBUG}>
        <Terrain daten={terrain} />
        <Weltgrenze />
        <Car followRef={autoRef} terrain={terrain} />
      </Physics>

      <ChaseCamera ziel={autoRef} />
    </>
  );
}
