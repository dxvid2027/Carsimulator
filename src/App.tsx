import { Suspense, useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping } from 'three';
import { Scene } from './game/Scene';
import { Hud } from './game/ui/Hud';
import { TouchControls } from './game/ui/TouchControls';
import { StartScreen } from './game/ui/StartScreen';
import { PauseMenu } from './game/ui/PauseMenu';
import { RaceHud } from './game/ui/RaceHud';
import { Minimap } from './game/ui/Minimap';
import type { Streckendaten } from './game/world/strecke';
import { rennen, rennenBeenden, rennenStarten } from './game/race/rennen';
import { touchEingabe } from './game/input/touchInput';
import {
  gespeicherteSteuerung,
  speichereSteuerung,
  vorschlagSteuerung,
  type Phase,
  type Steuerungsart,
} from './game/spielzustand';

/** Vom Gerät abgeleiteter Vorschlag – nur einmal beim Laden bestimmen. */
const VORSCHLAG = vorschlagSteuerung();

function Ladeanzeige() {
  return (
    <div className="laden">
      <div>Loading physics …</div>
      <div className="laden-balken" />
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('start');
  const [steuerung, setSteuerung] = useState<Steuerungsart>(
    () => gespeicherteSteuerung() ?? VORSCHLAG,
  );
  /** Die Strecke kommt aus der 3D-Szene und wird für die Minimap gebraucht. */
  const [strecke, setStrecke] = useState<Streckendaten | null>(null);

  const touch = steuerung === 'touch';

  /*
    Der Body bekommt eine Klasse, damit das CSS die Tastatur-Hilfe ausblenden
    und den Tacho über die Pedale schieben kann.
  */
  useEffect(() => {
    document.body.classList.toggle('touch-modus', touch);
  }, [touch]);

  const pausieren = useCallback(() => {
    setPhase((p) => (p === 'laeuft' ? 'pause' : p));
  }, []);

  const fortsetzen = useCallback(() => {
    setPhase((p) => (p === 'pause' ? 'laeuft' : p));
  }, []);

  /*
    Taste E: In der Startzone startet sie das Rennen, im Ergebnisbildschirm
    schließt sie es. Sonst passiert nichts – freies Fahren bleibt der
    Grundzustand.
  */
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE') return;
      if (rennen.phase === 'bereit') rennenStarten();
      else if (rennen.phase === 'beendet') rennenBeenden();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, []);

  // Esc oder P pausiert, Esc im Pausemenü setzt fort
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.code !== 'Escape' && e.code !== 'KeyP') return;
      e.preventDefault();
      setPhase((p) => (p === 'laeuft' ? 'pause' : p === 'pause' ? 'laeuft' : p));
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, []);

  /*
    Wechselt der Spieler den Tab oder legt das iPad weg, pausieren wir.
    Ohne das läuft das Auto im Hintergrund weiter gegen die nächste Wand.
  */
  useEffect(() => {
    const sichtbarkeit = () => {
      if (document.hidden) pausieren();
    };
    document.addEventListener('visibilitychange', sichtbarkeit);
    return () => document.removeEventListener('visibilitychange', sichtbarkeit);
  }, [pausieren]);

  const starten = (art: Steuerungsart) => {
    setSteuerung(art);
    speichereSteuerung(art);
    setPhase('laeuft');
  };

  const steuerungWechseln = (art: Steuerungsart) => {
    setSteuerung(art);
    speichereSteuerung(art);
    // Hängengebliebene Touch-Eingaben löschen, sonst gibt das Auto ewig Gas
    touchEingabe.gas = 0;
    touchEingabe.bremse = 0;
    touchEingabe.lenken = 0;
    touchEingabe.handbremse = false;
  };

  const laeuft = phase === 'laeuft';

  return (
    <>
      <Canvas
        shadows="soft"
        // Die Kamera wird ab dem ersten Frame von der ChaseCamera gesteuert
        camera={{ position: [0, 4, -10], fov: 62, near: 0.3, far: 2000 }}
        gl={{
          antialias: true,
          // ACES Filmic: filmische Tonwertkurve, verhindert ausgebrannte Lichter
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        /*
          Auflösung begrenzen. Ein iPad rendert sonst mit doppelter Pixeldichte,
          also viermal so vielen Pixeln – das kostet auf Tablets zu viel
          Leistung für zu wenig sichtbaren Gewinn.
        */
        dpr={touch ? [1, 1.5] : [1, 2]}
      >
        <Suspense fallback={null}>
          {/* Solange der Startbildschirm offen ist, steht die Physik still */}
          <Scene pausiert={!laeuft} onWeltFertig={setStrecke} />
        </Suspense>
      </Canvas>

      <Suspense fallback={<Ladeanzeige />}>
        <Hud />
      </Suspense>

      {laeuft && <RaceHud />}

      {laeuft && strecke && <Minimap strecke={strecke} />}

      {touch && laeuft && <TouchControls onPause={pausieren} />}

      {phase === 'start' && <StartScreen vorschlag={VORSCHLAG} onStart={starten} />}

      {phase === 'pause' && (
        <PauseMenu
          steuerung={steuerung}
          onFortsetzen={fortsetzen}
          onZuruecksetzen={() => {
            touchEingabe.reset = true;
            fortsetzen();
          }}
          onSteuerungWechseln={steuerungWechseln}
        />
      )}
    </>
  );
}
