import { useEffect, useRef } from 'react';
import { telemetrie } from '../telemetrie';
import { kameraStatus } from '../camera/ChaseCamera';
import { FAHRZEUG } from '../config/vehicleConfig';

/**
 * Das HUD liegt als normales HTML über dem 3D-Canvas.
 *
 * Es aktualisiert sich in einer eigenen requestAnimationFrame-Schleife und
 * schreibt direkt in die DOM-Knoten. So löst es kein einziges React-Render aus –
 * wichtig, damit die Anzeige nicht die Bildrate kostet.
 */
export function Hud() {
  const tempoRef = useRef<HTMLDivElement>(null);
  const gangRef = useRef<HTMLDivElement>(null);
  const drehzahlRef = useRef<HTMLDivElement>(null);
  const driftRef = useRef<HTMLDivElement>(null);
  const kameraRef = useRef<HTMLSpanElement>(null);
  const fpsRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let id = 0;
    let letzterFrame = performance.now();
    let fpsMittel = 60;

    const tick = () => {
      const jetzt = performance.now();
      const delta = jetzt - letzterFrame;
      letzterFrame = jetzt;
      if (delta > 0) fpsMittel += (1000 / delta - fpsMittel) * 0.05;

      if (tempoRef.current) tempoRef.current.textContent = String(Math.round(telemetrie.tempoKmh));

      if (gangRef.current) {
        const g = telemetrie.gang;
        gangRef.current.textContent = g === -1 ? 'R' : g === 0 ? 'N' : String(g);
      }

      if (drehzahlRef.current) {
        const anteil = Math.min(1, telemetrie.drehzahl / FAHRZEUG.getriebe.maxDrehzahl);
        drehzahlRef.current.style.setProperty('--fuellung', String(anteil));
        // Ab 85 % Drehzahl rot einfärben (Schaltempfehlung)
        drehzahlRef.current.style.setProperty('--farbe', anteil > 0.85 ? '#ff3b30' : '#4fc3f7');
      }

      if (driftRef.current) {
        const driftet = telemetrie.schraeglauf > 15;
        driftRef.current.style.opacity = driftet ? '1' : '0';
        driftRef.current.textContent = `DRIFT ${Math.round(telemetrie.schraeglauf)}°`;
      }

      if (kameraRef.current) kameraRef.current.textContent = kameraStatus.name;
      if (fpsRef.current) fpsRef.current.textContent = String(Math.round(fpsMittel));

      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="hud">
      <div className="hud-tacho">
        <div className="hud-drehzahl" ref={drehzahlRef} />
        <div className="hud-tempo">
          <div className="hud-tempo-zahl" ref={tempoRef}>
            0
          </div>
          <div className="hud-tempo-einheit">km/h</div>
        </div>
        <div className="hud-gang" ref={gangRef}>
          N
        </div>
      </div>

      <div className="hud-drift" ref={driftRef}>
        DRIFT
      </div>

      <div className="hud-hilfe">
        <div className="hud-zeile">
          <b>W A S D</b> drive <span className="sep">·</span> <b>Space</b> handbrake
        </div>
        <div className="hud-zeile">
          <b>C</b> camera (<span ref={kameraRef}>Chase</span>) <span className="sep">·</span>{' '}
          <b>R</b> reset <span className="sep">·</span> <b>Esc</b> pause
        </div>
        <div className="hud-zeile">
          <span ref={fpsRef}>60</span> FPS
        </div>
      </div>
    </div>
  );
}
