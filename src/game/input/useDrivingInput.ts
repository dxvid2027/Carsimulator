import { useEffect, useRef } from 'react';
import { touchEingabe } from './touchInput';

/** Der aufbereitete Fahrer-Input, den die Fahrzeugphysik jeden Schritt liest. */
export interface FahrEingabe {
  /** Gas: 0 bis 1 */
  gas: number;
  /** Bremse / Rückwärts: 0 bis 1 */
  bremse: number;
  /** Lenkung: -1 (rechts) bis +1 (links). Positiv = links, siehe vehicleConfig. */
  lenken: number;
  /** Handbremse gedrückt? */
  handbremse: boolean;
  /** Reset angefordert (Taste R) – wird nach dem Auswerten zurückgesetzt. */
  reset: boolean;
  /** Wenden auf der Stelle angefordert (Taste T). */
  wenden: boolean;
}

/** Tastenzuordnung. `code` ist layout-unabhängig (funktioniert auch auf QWERTZ). */
const TASTEN = {
  gas: ['KeyW', 'ArrowUp'],
  bremse: ['KeyS', 'ArrowDown'],
  links: ['KeyA', 'ArrowLeft'],
  rechts: ['KeyD', 'ArrowRight'],
  handbremse: ['Space'],
  reset: ['KeyR'],
  wenden: ['KeyT'],
};

/**
 * Liest Tastatur und (optional) Gamepad aus.
 *
 * Gibt bewusst ein Ref-Objekt zurück und kein React-State: Der Input ändert sich
 * 60-mal pro Sekunde – ein State-Update pro Frame würde die ganze Szene neu
 * rendern und Leistung kosten.
 */
export function useDrivingInput() {
  const eingabe = useRef<FahrEingabe>({
    gas: 0,
    bremse: 0,
    lenken: 0,
    handbremse: false,
    reset: false,
    wenden: false,
  });
  /** Aktuell gedrückte Tasten. */
  const gedrueckt = useRef(new Set<string>());

  useEffect(() => {
    const runter = (e: KeyboardEvent) => {
      // Pfeiltasten und Leertaste würden sonst die Seite scrollen
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      gedrueckt.current.add(e.code);
    };
    const hoch = (e: KeyboardEvent) => gedrueckt.current.delete(e.code);
    /** Wenn das Fenster den Fokus verliert, alle Tasten loslassen. */
    const fokusWeg = () => gedrueckt.current.clear();

    window.addEventListener('keydown', runter);
    window.addEventListener('keyup', hoch);
    window.addEventListener('blur', fokusWeg);
    return () => {
      window.removeEventListener('keydown', runter);
      window.removeEventListener('keyup', hoch);
      window.removeEventListener('blur', fokusWeg);
    };
  }, []);

  /**
   * Muss einmal pro Frame aufgerufen werden. Mischt Tastatur und Gamepad
   * und schreibt das Ergebnis in `eingabe.current`.
   */
  const aktualisieren = () => {
    const t = gedrueckt.current;
    const an = (codes: string[]) => codes.some((c) => t.has(c));

    let gas = an(TASTEN.gas) ? 1 : 0;
    let bremse = an(TASTEN.bremse) ? 1 : 0;
    let lenken = (an(TASTEN.links) ? 1 : 0) - (an(TASTEN.rechts) ? 1 : 0);
    let handbremse = an(TASTEN.handbremse);
    let reset = an(TASTEN.reset);
    let wenden = an(TASTEN.wenden);

    // --- Touch-Bedienung (iPad, Handy) ---
    // Der jeweils stärkere Wert gewinnt, damit Tastatur und Finger sich nicht
    // gegenseitig ausbremsen, wenn beides vorhanden ist.
    gas = Math.max(gas, touchEingabe.gas);
    bremse = Math.max(bremse, touchEingabe.bremse);
    if (touchEingabe.lenken !== 0) lenken = touchEingabe.lenken;
    handbremse = handbremse || touchEingabe.handbremse;
    if (touchEingabe.reset) {
      reset = true;
      touchEingabe.reset = false; // nur einmal auslösen
    }
    if (touchEingabe.wenden) {
      wenden = true;
      touchEingabe.wenden = false;
    }

    // --- Gamepad (falls eines verbunden ist) ---
    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) {
      if (!pad) continue;
      // Standard-Gamepad-Belegung: RT = Button 7, LT = Button 6, A = Button 0
      const rt = pad.buttons[7]?.value ?? 0;
      const lt = pad.buttons[6]?.value ?? 0;
      const stick = pad.axes[0] ?? 0;
      // Totzone, damit ein leicht driftender Stick nicht dauernd lenkt
      const stickGefiltert = Math.abs(stick) < 0.12 ? 0 : stick;

      gas = Math.max(gas, rt);
      bremse = Math.max(bremse, lt);
      // Stick nach rechts (+1) soll nach rechts lenken -> Vorzeichen drehen
      if (stickGefiltert !== 0) lenken = -stickGefiltert;
      handbremse = handbremse || (pad.buttons[0]?.pressed ?? false);
      break; // nur das erste Gamepad benutzen
    }

    const e = eingabe.current;
    e.gas = gas;
    e.bremse = bremse;
    e.lenken = Math.max(-1, Math.min(1, lenken));
    e.handbremse = handbremse;
    e.reset = reset;
    e.wenden = wenden;
  };

  return { eingabe, aktualisieren };
}
