/**
 * Der Rundkurs.
 *
 * Ablauf (die Reihenfolge ist wichtig):
 *   1. Terrain wird erzeugt (heightmap.ts)
 *   2. Hier wird eine geschlossene Kurve gelegt und ihre Höhe aus dem Terrain
 *      abgelesen und geglättet – sonst hätte die Straße jede Bodenwelle mit
 *      und wäre unfahrbar holprig.
 *   3. Die Straße wird ins Terrain eingeschnitten (`schneideStreckeEin`).
 *      Danach passt der Kollisionskörper automatisch, weil er dieselben Höhen
 *      benutzt. Die Straße braucht also keinen eigenen Kollisionskörper.
 */
import { CatmullRomCurve3, Vector3 } from 'three';
import { WELT, hoeheBei, type Terraindaten } from './heightmap';

export const STRECKE = {
  /** Fahrbahnbreite in Metern (zwei Spuren). */
  breite: 12,
  /** Breite des Seitenstreifens neben dem Asphalt. */
  bankett: 4,
  /** Über diese zusätzliche Breite läuft das Terrain wieder in die Landschaft. */
  uebergang: 14,
  /** Abstand der Stützpunkte entlang der Strecke in Metern. */
  abtastung: 2,
  /** Mittlerer Radius des Kurses. */
  radius: 330,
  /** Wie stark der Radius schwankt (0 = Kreis, 1 = sehr verwinkelt). */
  wildheit: 0.24,
  /** Anzahl der Kontrollpunkte des Kurses. */
  kontrollpunkte: 12,
  /** Zufallskeim für die Streckenform. */
  keim: 7,
  /**
   * Mindestabstand, den der Kurs zu sich selbst halten muss.
   * Kommen sich zwei Abschnitte näher, überlagern sich ihre Einschnitte ins
   * Terrain und es entsteht eine Stufe in der Fahrbahn.
   */
  minSelbstabstand: 60,
  /** Kleinster erlaubter Kurvenradius in Metern. */
  minKurvenradius: 45,
  /**
   * Größte erlaubte Steigung über 10 m (als Verhältnis, 0.18 ≈ 10°).
   * Geprüft wird die glatte Kurve. Nach dem Aufrasten aufs Terrain-Gitter
   * (Zellen von 3,9 m) liegt der tatsächliche Wert einige Prozent höher –
   * `npm run strecke` zeigt beide Zahlen.
   */
  maxSteigung: 0.20,
  /** So viele Zufallskeime werden durchprobiert, bis der Kurs die Vorgaben erfüllt. */
  maxVersuche: 60,
  /**
   * Wie stark die Straßenhöhe geglättet wird (Anzahl Glättungsdurchgänge).
   * Mehr = flachere, schnellere Strecke; weniger = welliger.
   */
  glaettung: 70,
  /** Wie weit die Straße über dem eingeschnittenen Terrain liegt. */
  ueberhoehung: 0.06,
} as const;

/** Ein Stützpunkt entlang der Mittellinie. */
export interface Streckenpunkt {
  /** Position der Mittellinie. */
  x: number;
  y: number;
  z: number;
  /** Richtung der Fahrbahn (normiert, nur XZ). */
  rx: number;
  rz: number;
  /** Strecke vom Start bis hierher in Metern. */
  distanz: number;
}

export interface Streckendaten {
  punkte: Streckenpunkt[];
  /** Gesamtlänge des Kurses in Metern. */
  laenge: number;
  /** Start-/Ziellinie: Index in `punkte`. */
  startIndex: number;
}

