import { useState } from 'react';
import type { Steuerungsart } from '../spielzustand';
import { Logo } from './Logo';

interface StartScreenProps {
  /** Vorauswahl anhand des Geräts. */
  vorschlag: Steuerungsart;
  /** Wird aufgerufen, wenn der Spieler startet. */
  onStart: (art: Steuerungsart) => void;
}

/**
 * Startbildschirm mit Wahl der Steuerung.
 *
 * Er hat noch einen zweiten Zweck: Ein Browser gibt einer Seite erst dann
 * zuverlässig Tastatur-Fokus, wenn der Nutzer sie einmal angeklickt hat.
 * Ohne Startbildschirm passiert es leicht, dass man WASD drückt und nichts
 * geschieht, weil der Klick ins Bild fehlt.
 */
export function StartScreen({ vorschlag, onStart }: StartScreenProps) {
  const [gewaehlt, setGewaehlt] = useState<Steuerungsart>(vorschlag);

  return (
    <div className="start">
      <div className="start-box">
        <div className="start-logo">
          <Logo groesse={96} />
        </div>
        <div className="start-titel">Carsimulator</div>
        <div className="start-untertitel">Open world driving</div>

        <div className="start-frage">How are you playing?</div>

        <div className="start-wahl">
          <button
            className={`start-karte ${gewaehlt === 'keyboard' ? 'aktiv' : ''}`}
            onClick={() => setGewaehlt('keyboard')}
          >
            <div className="start-karte-symbol">⌨</div>
            <div className="start-karte-titel">Keyboard</div>
            <div className="start-karte-text">
              PC or laptop.
              <br />
              Gamepads work too.
            </div>
            {vorschlag === 'keyboard' && <div className="start-karte-tipp">detected</div>}
          </button>

          <button
            className={`start-karte ${gewaehlt === 'touch' ? 'aktiv' : ''}`}
            onClick={() => setGewaehlt('touch')}
          >
            <div className="start-karte-symbol">☝</div>
            <div className="start-karte-titel">Touch</div>
            <div className="start-karte-text">
              Tablet or phone.
              <br />
              On-screen controls.
            </div>
            {vorschlag === 'touch' && <div className="start-karte-tipp">detected</div>}
          </button>
        </div>

        <div className="start-hilfe">
          {gewaehlt === 'keyboard' ? (
            <>
              <div>
                <b>W A S D</b> or arrow keys to drive
              </div>
              <div>
                <b>Space</b> handbrake · <b>T</b> turn · <b>M</b> map · <b>Esc</b> pause
              </div>
            </>
          ) : (
            <>
              <div>Drag the left pad to steer, pedals on the right</div>
              <div>Best played in landscape</div>
            </>
          )}
        </div>

        <button className="start-knopf" onClick={() => onStart(gewaehlt)}>
          Start driving
        </button>

        <div className="start-fuss">
          Drive wherever you like. For a timed race, find the glowing gate on the road.
        </div>
      </div>
    </div>
  );
}
