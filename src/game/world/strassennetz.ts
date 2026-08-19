/**
 * Das Straßennetz: alle Fahrwege der Welt an einer Stelle.
 *
 * Wozu? Bäume, Felsen, Büsche, Heuballen und Leitplanken dürfen nicht auf
 * einer Fahrbahn stehen. Bisher kannten sie nur den Rundkurs – auf den
 * Nebenstraßen und Geländepisten wuchsen deshalb Büsche und es standen
 * Leitplanken quer. Dieses Modul kennt ALLE Wege und beantwortet eine einzige
 * Frage: "Wie weit ist dieser Punkt vom nächsten Fahrbahnrand entfernt?"
 *
 * Damit das schnell bleibt, werden die Wegpunkte in ein Raster einsortiert.
 * Eine Abfrage schaut dann nur in die Zellen der Umgebung statt über alle
 * paar tausend Punkte zu laufen – bei mehreren zehntausend Abfragen während
 * der Platzierung macht das den Unterschied zwischen Sekunden und Millisekunden.
 */

/** Ein Weg: die Mittellinie und wie breit er ist. */
export interface Weg {
  punkte: { x: number; z: number }[];
  /** Gesamtbreite der Fahrbahn in Metern. */
  breite: number;
}

/** Kantenlänge einer Rasterzelle in Metern. */
const ZELLE = 25;
/** So viele Zellen weit wird gesucht. 3 × 25 m = 75 m Reichweite. */
const REICHWEITE = 3;

interface Punkt {
  x: number;
  z: number;
  halb: number;
}

export interface Strassennetz {
  /**
   * Abstand zum nächsten Fahrbahn-RAND (nicht zur Mittellinie).
   * Negativ heißt: der Punkt liegt auf der Fahrbahn.
   * Ist weit und breit kein Weg, kommt ein großer Wert zurück.
   */
  randabstand(x: number, z: number): number;
}

export function baueStrassennetz(wege: Weg[]): Strassennetz {
  const raster = new Map<string, Punkt[]>();

  const schluessel = (cx: number, cz: number) => `${cx}|${cz}`;

  for (const weg of wege) {
    const halb = weg.breite / 2;
    for (const p of weg.punkte) {
      const cx = Math.floor(p.x / ZELLE);
      const cz = Math.floor(p.z / ZELLE);
      const k = schluessel(cx, cz);
      let eimer = raster.get(k);
      if (!eimer) {
        eimer = [];
        raster.set(k, eimer);
      }
      eimer.push({ x: p.x, z: p.z, halb });
    }
  }

  return {
    randabstand(x: number, z: number) {
      const cx = Math.floor(x / ZELLE);
      const cz = Math.floor(z / ZELLE);
      let beste = Infinity;
      for (let dx = -REICHWEITE; dx <= REICHWEITE; dx++) {
        for (let dz = -REICHWEITE; dz <= REICHWEITE; dz++) {
          const eimer = raster.get(schluessel(cx + dx, cz + dz));
          if (!eimer) continue;
          for (const p of eimer) {
            const d = Math.hypot(x - p.x, z - p.z) - p.halb;
            if (d < beste) beste = d;
          }
        }
      }
      // Nichts in Reichweite gefunden -> weit weg von jeder Straße
      return beste === Infinity ? ZELLE * REICHWEITE : beste;
    },
  };
}