/** Derselbe kleine Zufallsgenerator wie in der Heightmap. */
function zufall(keim: number) {
  let a = keim >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Baut einen Streckenkandidaten aus einem bestimmten Zufallskeim. */
function baueKandidat(terrain: Terraindaten, keim: number): Streckendaten {
  const rnd = zufall(keim);

  /*
    Kontrollpunkte im Kreis verteilen.

    Der Winkelversatz bleibt bewusst deutlich kleiner als der Abstand zweier
    Punkte. Sonst könnten zwei Punkte die Reihenfolge tauschen und der Kurs
    würde sich selbst kreuzen.
  */
  const schritt = (Math.PI * 2) / STRECKE.kontrollpunkte;
  const radien: number[] = [];
  const winkel: number[] = [];
  for (let i = 0; i < STRECKE.kontrollpunkte; i++) {
    winkel.push(i * schritt + (rnd() - 0.5) * schritt * 0.45);
    radien.push(STRECKE.radius * (1 + (rnd() - 0.5) * 2 * STRECKE.wildheit));
  }

  /*
    Radien ringförmig glätten. Ohne das können zwei benachbarte Punkte von
    ganz innen nach ganz außen springen – das ergibt Haarnadeln, die man nicht
    fahren kann.
  */
  for (let durchgang = 0; durchgang < 2; durchgang++) {
    const naechste = radien.slice();
    for (let i = 0; i < radien.length; i++) {
      const vor = radien[(i - 1 + radien.length) % radien.length];
      const nach = radien[(i + 1) % radien.length];
      naechste[i] = (vor + radien[i] * 2 + nach) / 4;
    }
    for (let i = 0; i < radien.length; i++) radien[i] = naechste[i];
  }

  const kontroll: Vector3[] = winkel.map(
    (w, i) => new Vector3(Math.cos(w) * radien[i], 0, Math.sin(w) * radien[i]),
  );

  // catmullrom + closed = eine weiche, geschlossene Schleife
  const kurve = new CatmullRomCurve3(kontroll, true, 'catmullrom', 0.5);

  const grobeLaenge = kurve.getLength();
  const anzahl = Math.max(64, Math.round(grobeLaenge / STRECKE.abtastung));
  const roh = kurve.getSpacedPoints(anzahl - 1);

  // Höhe aus dem Terrain ablesen
  const hoehen = roh.map((p) => hoeheBei(terrain, p.x, p.z));

  /*
    Höhen glätten. Ohne das würde die Straße jeder kleinen Bodenwelle folgen –
    beim Fahren fühlt sich das wie Kopfsteinpflaster an.
    Ringförmig mitteln, weil der Kurs geschlossen ist.
  */
  let geglaettet = hoehen.slice();
  for (let durchgang = 0; durchgang < STRECKE.glaettung; durchgang++) {
    const naechste = geglaettet.slice();
    for (let i = 0; i < geglaettet.length; i++) {
      const vor = geglaettet[(i - 1 + geglaettet.length) % geglaettet.length];
      const nach = geglaettet[(i + 1) % geglaettet.length];
      naechste[i] = (vor + geglaettet[i] * 2 + nach) / 4;
    }
    geglaettet = naechste;
  }

  const punkte: Streckenpunkt[] = [];
  let distanz = 0;
  for (let i = 0; i < roh.length; i++) {
    const p = roh[i];
    const naechster = roh[(i + 1) % roh.length];
    let rx = naechster.x - p.x;
    let rz = naechster.z - p.z;
    const laenge = Math.hypot(rx, rz) || 1;
    rx /= laenge;
    rz /= laenge;

    if (i > 0) {
      const vorher = roh[i - 1];
      distanz += Math.hypot(p.x - vorher.x, p.z - vorher.z);
    }
    punkte.push({ x: p.x, y: geglaettet[i], z: p.z, rx, rz, distanz });
  }

  const gesamt =
    distanz + Math.hypot(roh[0].x - roh[roh.length - 1].x, roh[0].z - roh[roh.length - 1].z);

  return { punkte, laenge: gesamt, startIndex: 0 };
}

/** Kennzahlen, an denen sich entscheidet, ob ein Kurs brauchbar ist. */
export interface Streckenguete {
  selbstabstand: number;
  minKurvenradius: number;
  maxSteigung: number;
  passtAufsTerrain: boolean;
}

/** Bewertet einen Kandidaten. Bewusst grob abgetastet, damit es schnell bleibt. */
export function bewerteStrecke(strecke: Streckendaten): Streckenguete {
  const p = strecke.punkte;
  const n = p.length;

  // --- Abstand zu sich selbst ---
  // Nur jeden 10. Punkt prüfen; das genügt und ist 100-mal schneller.
  const schritt = 10;
  const ausblenden = Math.round(140 / STRECKE.abtastung);
  let selbstabstand = Infinity;
  for (let i = 0; i < n; i += schritt) {
    for (let j = i + ausblenden; j < n; j += schritt) {
      // Auch den Ringschluss berücksichtigen: Punkte am Ende sind Nachbarn von Punkt 0
      if (n - j + i < ausblenden) continue;
      const d = Math.hypot(p[i].x - p[j].x, p[i].z - p[j].z);
      if (d < selbstabstand) selbstabstand = d;
    }
  }

  // --- engster Kurvenradius (Kreis durch drei Punkte) ---
  const basis = Math.max(1, Math.round(12 / STRECKE.abtastung));
  let minRadius = Infinity;
  for (let i = 0; i < n; i++) {
    const a = p[i];
    const b = p[(i + basis) % n];
    const c = p[(i + 2 * basis) % n];
    const ab = Math.hypot(b.x - a.x, b.z - a.z);
    const bc = Math.hypot(c.x - b.x, c.z - b.z);
    const ca = Math.hypot(a.x - c.x, a.z - c.z);
    const flaeche = Math.abs((b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z)) / 2;
    if (flaeche < 1e-6) continue;
    minRadius = Math.min(minRadius, (ab * bc * ca) / (4 * flaeche));
  }

  // --- Steigung über 10 m ---
  const steigungsBasis = Math.max(1, Math.round(10 / STRECKE.abtastung));
  let maxSteigung = 0;
  for (let i = 0; i < n; i++) {
    const a = p[i];
    const b = p[(i + steigungsBasis) % n];
    const weg = Math.hypot(b.x - a.x, b.z - a.z);
    if (weg < 1) continue;
    maxSteigung = Math.max(maxSteigung, Math.abs(b.y - a.y) / weg);
  }

  // --- passt der Kurs samt Einschnitt aufs Terrain? ---
  const grenze =
    WELT.groesse / 2 - (STRECKE.breite / 2 + STRECKE.bankett + STRECKE.uebergang) - 10;
  const passtAufsTerrain = p.every((q) => Math.abs(q.x) < grenze && Math.abs(q.z) < grenze);

  return { selbstabstand, minKurvenradius: minRadius, maxSteigung, passtAufsTerrain };
}

/**
 * Legt einen geschlossenen Kurs an und liest seine Höhe aus dem Terrain.
 *
 * Es werden mehrere Zufallskeime durchprobiert, bis einer die Vorgaben erfüllt:
 * der Kurs darf sich nicht zu nahe kommen, keine Haarnadel enthalten und nicht
 * zu steil sein. Kommt sich der Kurs zu nahe, überlagern sich beim Einschneiden
 * ins Terrain zwei verschiedene Fahrbahnhöhen – dann hat die Straße dort eine
 * Stufe. Das ist genau der Fehler, den diese Prüfung verhindert.
 *
 * Der Ablauf ist trotzdem vollständig vorhersagbar: gleicher Keim, gleiche Welt.
 */
export function erzeugeStrecke(terrain: Terraindaten): Streckendaten {
  let bester: Streckendaten | null = null;
  let besteBewertung = -Infinity;

  for (let versuch = 0; versuch < STRECKE.maxVersuche; versuch++) {
    const kandidat = baueKandidat(terrain, STRECKE.keim + versuch * 977);
    const g = bewerteStrecke(kandidat);

    if (
      g.passtAufsTerrain &&
      g.selbstabstand >= STRECKE.minSelbstabstand &&
      g.minKurvenradius >= STRECKE.minKurvenradius &&
      g.maxSteigung <= STRECKE.maxSteigung
    ) {
      return kandidat;
    }

    // Notfalls den am wenigsten schlechten Kurs behalten
    const punktzahl =
      Math.min(g.selbstabstand / STRECKE.minSelbstabstand, 1.5) +
      Math.min(g.minKurvenradius / STRECKE.minKurvenradius, 1.5) +
      Math.min(STRECKE.maxSteigung / Math.max(g.maxSteigung, 1e-4), 1.5) +
      (g.passtAufsTerrain ? 1 : -5);
    if (punktzahl > besteBewertung) {
      besteBewertung = punktzahl;
      bester = kandidat;
    }
  }

  return bester!;
}

/**
 * Schneidet die Straße ins Terrain ein.
 *
 * Verändert `terrain.hoehen` direkt. Danach ist der Boden unter der Straße
 * eben und der Rapier-Kollisionskörper stimmt automatisch – ohne dass die
 * Straße einen eigenen Kollisionskörper bräuchte.
 */
export function schneideStreckeEin(terrain: Terraindaten, strecke: Streckendaten) {
  const { hoehen, aufloesung, groesse } = terrain;
  const punkteProKante = aufloesung + 1;
  const zelle = groesse / aufloesung;

  const innen = STRECKE.breite / 2 + STRECKE.bankett;
  const aussen = innen + STRECKE.uebergang;

  /*
    Für jeden Gitterpunkt merken wir den nächstgelegenen Streckenpunkt.
    `naehe` speichert die kleinste gefundene Distanz, `zielhoehe` die Höhe der
    Straße dort. Beides mit "unendlich" bzw. 0 vorbelegt.
  */
  const naehe = new Float32Array(hoehen.length).fill(Infinity);
  const zielhoehe = new Float32Array(hoehen.length);

  for (const p of strecke.punkte) {
    // Nur die Gitterpunkte im Umkreis anschauen, nicht das ganze Terrain
    const reichweite = Math.ceil(aussen / zelle) + 1;
    const mittigX = Math.round((p.x / groesse + 0.5) * aufloesung);
    const mittigZ = Math.round((p.z / groesse + 0.5) * aufloesung);

    for (let ix = mittigX - reichweite; ix <= mittigX + reichweite; ix++) {
      if (ix < 0 || ix >= punkteProKante) continue;
      const weltX = (ix / aufloesung - 0.5) * groesse;

      for (let iz = mittigZ - reichweite; iz <= mittigZ + reichweite; iz++) {
        if (iz < 0 || iz >= punkteProKante) continue;
        const weltZ = (iz / aufloesung - 0.5) * groesse;

        const d = Math.hypot(weltX - p.x, weltZ - p.z);
        const index = iz + ix * punkteProKante;
        if (d < naehe[index]) {
          naehe[index] = d;
          zielhoehe[index] = p.y;
        }
      }
    }
  }

  // Jetzt einmal über alle betroffenen Punkte und die Höhe überblenden
  for (let i = 0; i < hoehen.length; i++) {
    const d = naehe[i];
    if (d > aussen) continue;

    let anteil: number;
    if (d <= innen) {
      anteil = 1; // voll auf Straßenhöhe
    } else {
      // weicher Übergang zurück in die Landschaft (smoothstep)
      const t = 1 - (d - innen) / (aussen - innen);
      anteil = t * t * (3 - 2 * t);
    }
    hoehen[i] = hoehen[i] * (1 - anteil) + zielhoehe[i] * anteil;
  }

  // Min/Max stimmen nach dem Einschneiden nicht mehr – neu bestimmen,
  // weil die Einfärbung des Terrains davon abhängt
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < hoehen.length; i++) {
    if (hoehen[i] < min) min = hoehen[i];
    if (hoehen[i] > max) max = hoehen[i];
  }
  terrain.minHoehe = min;
  terrain.maxHoehe = max;
}

