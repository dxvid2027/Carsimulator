/**
 * Gemeinsamer Zwischenspeicher für Anzeigewerte.
 *
 * Warum kein React-State? Diese Werte ändern sich 60-mal pro Sekunde.
 * Würden wir sie in den State schreiben, würde React 60-mal pro Sekunde
 * die komplette Szene neu rendern. Stattdessen schreibt die Physik hier
 * hinein und das HUD liest die Werte in seiner eigenen Animationsschleife.
 */
export const telemetrie = {
  /** Geschwindigkeit in km/h (immer positiv). */
  tempoKmh: 0,
  /** Vorzeichenbehaftete Geschwindigkeit in m/s (negativ = rückwärts). */
  tempoMs: 0,
  /** Angezeigter Gang: -1 = Rückwärts, 0 = Leerlauf, 1..6 = Vorwärtsgänge. */
  gang: 0,
  /** Drehzahl in U/min (nur zur Anzeige berechnet). */
  drehzahl: 0,
  /** Schräglaufwinkel in Grad – ab ca. 15° driftet das Auto sichtbar. */
  schraeglauf: 0,
  /** Wie viele Räder gerade Bodenkontakt haben (0–4). */
  bodenkontakt: 0,
  /** Weltposition des Autos – später für Rundenzeit, Minimap und Streaming. */
  position: { x: 0, y: 0, z: 0 },
  /** 1 = auf der Fahrbahn, 0 = im Gelände. */
  aufAsphalt: 1,
};
