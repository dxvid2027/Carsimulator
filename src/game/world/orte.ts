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
import type { Streckendaten } from './strecke';

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

  Die Liste wird pro Welt einmal gebaut und gemerkt: Sie enthält Suchläufe
  über tausende Punkte, und gefragt wird sie für jeden einzelnen Baum.
*/
interface Sperrkreis {
  x: number;
  z: number;
  radius: number;
}

const sperrkreiseProWelt = new WeakMap<Terraindaten, Sperrkreis[]>();

function sperrkreise(
  terrain: Terraindaten,
  netz: Strassennetz,
  strecke: Streckendaten,
): Sperrkreis[] {
  const vorhanden = sperrkreiseProWelt.get(terrain);
  if (vorhanden) return vorhanden;

  const park = stuntparkOrt(terrain, netz);
  const dorf = dorfOrt(terrain, netz);
  const muehle = windmuehleOrt(terrain, netz);
  const turm = aussichtsturmOrt(terrain, netz);
  const felsen = felsenfeldOrt(terrain, netz);

  const liste: Sperrkreis[] = [
    { x: park.x, z: park.z, radius: STUNTPARK.radius + 8 },
    { x: dorf.x, z: dorf.z, radius: 55 },
    { x: muehle.x, z: muehle.z, radius: 20 },
    { x: turm.x, z: turm.z, radius: 22 },
    { ...bauernhofOrt(terrain, netz), radius: 38 },
    // Das Felsentor an der Einfahrt zum Felsenfeld
    { x: felsen.x, z: felsen.z - 58, radius: 18 },
    // Die Tankstelle am Straßenrand
    {
      ...strassenplatz(
        terrain, strecke, STRASSENBAUTEN.tankstelle.anteil, STRASSENBAUTEN.tankstelle.seitlich,
      ),
      radius: 26,
    },
    // Die Rampen am Straßenrand
    ...STRASSENBAUTEN.rampen.map((r) => ({
      ...strassenplatz(terrain, strecke, r.anteil, r.seitlich),
      radius: 26,
    })),
  ];
  sperrkreiseProWelt.set(terrain, liste);
  return liste;
}

export function bebautesGebiet(
  terrain: Terraindaten,
  netz: Strassennetz,
  strecke: Streckendaten,
  x: number,
  z: number,
): boolean {
  return sperrkreise(terrain, netz, strecke).some(
    (k) => Math.hypot(x - k.x, z - k.z) < k.radius,
  );
}

/**
 * Der Aussichtsturm steht auf einer hohen Kuppe – aber nicht auf der der
 * Windmühle, sonst stünden beide ineinander.
 */
function aussichtsturmOrtSuchen(terrain: Terraindaten, netz: Strassennetz): Ort {
  const muehle = windmuehleOrt(terrain, netz);
  const park = stuntparkOrt(terrain, netz);
  return suche(terrain, 445101, 1100, (x, z) => {
    if (netz.randabstand(x, z) < 30) return -Infinity;
    if (steigungBei(terrain, x, z) > 0.3) return -Infinity;
    if (Math.hypot(x - muehle.x, z - muehle.z) < 220) return -Infinity;
    if (Math.hypot(x - park.x, z - park.z) < 160) return -Infinity;
    return hoeheBei(terrain, x, z);
  });
}

/** Der Aussichtsturm auf der zweithöchsten Kuppe. */
export function aussichtsturmOrt(terrain: Terraindaten, netz: Strassennetz): Ort {
  return merke(terrain, 'aussichtsturm', () => aussichtsturmOrtSuchen(terrain, netz));
}

/**
 * Die Bauplätze am Rundkurs – an einer Stelle festgelegt.
 *
 * 3D-Welt, Karte und die Sperrkreise für die Bäume greifen alle hierauf zu.
 * Stünden die Zahlen mehrfach im Code, würde eine Änderung irgendwo vergessen
 * und der Kartenmarker zeigte neben das Gebäude.
 *
 * `anteil` = Position auf der Runde (0 = Start), `seitlich` = Abstand von der
 * Mittellinie (negativ = andere Straßenseite).
 */
