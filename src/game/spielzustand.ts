/**
 * Wie das Spiel gesteuert wird.
 * Wird auf dem Startbildschirm gewählt und danach nicht mehr geändert.
 */
export type Steuerungsart = 'keyboard' | 'touch';

/** In welcher Phase sich das Spiel befindet. */
export type Phase = 'start' | 'laeuft' | 'pause';

/** Schlüssel, unter dem die Wahl im Browser gespeichert wird. */
const SPEICHER_SCHLUESSEL = 'carsim.steuerung';

/**
 * Rät die passende Steuerung anhand des Geräts.
 * Das ist nur die Vorauswahl – entscheiden tut der Spieler.
 */
export function vorschlagSteuerung(): Steuerungsart {
  const params = new URLSearchParams(window.location.search);
  if (params.has('touch')) return 'touch';
  if (params.has('keyboard')) return 'keyboard';

  const grob = window.matchMedia('(pointer: coarse)').matches;
  const keineMaus = !window.matchMedia('(hover: hover)').matches;
  return grob && keineMaus ? 'touch' : 'keyboard';
}

/** Liest die zuletzt gewählte Steuerung, falls vorhanden. */
export function gespeicherteSteuerung(): Steuerungsart | null {
  try {
    const wert = localStorage.getItem(SPEICHER_SCHLUESSEL);
    return wert === 'keyboard' || wert === 'touch' ? wert : null;
  } catch {
    // localStorage kann im privaten Modus gesperrt sein – dann eben ohne
    return null;
  }
}

/** Merkt sich die Wahl für den nächsten Besuch. */
export function speichereSteuerung(art: Steuerungsart) {
  try {
    localStorage.setItem(SPEICHER_SCHLUESSEL, art);
  } catch {
    // ignorieren
  }
}
