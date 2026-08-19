import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping } from 'three';
import { Scene } from './game/Scene';
import { Hud } from './game/ui/Hud';

function Ladeanzeige() {
  return (
    <div className="laden">
      <div>Physik wird geladen …</div>
      <div className="laden-balken" />
    </div>
  );
}

export default function App() {
  return (
    <>
      <Canvas
        shadows
        // Die Kamera wird ab dem ersten Frame von der ChaseCamera gesteuert
        camera={{ position: [0, 4, -10], fov: 62, near: 0.3, far: 900 }}
        gl={{
          antialias: true,
          // ACES Filmic: filmische Tonwertkurve, verhindert ausgebrannte Lichter
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        // Auf Bildschirmen mit hoher Pixeldichte nicht über 2x rendern (Leistung)
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>

      {/* Fällt zurück, solange das Rapier-WASM-Modul lädt */}
      <Suspense fallback={<Ladeanzeige />}>
        <Hud />
      </Suspense>
    </>
  );
}