/**
 * Kürzester Abstand einer Weltposition zur Mittellinie.
 * Wird für die Griffigkeit (Asphalt vs. Wiese) und später für die Rundenzeit
 * gebraucht.
 */
export function abstandZurStrecke(strecke: Streckendaten, x: number, z: number) {
  let besteDistanz = Infinity;
  let besterIndex = 0;
  for (let i = 0; i < strecke.punkte.length; i++) {
    const p = strecke.punkte[i];
    const d = (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z);
    if (d < besteDistanz) {
      besteDistanz = d;
      besterIndex = i;
    }
  }
  return { distanz: Math.sqrt(besteDistanz), index: besterIndex };
}

/**
 * Erzeugt Rundkurs und Nebenstraßen in der richtigen Reihenfolge.
 *
 * Die Reihenfolge ist entscheidend:
 *   1. Beide Straßenverläufe werden vom UNVERÄNDERTEN Terrain abgelesen
 *   2. Zuerst werden die Nebenstraßen eingeschnitten
 *   3. Danach der Rundkurs – er überschreibt die Kreuzungen und bleibt
 *      dadurch gleichmäßig. Andersherum würde eine kreuzende Nebenstraße
 *      eine Welle in den Rundkurs drücken.
 *   4. Zum Schluss werden die Straßenhöhen an das fertige Terrain angeglichen
 */
