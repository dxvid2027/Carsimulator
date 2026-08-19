/**
 * Die besonderen Orte der Welt – Dorf, Windmühle, Felsenfeld, Stuntpark.
 *
 * Warum ein eigenes Modul? Sowohl die 3D-Welt als auch die Karte müssen
 * wissen, wo diese Orte liegen. Würde jede Seite ihre eigene Suche machen,
 * könnten die Ergebnisse auseinanderlaufen und der Marker auf der Karte zeigte
 * ins Leere. Hier steht die Suche einmal – beide fragen dieselbe Funktion.
 *
 * Alle Funktionen sind deterministisch: gleiche Welt, gleicher Ort.
 */
import { WELT, hoeheBei, steigungBei, type Terraindaten } from './heightmap';
import type { Strassennetz } from './strassennetz';

export interface Ort {
  x: number;
  y: number;
  z: number;
}

function zufall(keim: number) {
  let a = keim >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/*
  Jeder Ort wird pro Welt nur EINMAL gesucht und dann gemerkt.

  Zwei Gründe:
  1. Richtigkeit. Der Stuntpark ebnet nach seiner Suche den Boden ein. Eine
     zweite Suche auf dem eingeebneten Terrain fände plötzlich woanders die
     flachste Stelle – Rampen, Karte und Physik lägen auseinander.
  2. Tempo. Jede Suche tastet bis zu 1400 Stellen ab; Karte, Deko und
     Stuntpark fragen aber alle nach denselben Orten.

  Der Schlüssel ist das Terrain-Objekt selbst. Eine neue Welt hat ein neues
  Terrain und bekommt damit automatisch frische Orte.
*/
const gemerkt = new WeakMap<Terraindaten, Map<string, Ort>>();

function merke(terrain: Terraindaten, name: string, berechne: () => Ort): Ort {
  let fuerWelt = gemerkt.get(terrain);
  if (!fuerWelt) {
    fuerWelt = new Map();
    gemerkt.set(terrain, fuerWelt);
  }
  const vorhanden = fuerWelt.get(name);
  if (vorhanden) return vorhanden;
  const ort = berechne();
  fuerWelt.set(name, ort);
  return ort;
}

/**
 * Sucht einen Platz nach Vorgaben.
 *
 * `bewerte` gibt eine Punktzahl zurück; der beste Platz gewinnt. Wer einen
 * Platz ausschließen will, gibt -Infinity zurück.
 */
function suche(
  terrain: Terraindaten,
  keim: number,
  versuche: number,
  bewerte: (x: number, z: number) => number,
): Ort {
  const rnd = zufall(keim);
  const rand = WELT.groesse / 2 - 120;
  let beste = -Infinity;
  let ort: Ort = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < versuche; i++) {
    const x = (rnd() - 0.5) * 2 * rand;
    const z = (rnd() - 0.5) * 2 * rand;
    const punktzahl = bewerte(x, z);
    if (punktzahl > beste) {
      beste = punktzahl;
      ort = { x, y: hoeheBei(terrain, x, z), z };
    }
  }
  return ort;
}

/** Das Dorf: flach, in mittlerer Entfernung zur Strecke. */
function dorfOrtSuchen(terrain: Terraindaten, netz: Strassennetz): Ort {
  return suche(terrain, 20292, 900, (x, z) => {
    const d = netz.randabstand(x, z);
    if (d < 30 || d > 120) return -Infinity;
    // Möglichst flach, und gern in mittlerer Entfernung zur Straße
    return (1 - steigungBei(terrain, x, z)) * 3 - Math.abs(d - 60) / 100;
  });
}

/** Die Windmühle steht auf der höchsten erreichbaren Kuppe. */
function windmuehleOrtSuchen(terrain: Terraindaten, netz: Strassennetz): Ort {
  return suche(terrain, 20338, 900, (x, z) => {
    if (netz.randabstand(x, z) < 40) return -Infinity;
    if (steigungBei(terrain, x, z) > 0.28) return -Infinity;
    return hoeheBei(terrain, x, z);
  });
}

/** Das Felsenfeld liegt in steilerem Gelände, weit weg von den Wegen. */
function felsenfeldOrtSuchen(terrain: Terraindaten, netz: Strassennetz): Ort {
  return suche(terrain, 5249, 700, (x, z) => {
    const d = netz.randabstand(x, z);
    if (d < 55) return -Infinity;
    return steigungBei(terrain, x, z) * 2 + d / 400;
  });
}

