/**
 * Gemeinsamer Zustand für die Touch-Bedienung.
 *
 * Die Bedienelemente sind normales HTML über dem 3D-Bild. Sie schreiben hier
 * hinein, und `useDrivingInput` liest die Werte jeden Frame zusammen mit
 * Tastatur und Gamepad aus. Ein gemeinsames Objekt statt React-State, weil
 * sich die Werte bei jeder Fingerbewegung ändern – React-Renders wären dafür
 * viel zu teuer.
 */
export const touchEingabe = {
  gas: 0,
  bremse: 0,
  /** -1 (rechts) bis +1 (links) */
  lenken: 0,
  handbremse: false,
  /** Wird gesetzt, wenn der Reset-Knopf gedrückt wurde. */
  reset: false,
  /** Wird gesetzt, wenn der Wenden-Knopf gedrückt wurde. */
  wenden: false,
};

/**
 * Erkennt, ob das Gerät per Finger bedient wird.
 *
 * `pointer: coarse` trifft auf Touchscreens zu, aber nicht auf Mäuse.
 * Mit `?touch` in der URL kann man die Bedienung auch am Rechner erzwingen,
 * um sie zu testen.
 */
export function istTouchGeraet(): boolean {
  if (new URLSearchParams(window.location.search).has('touch')) return true;
  if (new URLSearchParams(window.location.search).has('keyboard')) return false;
  return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}
