import { useMemo, useRef } from 'react';
import { Environment, Sky } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import {
  Bloom,
  EffectComposer,
  N8AO,
  SMAA,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import type { Object3D } from 'three';
import { PHYSIK_DT } from './config/vehicleConfig';
import { Car } from './vehicle/Car';
import { Terrain } from './world/Terrain';
import { Road } from './world/Road';
import { Leitplanken } from './world/Leitplanken';
import { Baeume } from './world/Baeume';
import { SunLight, SONNE } from './world/SunLight';
import { Weltgrenze } from './world/Weltgrenze';
import { erzeugeTerrain } from './world/heightmap';
import { erzeugeWelt } from './world/strecke';
import { ChaseCamera } from './camera/ChaseCamera';
import { telemetrie } from './telemetrie';

/** Debug-Schalter: zeigt die Kollisionskörper als Drahtgitter (?debug in der URL). */
const DEBUG = new URLSearchParams(window.location.search).has('debug');

/** Auf Touchgeräten die teuren Effekte reduzieren. */
const SPARSAM = new URLSearchParams(window.location.search).has('sparsam');

// Im Entwicklungsmodus die Telemetrie in der Browser-Konsole verfügbar machen:
// einfach `telemetrie` in die Konsole tippen.
if (import.meta.env.DEV) {
  (window as unknown as { telemetrie: typeof telemetrie }).telemetrie = telemetrie;
}

interface SceneProps {
  /** Steht die Physik still? (Startbildschirm oder Pausemenü offen) */
  pausiert: boolean;
  /** Weniger Effekte für schwächere Geräte. */
  sparsam?: boolean;
}

export function Scene({ pausiert, sparsam }: SceneProps) {
  /** Das sichtbare Auto – die Kamera folgt diesem Objekt. */
  const autoRef = useRef<Object3D>(null);

  /**
   * Welt einmal berechnen und dann behalten.
   *
   * Die Reihenfolge ist wichtig: Erst das Terrain, dann die Strecke – denn die
   * Strecke liest ihre Höhe aus dem Terrain und schneidet sich anschließend
   * hinein. Erst danach darf der Kollisionskörper gebaut werden.
   */
  const { terrain, strecke } = useMemo(() => {
    const t = erzeugeTerrain();
    const s = erzeugeWelt(t);
    return { terrain: t, strecke: s };
  }, []);

  const wenigEffekte = sparsam || SPARSAM;

  return (
    <>
      {/* ---------- Beleuchtung ---------- */}
      <hemisphereLight args={['#bcd7ff', '#4a4535', 0.42]} />
      <SunLight ziel={autoRef} />

      {/*
        Echtes HDRI aus dem Ordner `public` – aber NUR fürs Licht, nicht als
        sichtbarer Himmel.

        Warum? Ein HDRI ist ein Rundum-Foto eines echten Ortes. Als Hintergrund
        sieht man darin dann Gehwege, Häuser und Passanten – das passt nicht zu
        einer Hügellandschaft und fällt sofort auf, sobald die Kamera schwenkt.
        Für Spiegelungen und Umgebungslicht ist es dagegen genau richtig.
        Siehe public/ASSETS.md.
      */}
      <Environment files="/venice_sunset_1k.hdr" environmentIntensity={0.8} />

      {/*
        Der sichtbare Himmel wird stattdessen berechnet (Streuung des
        Sonnenlichts in der Atmosphäre). Er sieht aus jeder Blickrichtung
        richtig aus und braucht keine Datei.
        sunPosition muss zur Richtung von SunLight passen, sonst kommt das
        Licht sichtbar aus einer anderen Ecke als die Sonne am Himmel steht.
      */}
      <Sky
        sunPosition={[SONNE.x, SONNE.y, SONNE.z]}
        turbidity={2.6}
        rayleigh={2.4}
        mieCoefficient={0.004}
        mieDirectionalG={0.8}
        distance={4000}
      />

      {/* Nebel in der Farbe des Horizonts, damit die Kartenkante verschwimmt */}
      <fog attach="fog" args={['#c8d6e2', 340, 1250]} />

      {/* ---------- Physik und Welt ---------- */}
      {/*
        timeStep fest auf 1/60: Die Fahrphysik rechnet mit genau diesem Wert
        (PHYSIK_DT). Bei variablem Zeitschritt würde sich das Auto auf
        schnellen und langsamen Rechnern unterschiedlich verhalten.
      */}
      <Physics timeStep={PHYSIK_DT} interpolate paused={pausiert} debug={DEBUG}>
        <Terrain daten={terrain} />
        <Road strecke={strecke} terrain={terrain} />
        <Leitplanken strecke={strecke} terrain={terrain} />
        <Baeume terrain={terrain} strecke={strecke} />
        <Weltgrenze />
        <Car followRef={autoRef} strecke={strecke} />
      </Physics>

      <ChaseCamera ziel={autoRef} />

      {/* ---------- Bildnachbearbeitung ---------- */}
      {/*
        Reihenfolge ist wichtig: erst Umgebungsverschattung, dann Leuchten,
        dann die Tonwertkurve, zum Schluss Kantenglättung.
        multisampling={0}, weil SMAA die Kanten übernimmt – das ist auf
        schwächeren Geräten deutlich billiger als MSAA.
      */}
      <EffectComposer multisampling={0} enableNormalPass>
        {wenigEffekte ? (
          <>
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            <SMAA />
          </>
        ) : (
          <>
            {/* N8AO: Umgebungsverschattung – setzt Auto, Bäume und Planken
                sichtbar auf den Boden statt sie schweben zu lassen */}
            <N8AO aoRadius={2.2} intensity={2.4} distanceFalloff={0.8} halfRes />
            <Bloom
              intensity={0.42}
              luminanceThreshold={0.78}
              luminanceSmoothing={0.28}
              mipmapBlur
            />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            <Vignette offset={0.28} darkness={0.42} />
            <SMAA />
          </>
        )}
      </EffectComposer>
    </>
  );
}
