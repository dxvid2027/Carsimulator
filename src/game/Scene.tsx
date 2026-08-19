import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
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
import { Deko } from './world/Deko';
import { Offroad } from './world/Offroad';
import { Stuntpark } from './world/Stuntpark';
import {
  STUNTPARK,
  dorfOrt,
  felsenfeldOrt,
  stuntparkOrt,
  windmuehleOrt,
} from './world/orte';
import { Sonne } from './world/Sonne';
import { Heuballen } from './world/Heuballen';
import { SunLight, SONNE } from './world/SunLight';
import { Weltgrenze } from './world/Weltgrenze';
import { ebneFlaeche, erzeugeTerrain, type Terraindaten } from './world/heightmap';
import { erzeugeWelt, STRECKE, type Streckendaten } from './world/strecke';
import { baueStrassennetz, type Strassennetz } from './world/strassennetz';
import { OFFROAD, PISTEN_WEGE } from './world/Offroad';
import { RaceZone } from './race/RaceZone';
import { rennen, rennenAktualisieren, rennenVorbereiten } from './race/rennen';
import { ChaseCamera } from './camera/ChaseCamera';
import { telemetrie } from './telemetrie';

/**
 * Fügt zwischen Stützpunkten weitere Punkte ein.
 *
 * Die Geländepisten sind nur durch wenige Eckpunkte beschrieben. Für die
 * Abstandsprüfung braucht es Punkte im Abstand weniger Meter – sonst hätte
 * ein Busch mitten zwischen zwei Eckpunkten scheinbar freie Bahn.
 */
function verdichte(punkte: { x: number; z: number }[], abstand: number) {
  const dicht: { x: number; z: number }[] = [];
  for (let i = 0; i < punkte.length - 1; i++) {
    const a = punkte[i];
    const b = punkte[i + 1];
    const laenge = Math.hypot(b.x - a.x, b.z - a.z);
    const schritte = Math.max(1, Math.round(laenge / abstand));
    for (let k = 0; k < schritte; k++) {
      const t = k / schritte;
      dicht.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  dicht.push(punkte[punkte.length - 1]);
  return dicht;
}

/** Debug-Schalter: zeigt die Kollisionskörper als Drahtgitter (?debug in der URL). */
const DEBUG = new URLSearchParams(window.location.search).has('debug');

/** Auf Touchgeräten die teuren Effekte reduzieren. */
const SPARSAM = new URLSearchParams(window.location.search).has('sparsam');

// Im Entwicklungsmodus die Telemetrie in der Browser-Konsole verfügbar machen:
// einfach `telemetrie` in die Konsole tippen.
if (import.meta.env.DEV) {
  const w = window as unknown as { telemetrie: typeof telemetrie; rennen: typeof rennen };
  w.telemetrie = telemetrie;
  w.rennen = rennen;
}

/** Im Entwicklungsmodus die besonderen Orte in der Konsole bereitstellen. */
function OrteFuerEntwicklung({ terrain, netz }: { terrain: Terraindaten; netz: Strassennetz }) {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { orte: unknown }).orte = {
      stuntpark: stuntparkOrt(terrain, netz),
      dorf: dorfOrt(terrain, netz),
      windmuehle: windmuehleOrt(terrain, netz),
      felsenfeld: felsenfeldOrt(terrain, netz),
    };
  }, [terrain, netz]);
  return null;
}

/**
 * Schreibt den Rennzustand jeden Frame fort.
 * Eigene Komponente, damit useFrame innerhalb des Canvas läuft.
 */
function RennenTakt({ pausiert }: { pausiert: boolean }) {
  /*
    Eigene Uhr statt des Frame-Deltas von react-three-fiber.

    Das Frame-Delta wird anderswo auf 0,1 s begrenzt, damit die Kamera nach
    einem Tab-Wechsel nicht springt. Für eine Stoppuhr wäre das falsch: Auf
    einem Gerät mit 5 Bildern pro Sekunde liefe die Rundenzeit nur halb so
    schnell. Deshalb messen wir hier echte Zeit.
  */
  const letzterZeitpunkt = useRef<number | null>(null);

  useFrame(() => {
    if (pausiert) {
      // Nach der Pause neu ansetzen, damit die Pausendauer nicht mitzählt
      letzterZeitpunkt.current = null;
      return;
    }
    const jetzt = performance.now();
    let dt = letzterZeitpunkt.current === null ? 0 : (jetzt - letzterZeitpunkt.current) / 1000;
    letzterZeitpunkt.current = jetzt;
    /*
      Sehr große Lücken nicht mitzählen (Tab im Hintergrund, Gerät gesperrt).
      Die Schwelle ist bewusst großzügig: Ein Rechner, der nur 2 Bilder pro
      Sekunde schafft, liefert Frames von 0,5 s – die dürfen nicht verworfen
      werden, sonst bliebe die Uhr auf schwachen Geräten einfach stehen.
    */
    if (dt > 2) dt = 0;

    rennenAktualisieren(dt, telemetrie.position, telemetrie.tempoKmh);
  });
  return null;
}