export function erzeugeWelt(terrain: Terraindaten) {
  const strecke = erzeugeStrecke(terrain);

  const rand = WELT.groesse / 2 - 70;
  const nebenstrassen = [
    erzeugeNebenstrasse(terrain, { x: -rand, z: -rand * 0.35 }, { x: rand, z: rand * 0.5 }, 110),
    erzeugeNebenstrasse(terrain, { x: rand * 0.6, z: -rand }, { x: -rand * 0.7, z: rand }, -85),
  ];

  for (const n of nebenstrassen) schneideStreckeEin(terrain, n);
  schneideStreckeEin(terrain, strecke);

  /*
    Die Streckenhöhen an das eingeschnittene Terrain angleichen.

    Warum? Die Kurve ist glatt, das Terrain dagegen ein Gitter aus Punkten alle
    3,9 m. Zwischen zwei Gitterpunkten interpoliert Rapier geradlinig – die
    glatte Kurve und der eckige Kollisionskörper weichen also um einige
    Zentimeter voneinander ab.

    Würden wir das sichtbare Straßenband auf die glatte Kurve legen, führe das
    Auto (das ja auf dem Kollisionskörper fährt) sichtbar über oder unter der
    Straße. Indem wir die Höhen hier vom Terrain ablesen, stimmen Bild und
    Physik von vornherein überein.
  */
  for (const p of strecke.punkte) p.y = hoeheBei(terrain, p.x, p.z);
  for (const n of nebenstrassen) {
    for (const p of n.punkte) p.y = hoeheBei(terrain, p.x, p.z);
  }

  return { strecke, nebenstrassen };
}