/** Maße des Stuntparks – die Welt braucht sie zum Einebnen. */
export const STUNTPARK = {
  /** Bis hierhin steht etwas vom Park (Reifenstapel ganz außen). */
  radius: 58,
  /** Über diese Breite läuft die eingeebnete Fläche wieder ins Gelände aus. */
  uebergang: 30,
  /** Mindestabstand zur nächsten Straße – muss größer als radius+uebergang sein. */
  strassenabstand: 100,
};

/**
 * Der Stuntpark braucht eine große, möglichst ebene Fläche.
 *
 * Er muss außerdem deutlich vom Dorf entfernt liegen: Beide suchen flaches
 * Gelände abseits der Straße und landeten sonst an derselben Stelle – auf der
 * Karte überlagerten sich die Beschriftungen und in der Welt hätten die
 * Rampen zwischen den Häusern gestanden.
 */
function stuntparkOrtSuchen(terrain: Terraindaten, netz: Strassennetz): Ort {
  const dorf = dorfOrt(terrain, netz);
  return suche(terrain, 771903, 1400, (x, z) => {
    const d = netz.randabstand(x, z);
    /*
      Der Park ist rund 110 m breit UND sein Boden wird eingeebnet. Der
      Übergang der eingeebneten Fläche ins Gelände reicht bis 88 m – bliebe er
      näher an der Straße, würde er die eingeschnittene Fahrbahn verbiegen.
    */
    if (d < STUNTPARK.strassenabstand) return -Infinity;
    if (Math.hypot(x - dorf.x, z - dorf.z) < 200) return -Infinity;
    /*
      Nicht nur der Mittelpunkt muss eben sein, sondern die ganze Fläche.
      Deshalb wird ringsum abgetastet – sonst steht die Landeplattform am Hang
      und man springt daran vorbei.
    */
    let flachheit = 0;
    for (const [dx, dz] of [
      [0, 0], [45, 0], [-45, 0], [0, 45], [0, -45],
      [32, 32], [-32, 32], [32, -32], [-32, -32],
    ]) {
      flachheit += 1 - steigungBei(terrain, x + dx, z + dz);
    }
    return flachheit;
  });
}

/*
  Die öffentlichen Fassungen: Sie liefern immer dasselbe Ergebnis pro Welt,
  egal wie oft und von wem sie gefragt werden.
*/

/** Das Dorf: flach, in mittlerer Entfernung zur Strecke. */
export function dorfOrt(terrain: Terraindaten, netz: Strassennetz): Ort {
  return merke(terrain, 'dorf', () => dorfOrtSuchen(terrain, netz));
}

/** Die Windmühle auf der höchsten erreichbaren Kuppe. */
export function windmuehleOrt(terrain: Terraindaten, netz: Strassennetz): Ort {
  return merke(terrain, 'windmuehle', () => windmuehleOrtSuchen(terrain, netz));
}

/** Das Felsenfeld im steilen Gelände. */
export function felsenfeldOrt(terrain: Terraindaten, netz: Strassennetz): Ort {
  return merke(terrain, 'felsenfeld', () => felsenfeldOrtSuchen(terrain, netz));
}

/** Der Stuntpark auf der großen ebenen Fläche. */
export function stuntparkOrt(terrain: Terraindaten, netz: Strassennetz): Ort {
  return merke(terrain, 'stuntpark', () => stuntparkOrtSuchen(terrain, netz));
}

/*
  Wo schon etwas steht, darf keine Deko mehr wachsen.

  Ohne diese Prüfung stehen Bäume mitten auf der Sprungschanze und Büsche
  zwischen den Containern – die Anfahrt wäre zugewachsen. Bäume, Felsen,
  Büsche und Grasbüschel fragen deshalb vor dem Hinstellen hier nach.
*/
export function bebautesGebiet(
  terrain: Terraindaten,
  netz: Strassennetz,
  x: number,
  z: number,
): boolean {
  const park = stuntparkOrt(terrain, netz);
  if (Math.hypot(x - park.x, z - park.z) < STUNTPARK.radius + 8) return true;
  const dorf = dorfOrt(terrain, netz);
  if (Math.hypot(x - dorf.x, z - dorf.z) < 55) return true;
  const muehle = windmuehleOrt(terrain, netz);
  if (Math.hypot(x - muehle.x, z - muehle.z) < 20) return true;
  return false;
}