export const STRASSENBAUTEN = {
  tankstelle: { anteil: 0.2, seitlich: 22 },
  rampen: [
    { anteil: 0.42, seitlich: 21, breite: 10, laenge: 15, hoehe: 3.0 },
    { anteil: 0.66, seitlich: -21, breite: 10, laenge: 17, hoehe: 3.6 },
    { anteil: 0.86, seitlich: 20, breite: 9, laenge: 13, hoehe: 2.4 },
  ],
} as const;

/**
 * Der Bauernhof liegt in Sichtweite des Dorfes, aber nicht darin.
 *
 * Er braucht eine flache Fläche für Scheune, Silo und Wasserturm – und genug
 * Abstand zur Straße, damit der Hofplatz nicht auf der Fahrbahn endet.
 */
function bauernhofOrtSuchen(terrain: Terraindaten, netz: Strassennetz): Ort {
  const dorf = dorfOrt(terrain, netz);
  return suche(terrain, 88213, 1200, (x, z) => {
    if (netz.randabstand(x, z) < 45) return -Infinity;
    const zumDorf = Math.hypot(x - dorf.x, z - dorf.z);
    if (zumDorf < 90 || zumDorf > 190) return -Infinity;
    let flachheit = 0;
    for (const [dx, dz] of [[0, 0], [18, 0], [-18, 0], [0, 18], [0, -18]]) {
      flachheit += 1 - steigungBei(terrain, x + dx, z + dz);
    }
    return flachheit;
  });
}

/** Der Bauernhof mit Scheune, Silo und Wasserturm. */
export function bauernhofOrt(terrain: Terraindaten, netz: Strassennetz): Ort {
  return merke(terrain, 'bauernhof', () => bauernhofOrtSuchen(terrain, netz));
}

/** Ein Platz direkt an der Straße – mit Blickrichtung zur Fahrbahn. */
export interface Strassenplatz extends Ort {
  /** Drehung um die Hochachse, sodass die Vorderseite zur Straße zeigt. */
  gier: number;
}

/**
 * Sucht einen Bauplatz am Rand des Rundkurses.
 *
 * `anteil` sagt, wo auf der Runde gesucht wird (0 = Start, 0.5 = Gegenseite).
 * Von dort aus wird nach vorn weitergesucht, bis eine Stelle kommt, die flach
 * genug ist – ein Gebäude an einer Steilkante würde in der Luft hängen.
 */
export function strassenplatz(
  terrain: Terraindaten,
  strecke: Streckendaten,
  anteil: number,
  /** Abstand von der Mittellinie. Negativ = andere Straßenseite. */
  seitlich: number,
): Strassenplatz {
  const n = strecke.punkte.length;
  const start = Math.floor(anteil * n) % n;
  let beste = { punkt: strecke.punkte[start], flachheit: -Infinity };
  for (let k = 0; k < 120; k++) {
    const p = strecke.punkte[(start + k) % n];
    // Rechtwinklig zur Fahrtrichtung nach außen
    const x = p.x + -p.rz * seitlich;
    const z = p.z + p.rx * seitlich;
    /*
      Nicht nur der Mittelpunkt zählt: Ein Gebäude ist mehrere Meter groß und
      soll mit allen vier Ecken auf ähnlicher Höhe stehen.
    */
    let flachheit = 0;
    for (const [dx, dz] of [[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]]) {
      flachheit -= steigungBei(terrain, x + dx, z + dz);
    }
    if (flachheit > beste.flachheit) beste = { punkt: p, flachheit };
  }
  const p = beste.punkt;
  const x = p.x + -p.rz * seitlich;
  const z = p.z + p.rx * seitlich;
  /*
    Blickrichtung bestimmen.

    Der Platz liegt in Richtung `nach außen` neben der Fahrbahn. Ein Objekt
    zeigt mit seiner lokalen +z-Achse nach vorn; eine Drehung um `gier` bildet
    +z auf (sin gier, cos gier) ab. Damit die Vorderseite zur Straße schaut,
    muss +z also GEGEN die Außenrichtung zeigen.
  */
  const s = Math.sign(seitlich) || 1;
  const aussenX = -p.rz * s;
  const aussenZ = p.rx * s;
  return {
    x,
    y: hoeheBei(terrain, x, z),
    z,
    gier: Math.atan2(-aussenX, -aussenZ),
  };
}