/**
 * Erzeugt eine offene Nebenstraße zwischen zwei Punkten.
 *
 * Sie wird genauso ins Terrain eingeschnitten wie der Rundkurs und braucht
 * deshalb ebenfalls keinen eigenen Kollisionskörper. Anders als der Rundkurs
 * ist sie nicht geschlossen – Anfang und Ende hängen in der Landschaft.
 */
export function erzeugeNebenstrasse(
  terrain: Terraindaten,
  von: { x: number; z: number },
  nach: { x: number; z: number },
  /** Seitliche Auslenkung in der Mitte, damit die Straße nicht schnurgerade ist. */
  schwung = 90,
): Streckendaten {
  const mitteX = (von.x + nach.x) / 2;
  const mitteZ = (von.z + nach.z) / 2;
  // Senkrecht zur Verbindung auslenken
  const dx = nach.x - von.x;
  const dz = nach.z - von.z;
  const laenge = Math.hypot(dx, dz) || 1;
  const nx = -dz / laenge;
  const nz = dx / laenge;

  const kurve = new CatmullRomCurve3(
    [
      new Vector3(von.x, 0, von.z),
      new Vector3(mitteX + nx * schwung, 0, mitteZ + nz * schwung),
      new Vector3(mitteX - nx * schwung * 0.5, 0, mitteZ - nz * schwung * 0.5),
      new Vector3(nach.x, 0, nach.z),
    ],
    false,
    'catmullrom',
    0.5,
  );

  const anzahl = Math.max(32, Math.round(kurve.getLength() / STRECKE.abtastung));
  const roh = kurve.getSpacedPoints(anzahl - 1);

  // Höhen glätten wie beim Rundkurs, aber ohne Ringschluss
  let hoehen = roh.map((p) => hoeheBei(terrain, p.x, p.z));
  for (let d = 0; d < STRECKE.glaettung; d++) {
    const naechste = hoehen.slice();
    for (let i = 1; i < hoehen.length - 1; i++) {
      naechste[i] = (hoehen[i - 1] + hoehen[i] * 2 + hoehen[i + 1]) / 4;
    }
    hoehen = naechste;
  }

  const punkte: Streckenpunkt[] = [];
  let distanz = 0;
  for (let i = 0; i < roh.length; i++) {
    const p = roh[i];
    const naechster = roh[Math.min(i + 1, roh.length - 1)];
    const vorheriger = roh[Math.max(i - 1, 0)];
    let rx = naechster.x - vorheriger.x;
    let rz = naechster.z - vorheriger.z;
    const l = Math.hypot(rx, rz) || 1;
    rx /= l;
    rz /= l;
    if (i > 0) distanz += Math.hypot(p.x - roh[i - 1].x, p.z - roh[i - 1].z);
    punkte.push({ x: p.x, y: hoehen[i], z: p.z, rx, rz, distanz });
  }

  return { punkte, laenge: distanz, startIndex: 0 };
}

/** Sinnvolle Startposition: auf der Straße, in Fahrtrichtung. */
export function startAufStrecke(strecke: Streckendaten) {
  const p = strecke.punkte[strecke.startIndex];
  return {
    position: [p.x, p.y + 1.2, p.z] as [number, number, number],
    /** Drehung um die Hochachse, damit die Nase (+Z) entlang der Strecke zeigt. */
    gierWinkel: Math.atan2(p.rx, p.rz),
  };
}

/** Nur zur Sicherheit: passt der Kurs überhaupt aufs Terrain? */
export function streckeInGrenzen(strecke: Streckendaten) {
  const grenze = WELT.groesse / 2 - (STRECKE.breite / 2 + STRECKE.bankett + STRECKE.uebergang);
  return strecke.punkte.every((p) => Math.abs(p.x) < grenze && Math.abs(p.z) < grenze);
}