interface SceneProps {
  /** Steht die Physik still? (Startbildschirm oder Pausemenü offen) */
  pausiert: boolean;
  /** Weniger Effekte für schwächere Geräte. */
  sparsam?: boolean;
  /** Wird mit der erzeugten Welt aufgerufen – die Karte braucht Terrain und Strecke. */
  onWeltFertig?: (welt: {
    terrain: Terraindaten;
    strecke: Streckendaten;
    nebenstrassen: Streckendaten[];
    netz: Strassennetz;
  }) => void;
}

export function Scene({ pausiert, sparsam, onWeltFertig }: SceneProps) {
  /** Das sichtbare Auto – die Kamera folgt diesem Objekt. */
  const autoRef = useRef<Object3D>(null);

  /**
   * Welt einmal berechnen und dann behalten.
   *
   * Die Reihenfolge ist wichtig: Erst das Terrain, dann die Strecke – denn die
   * Strecke liest ihre Höhe aus dem Terrain und schneidet sich anschließend
   * hinein. Erst danach darf der Kollisionskörper gebaut werden.
   */
  const { terrain, strecke, nebenstrassen, netz } = useMemo(() => {
    const t = erzeugeTerrain();
    const { strecke: s, nebenstrassen: n } = erzeugeWelt(t);
    // Kontrollpunkte und Bestzeit vorbereiten – das Rennen selbst startet erst,
    // wenn der Spieler in die Startzone fährt.
    rennenVorbereiten(s);

    /*
      Das Straßennetz kennt ALLE Fahrwege: Rundkurs, Nebenstraßen und
      Geländepisten. Bäume, Felsen, Büsche, Heuballen und Leitplanken fragen
      es, bevor sie sich irgendwo hinstellen – sonst wachsen Büsche mitten auf
      der Nebenstraße und Leitplanken sperren die Geländepiste ab.

      Die Pisten bekommen etwas mehr Breite mitgegeben als sie sichtbar haben,
      damit auch neben der Spur genug Platz zum Ausweichen bleibt.
    */
    const netz = baueStrassennetz([
      { punkte: s.punkte, breite: STRECKE.breite + STRECKE.bankett * 2 },
      ...n.map((strasse) => ({ punkte: strasse.punkte, breite: 8.5 + 5 })),
      ...PISTEN_WEGE().map((weg) => ({
        // Die Stützpunkte der Pisten sind grob – für den Abstand fein genug,
        // wenn wir dazwischen ein paar Punkte einfügen
        punkte: verdichte(weg, 6),
        breite: OFFROAD.pistenBreite + 6,
      })),
    ]);

    /*
      Der Stuntpark bekommt ebenen Boden.

      Rampen, Plattform und Container sind gerade Körper. Stehen sie im Hang,
      hängt eine Ecke in der Luft und man springt daneben. Deshalb wird die
      Fläche VOR dem Bau des Kollisionskörpers eingeebnet – danach wäre es zu
      spät, weil das Terrain-Mesh und die Physik die alten Höhen behalten.
    */
    const park = stuntparkOrt(t, netz);
    ebneFlaeche(t, park.x, park.z, STUNTPARK.radius, STUNTPARK.uebergang);

    return { terrain: t, strecke: s, nebenstrassen: n, netz };
  }, []);

  // Welt einmal nach oben reichen, damit die Karte sie zeichnen kann
  useEffect(() => {
    onWeltFertig?.({ terrain, strecke, nebenstrassen, netz });
  }, [terrain, strecke, nebenstrassen, netz, onWeltFertig]);

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

      <Sonne />
      <OrteFuerEntwicklung terrain={terrain} netz={netz} />

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
        {nebenstrassen.map((n, i) => (
          <Road key={i} strecke={n} terrain={terrain} geschlossen={false} breite={8.5} />
        ))}
        <Leitplanken strecke={strecke} terrain={terrain} netz={netz} />
        <Baeume terrain={terrain} netz={netz} />
        <Heuballen terrain={terrain} strecke={strecke} netz={netz} />
        <Deko terrain={terrain} netz={netz} />
        <Offroad terrain={terrain} strecke={strecke} netz={netz} />
        <Stuntpark terrain={terrain} netz={netz} />
        <Weltgrenze />
        <Car followRef={autoRef} strecke={strecke} />
      </Physics>

      <RaceZone />

      {/* Rennlogik jeden Frame fortschreiben (nur wenn nicht pausiert) */}
      <RennenTakt pausiert={pausiert} />

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
