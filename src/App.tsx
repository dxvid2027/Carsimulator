import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping } from 'three';
import { Scene } from './game/Scene';
import { Hud } from './game/ui/Hud';
import { TouchControls } from './game/ui/TouchControls';
import { istTouchGeraet } from './game/input/touchInput';

/** Einmal beim Start ermitteln – das ändert sich während des Spiels nicht. */
const TOUCH = istTouchGeraet();

function Ladeanzeige() {
  return (
    <div className="laden">
      <div>Physik wird geladen …</div>
      <div className="laden-balken" />
    </div>
  );
}

export default function App() {
  // Markiert den Body, damit das CSS die Tastatur-Hilfe ausblenden und den
  // Tacho über die Pedale schieben kann.
  useEffect(() => {
    document.body.classList.toggle('touch-modus', TOUCH);
  }, []);

  return (
    <>
      <Canvas
        shadows
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
        dpr={TOUCH ? [1, 1.5] : [1, 2]}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>

      {/* Fällt zurück, solange das Rapier-WASM-Modul lädt */}
      <Suspense fallback={<Ladeanzeige />}>
        <Hud />
      </Suspense>

      {TOUCH && <TouchControls />}
    </>
  );
}
