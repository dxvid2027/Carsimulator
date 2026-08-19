import { useEffect, useRef } from 'react';
import { touchEingabe } from '../input/touchInput';
import { kameraStatus } from '../camera/ChaseCamera';

/**
 * Bedienelemente für Touchgeräte (iPad, Handy).
 *
 * Aufbau:
 *   links  – eine Lenkzone. Wo du zuerst hintippst, ist die Mitte; ziehst du
 *            von dort nach links oder rechts, lenkt das Auto entsprechend.
 *            Dadurch musst du nicht zielen, sondern kannst blind bedienen.
 *   rechts – Gas, Bremse und Handbremse als Knöpfe.
 *
 * Alle Werte gehen in `touchEingabe`. Es wird kein React-State benutzt, damit
 * beim Lenken nicht 60-mal pro Sekunde die Oberfläche neu gerendert wird.
 */

/** Wie weit man ziehen muss (in Pixeln), bis der volle Lenkeinschlag anliegt. */
const LENKWEG = 75;

interface TouchControlsProps {
  /** Wird gedrückt, wenn der Spieler pausieren will. */
  onPause: () => void;
  /** Öffnet die große Karte. */
  onKarte: () => void;
}

export function TouchControls({ onPause, onKarte }: TouchControlsProps) {
  const lenkzone = useRef<HTMLDivElement>(null);
  const lenkKnopf = useRef<HTMLDivElement>(null);
  const kameraText = useRef<HTMLSpanElement>(null);

  // ---- Lenkung: relativer Joystick ----
  useEffect(() => {
    const zone = lenkzone.current;
    const knopf = lenkKnopf.current;
    if (!zone || !knopf) return;

    let zeigerId: number | null = null;
    let startX = 0;

    const start = (e: PointerEvent) => {
      if (zeigerId !== null) return; // nur ein Finger gleichzeitig
      zeigerId = e.pointerId;
      startX = e.clientX;
      /*
        Pointer Capture sorgt dafür, dass wir die Fingerbewegung auch dann noch
        bekommen, wenn der Finger die Lenkzone verlässt. Ohne das würde die
        Lenkung mitten in der Kurve hängen bleiben.

        Der try/catch ist nötig, weil der Browser einen Fehler wirft, wenn der
        Finger zwischen "pointerdown" und diesem Aufruf schon wieder weg ist –
        das passiert bei hektischen Eingaben durchaus.
      */
      try {
        zone.setPointerCapture(e.pointerId);
      } catch {
        // Nicht schlimm: dann eben ohne Capture weiter
      }
      knopf.style.opacity = '1';
      e.preventDefault();
    };

    const bewegen = (e: PointerEvent) => {
      if (e.pointerId !== zeigerId) return;
      const dx = e.clientX - startX;
      // Nach links ziehen = negatives dx = positiver Lenkwert (links)
      const wert = Math.max(-1, Math.min(1, -dx / LENKWEG));
      touchEingabe.lenken = wert;
      knopf.style.transform = `translateX(${-wert * LENKWEG}px)`;
      e.preventDefault();
    };

    const ende = (e: PointerEvent) => {
      if (e.pointerId !== zeigerId) return;
      zeigerId = null;
      touchEingabe.lenken = 0;
      knopf.style.transform = 'translateX(0px)';
      knopf.style.opacity = '0.45';
    };

    zone.addEventListener('pointerdown', start);
    zone.addEventListener('pointermove', bewegen);
    zone.addEventListener('pointerup', ende);
    zone.addEventListener('pointercancel', ende);
    return () => {
      zone.removeEventListener('pointerdown', start);
      zone.removeEventListener('pointermove', bewegen);
      zone.removeEventListener('pointerup', ende);
      zone.removeEventListener('pointercancel', ende);
      touchEingabe.lenken = 0;
    };
  }, []);

  /**
   * Macht aus einem Element einen Halte-Knopf.
   * `setzen` bekommt true beim Drücken und false beim Loslassen.
   */
  const halteKnopf = (setzen: (an: boolean) => void) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      // Siehe Kommentar oben: kann fehlschlagen, wenn der Finger schon weg ist
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignorieren
      }
      e.currentTarget.classList.add('gedrueckt');
      setzen(true);
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      e.currentTarget.classList.remove('gedrueckt');
      setzen(false);
    },
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => {
      e.currentTarget.classList.remove('gedrueckt');
      setzen(false);
    },
    // Verhindert, dass iOS beim Halten das Kontextmenü oder eine Textauswahl öffnet
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const kameraWechseln = () => {
    // Wir lösen dasselbe Tastenereignis aus, das die Kamera auch sonst schaltet.
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC' }));
    // Kurz warten, bis die Kamera umgeschaltet hat, dann Beschriftung anpassen
    requestAnimationFrame(() => {
      if (kameraText.current) kameraText.current.textContent = kameraStatus.name;
    });
  };

  return (
    <div className="touch">
      {/*
        Hinweis fürs Hochformat. Das Spiel ist im Querformat deutlich besser
        spielbar – hochkant besteht das halbe Bild aus Himmel und die
        Bedienelemente liegen weit auseinander. Der Hinweis blendet sich per
        CSS automatisch aus, sobald das Gerät quer gehalten wird.
      */}
      <div className="touch-drehen">
        <div className="touch-drehen-inhalt">
          <div className="touch-drehen-symbol">⟳</div>
          <div>Turn your device sideways</div>
          <div className="touch-drehen-klein">portrait works, landscape is better</div>
        </div>
      </div>
      {/* ---------- Lenken ---------- */}
      <div className="touch-lenken" ref={lenkzone}>
        <div className="touch-lenken-schiene" />
        <div className="touch-lenken-knopf" ref={lenkKnopf} />
        <div className="touch-lenken-text">drag to steer</div>
      </div>

      {/* ---------- Pedale ---------- */}
      <div className="touch-pedale">
        <button
          className="touch-knopf touch-handbremse"
          {...halteKnopf((an) => (touchEingabe.handbremse = an))}
        >
          Hand&shy;brake
        </button>
        <button
          className="touch-knopf touch-bremse"
          {...halteKnopf((an) => (touchEingabe.bremse = an ? 1 : 0))}
        >
          Brake
        </button>
        <button
          className="touch-knopf touch-gas"
          {...halteKnopf((an) => (touchEingabe.gas = an ? 1 : 0))}
        >
          Throttle
        </button>
      </div>

      {/* ---------- Kleine Knöpfe oben ---------- */}
      <div className="touch-oben">
        <button className="touch-klein" onClick={kameraWechseln}>
          <span ref={kameraText}>Chase</span>
        </button>
        <button
          className="touch-klein"
          onClick={() => {
            touchEingabe.wenden = true;
          }}
        >
          Turn
        </button>
        <button
          className="touch-klein"
          onClick={() => {
            touchEingabe.reset = true;
          }}
        >
          Reset
        </button>
        <button className="touch-klein" onClick={onKarte}>
          Map
        </button>
        <button className="touch-klein touch-pause" onClick={onPause}>
          ❚❚
        </button>
      </div>
    </div>
  );
}
