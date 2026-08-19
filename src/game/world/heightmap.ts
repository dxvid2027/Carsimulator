/**
 * Prozedurale Heightmap für das Terrain.
 *
 * Die Höhen werden im Code berechnet, nicht aus einem Bild geladen. Vorteile:
 * kein Download, immer dasselbe Ergebnis (fester Zufallskeim) und du kannst
 * die Landschaft über die Werte in WELT verändern.
 *
 * Wichtig zur Speicherreihenfolge (empirisch gegen Rapier geprüft):
 *   index = iz + ix * (aufloesung + 1)
 *   ix läuft entlang +X, iz entlang +Z, Index 0 liegt bei (-groesse/2, -groesse/2).
 * Das Gitter muss quadratisch sein – Rapiers Heightfield verhält sich bei
 * ungleichen Zeilen-/Spaltenzahlen anders.
 */

export const WELT = {
  /** Kantenlänge des Terrains in Metern. */
  groesse: 1000,
  /**
   * Anzahl der Zellen pro Kante. Es gibt (aufloesung + 1)² Höhenpunkte.
   * 256 -> 257² Punkte, also ca. 3,9 m pro Zelle.
   */
  aufloesung: 256,
  /** Wie hoch die Hügel maximal werden (Meter). */
  maxHoehe: 42,
  /** Fester Zufallskeim – gleiche Zahl = gleiche Landschaft. */
  keim: 1337,
  /** Radius um den Startpunkt, der flach bleibt (Meter). */
  startFlaeche: 70,
  /** Über diese Distanz geht die flache Startfläche in die Hügel über. */
  startUebergang: 90,
} as const;

/** Zellgröße in Metern. */
export const ZELLE = WELT.groesse / WELT.aufloesung;

/** Kleiner, schneller Pseudozufallsgenerator mit festem Keim (mulberry32). */
function zufall(keim: number) {
  let a = keim >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Value Noise: ein Gitter aus Zufallswerten, zwischen denen weich
 * interpoliert wird. Ergibt sanfte Hügel statt Rauschen.
 */
function macheNoise(keim: number, gitter: number) {
  const rnd = zufall(keim);
  const werte = new Float32Array(gitter * gitter);
  for (let i = 0; i < werte.length; i++) werte[i] = rnd();

  /** Weiche Übergangskurve (smoothstep), damit keine Kanten entstehen. */
  const weich = (t: number) => t * t * (3 - 2 * t);

  /** Liest den Zufallswert an Gitterposition (x, y), Rand wird umgeschlagen. */
  const gitterWert = (x: number, y: number) =>
    werte[(((y % gitter) + gitter) % gitter) * gitter + (((x % gitter) + gitter) % gitter)];

  return (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = weich(x - x0);
    const fy = weich(y - y0);
    const o = gitterWert(x0, y0);
    const p = gitterWert(x0 + 1, y0);
    const q = gitterWert(x0, y0 + 1);
    const r = gitterWert(x0 + 1, y0 + 1);
    return (o + (p - o) * fx) * (1 - fy) + (q + (r - q) * fx) * fy;
  };
}

/**
 * Fraktales Rauschen: mehrere Noise-Lagen übereinander.
 * Große Lagen ergeben die Hügel, kleine Lagen die Details.
 */
function fbm(noise: (x: number, y: number) => number, x: number, y: number, lagen: number) {
  let summe = 0;
  let amplitude = 1;
  let frequenz = 1;
  let normierung = 0;
  for (let i = 0; i < lagen; i++) {
    summe += noise(x * frequenz, y * frequenz) * amplitude;
    normierung += amplitude;
    amplitude *= 0.5; // jede Lage halb so stark
    frequenz *= 2.0; // ... und doppelt so fein
  }
  return summe / normierung;
}

export interface Terraindaten {
  /** Höhen in Metern, Länge (aufloesung + 1)². */
  hoehen: Float32Array;
  /** Anzahl Zellen pro Kante. */
  aufloesung: number;
  /** Kantenlänge in Metern. */
  groesse: number;
  /** Niedrigster und höchster Punkt (für Einfärbung). */
  minHoehe: number;
  maxHoehe: number;
}

/** Berechnet die komplette Heightmap. Läuft einmal beim Start. */
export function erzeugeTerrain(): Terraindaten {
  const { aufloesung, groesse, maxHoehe, keim, startFlaeche, startUebergang } = WELT;
  const punkte = aufloesung + 1;
  const hoehen = new Float32Array(punkte * punkte);

  const grob = macheNoise(keim, 64);
  const fein = macheNoise(keim + 91, 64);

  let min = Infinity;
  let max = -Infinity;

  for (let ix = 0; ix < punkte; ix++) {
    for (let iz = 0; iz < punkte; iz++) {
      // Weltkoordinaten dieses Gitterpunkts
      const x = (ix / aufloesung - 0.5) * groesse;
      const z = (iz / aufloesung - 0.5) * groesse;

      // Grundform: große, weiche Hügel
      let h = fbm(grob, x / 260, z / 260, 4);
      // Von 0..1 auf -1..1 bringen und die Kuppen abflachen
      h = (h - 0.5) * 2;
      h = Math.sign(h) * Math.pow(Math.abs(h), 1.35);
      h *= maxHoehe;

      // Feine Wellen darüber, damit die Federung etwas zu tun bekommt
      h += (fbm(fein, x / 45, z / 45, 3) - 0.5) * 3.2;

      // Startbereich flach machen, damit das Auto sauber steht
      const abstand = Math.hypot(x, z);
      if (abstand < startFlaeche + startUebergang) {
        const t = Math.max(0, (abstand - startFlaeche) / startUebergang);
        // smoothstep für einen weichen Übergang ohne Kante
        h *= t * t * (3 - 2 * t);
      }

      hoehen[iz + ix * punkte] = h;
      if (h < min) min = h;
      if (h > max) max = h;
    }
  }

  return { hoehen, aufloesung, groesse, minHoehe: min, maxHoehe: max };
}

/**
 * Höhe an einer beliebigen Weltposition (bilinear interpoliert).
 * Wird zum Absetzen des Autos und später zum Platzieren von Bäumen gebraucht.
 */
export function hoeheBei(daten: Terraindaten, x: number, z: number): number {
  const { hoehen, aufloesung, groesse } = daten;
  const punkte = aufloesung + 1;

  // Weltkoordinate -> Gitterkoordinate (kann Nachkommastellen haben)
  const gx = Math.min(aufloesung, Math.max(0, (x / groesse + 0.5) * aufloesung));
  const gz = Math.min(aufloesung, Math.max(0, (z / groesse + 0.5) * aufloesung));

  const ix = Math.min(aufloesung - 1, Math.floor(gx));
  const iz = Math.min(aufloesung - 1, Math.floor(gz));
  const fx = gx - ix;
  const fz = gz - iz;

  const h00 = hoehen[iz + ix * punkte];
  const h10 = hoehen[iz + (ix + 1) * punkte];
  const h01 = hoehen[iz + 1 + ix * punkte];
  const h11 = hoehen[iz + 1 + (ix + 1) * punkte];

  return (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
}

/** Steigung (0 = eben, 1 = senkrecht) an einer Weltposition. */
export function steigungBei(daten: Terraindaten, x: number, z: number): number {
  const d = ZELLE;
  const hx = hoeheBei(daten, x + d, z) - hoeheBei(daten, x - d, z);
  const hz = hoeheBei(daten, x, z + d) - hoeheBei(daten, x, z - d);
  const neigung = Math.hypot(hx, hz) / (2 * d);
  return neigung / Math.sqrt(1 + neigung * neigung);
}
