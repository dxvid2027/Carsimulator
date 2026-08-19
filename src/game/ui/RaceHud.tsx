import { useEffect, useRef } from 'react';
import {
  RENNEN_EINSTELLUNGEN,
  rennen,
  rennenBeenden,
  rennenStarten,
  zeitText,
} from '../race/rennen';

/**
 * Oberfläche des Rennens.
 *
 * Beim freien Fahren ist hier nichts zu sehen. Erst wenn man in die Startzone
 * fährt, erscheint die Einladung; während des Rennens Runde und Zeiten.
 *
 * Wie das Tacho-HUD aktualisiert sich alles in einer eigenen
 * Animationsschleife und schreibt direkt in die DOM-Knoten – ohne React-Render.
 */
export function RaceHud() {
  const einladung = useRef<HTMLDivElement>(null);
  const countdown = useRef<HTMLDivElement>(null);
  const tafel = useRef<HTMLDivElement>(null);
  const ergebnis = useRef<HTMLDivElement>(null);

  const rundeText = useRef<HTMLSpanElement>(null);
  const zeitLaufend = useRef<HTMLDivElement>(null);
  const zeitLetzte = useRef<HTMLSpanElement>(null);
  const zeitBeste = useRef<HTMLSpanElement>(null);
  const ergebnisGesamt = useRef<HTMLDivElement>(null);
  const ergebnisBeste = useRef<HTMLSpanElement>(null);
  const ergebnisRekord = useRef<HTMLDivElement>(null);
  const einladungHinweis = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let id = 0;
    const zeigen = (el: HTMLElement | null, an: boolean) => {
      if (el) el.style.display = an ? '' : 'none';
    };

    const tick = () => {
      const p = rennen.phase;

      zeigen(einladung.current, p === 'bereit' || (p === 'frei' && rennen.inZone));
      zeigen(countdown.current, p === 'countdown');
      zeigen(tafel.current, p === 'laeuft');
      zeigen(ergebnis.current, p === 'beendet');

      if (p === 'frei' && rennen.inZone && einladungHinweis.current) {
        einladungHinweis.current.textContent = 'Slow down to start';
      } else if (einladungHinweis.current) {
        einladungHinweis.current.textContent = '';
      }

      if (p === 'countdown' && countdown.current) {
        const rest = Math.ceil(rennen.countdownRest);
        countdown.current.textContent = rest > 0 ? String(rest) : 'GO';
      }

      if (p === 'laeuft') {
        if (rundeText.current) {
          rundeText.current.textContent = `${rennen.runde} / ${RENNEN_EINSTELLUNGEN.runden}`;
        }
        if (zeitLaufend.current) zeitLaufend.current.textContent = zeitText(rennen.rundenzeit);
        if (zeitLetzte.current) zeitLetzte.current.textContent = zeitText(rennen.letzteRunde);
        if (zeitBeste.current) zeitBeste.current.textContent = zeitText(rennen.besteRunde);
      }

      if (p === 'beendet') {
        if (ergebnisGesamt.current) ergebnisGesamt.current.textContent = zeitText(rennen.gesamtzeit);
        if (ergebnisBeste.current) ergebnisBeste.current.textContent = zeitText(rennen.besteRunde);
        if (ergebnisRekord.current) {
          const neu = rennen.besteRunde > 0 && rennen.besteRunde <= rennen.bestzeit;
          ergebnisRekord.current.style.display = neu ? '' : 'none';
        }
      }

      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="rennen">
      {/* ---------- Einladung in der Startzone ---------- */}
      <div className="rennen-einladung" ref={einladung} style={{ display: 'none' }}>
        <div className="rennen-einladung-titel">Race start</div>
        <div className="rennen-einladung-text">
          {RENNEN_EINSTELLUNGEN.runden} laps around the circuit
        </div>
        <div className="rennen-einladung-hinweis" ref={einladungHinweis} />
        <button className="rennen-knopf" onClick={rennenStarten}>
          Start race
          <span className="rennen-taste">E</span>
        </button>
      </div>

      {/* ---------- Countdown ---------- */}
      <div className="rennen-countdown" ref={countdown} style={{ display: 'none' }}>
        3
      </div>

      {/* ---------- Laufendes Rennen ---------- */}
      <div className="rennen-tafel" ref={tafel} style={{ display: 'none' }}>
        <div className="rennen-zeile">
          <span className="rennen-label">Lap</span>
          <span className="rennen-wert" ref={rundeText}>
            1 / 2
          </span>
        </div>
        <div className="rennen-zeit" ref={zeitLaufend}>
          0:00.000
        </div>
        <div className="rennen-zeile klein">
          <span className="rennen-label">Last</span>
          <span ref={zeitLetzte}>--:--.---</span>
        </div>
        <div className="rennen-zeile klein">
          <span className="rennen-label">Best</span>
          <span ref={zeitBeste}>--:--.---</span>
        </div>
        <button className="rennen-abbrechen" onClick={rennenBeenden}>
          Quit race
        </button>
      </div>

      {/* ---------- Ergebnis ---------- */}
      <div className="rennen-ergebnis" ref={ergebnis} style={{ display: 'none' }}>
        <div className="rennen-ergebnis-titel">Finished</div>
        <div className="rennen-ergebnis-zeit" ref={ergebnisGesamt}>
          0:00.000
        </div>
        <div className="rennen-ergebnis-zeile">
          Best lap <span ref={ergebnisBeste}>--:--.---</span>
        </div>
        <div className="rennen-ergebnis-rekord" ref={ergebnisRekord} style={{ display: 'none' }}>
          New personal best
        </div>
        <button className="rennen-knopf" onClick={rennenBeenden}>
          Back to free roam
          <span className="rennen-taste">E</span>
        </button>
      </div>
    </div>
  );
}
