/**
 * Prüft die besonderen Orte der Welt – vor allem den eingeebneten Stuntpark.
 *
 * Die Fehler, die dieser Test findet:
 *  1. Der Stuntpark steht im Hang. Rampen und Plattform sind gerade Körper –
 *     im Hang hängt eine Ecke in der Luft und man springt daneben.
 *  2. Die eingeebnete Fläche reicht bis an die Straße und verbiegt die
 *     eingeschnittene Fahrbahn.
 *  3. Der eingeebnete Boden verschiebt den Fundort selbst. Der Park wird nach
 *     dem Einebnen erneut gesucht (in Stuntpark.tsx und auf der Karte) – käme
 *     dann ein anderer Ort heraus, stünden Rampen und Karte woanders.
 *
 * Aufruf:  npm run orte
 */
import { WELT, ebneFlaeche, erzeugeTerrain, hoeheBei, steigungBei } from '../src/game/world/heightmap';
import { STRECKE, erzeugeWelt } from '../src/game/world/strecke';
import { baueStrassennetz } from '../src/game/world/strassennetz';
import { OFFROAD, PISTEN_WEGE } from '../src/game/world/Offroad';
import {
  STRASSENBAUTEN,
  STUNTPARK,
  aussichtsturmOrt,
  bauernhofOrt,
  dorfOrt,
  felsenfeldOrt,
  strassenplatz,
  stuntparkOrt,
  windmuehleOrt,
} from '../src/game/world/orte';

const terrain = erzeugeTerrain();
const { strecke, nebenstrassen } = erzeugeWelt(terrain);

function verdichte(punkte: { x: number; z: number }[], abstand: number) {
  const dicht: { x: number; z: number }[] = [];
  for (let i = 0; i < punkte.length - 1; i++) {
    const a = punkte[i];
    const b = punkte[i + 1];
    const schritte = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / abstand));
    for (let k = 0; k < schritte; k++) {
      const t = k / schritte;
      dicht.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  dicht.push(punkte[punkte.length - 1]);
  return dicht;
}

const netz = baueStrassennetz([
  { punkte: strecke.punkte, breite: STRECKE.breite + STRECKE.bankett * 2 },
  ...nebenstrassen.map((s) => ({ punkte: s.punkte, breite: 8.5 + 5 })),
  ...PISTEN_WEGE().map((w) => ({ punkte: verdichte(w, 6), breite: OFFROAD.pistenBreite + 6 })),
]);

console.log('\n=== Orte-Test ===\n');

const vorher = stuntparkOrt(terrain, netz);

// Höhen der Strecke merken, um später Verformungen zu erkennen
const streckenhoehen = strecke.punkte.map((p) => hoeheBei(terrain, p.x, p.z));

// ... genau wie in Scene.tsx
ebneFlaeche(terrain, vorher.x, vorher.z, STUNTPARK.radius, STUNTPARK.uebergang);

const nachher = stuntparkOrt(terrain, netz);

let fehler = 0;
function pruefe(name: string, ok: boolean, text: string) {
  console.log(`${ok ? '  ok  ' : ' FEHL '} ${name}: ${text}`);
  if (!ok) fehler++;
}

// 1. Der Ort bleibt derselbe
const verschiebung = Math.hypot(nachher.x - vorher.x, nachher.z - vorher.z);
pruefe(
  'Ort stabil',
  verschiebung < 0.001,
  `Stuntpark bei (${vorher.x.toFixed(0)}, ${vorher.z.toFixed(0)}), Verschiebung nach dem Einebnen ${verschiebung.toFixed(3)} m`,
);

// 2. Die Fläche ist eben – überall dort, wo etwas steht
let maxAbweichung = 0;
let maxSteigung = 0;
for (let i = 0; i < 400; i++) {
  const winkel = (i / 400) * Math.PI * 2;
  for (const r of [0, 15, 30, 45, 52]) {
    const x = vorher.x + Math.cos(winkel) * r;
    const z = vorher.z + Math.sin(winkel) * r;
    maxAbweichung = Math.max(maxAbweichung, Math.abs(hoeheBei(terrain, x, z) - nachher.y));
    maxSteigung = Math.max(maxSteigung, steigungBei(terrain, x, z));
  }
}
pruefe(
  'Parkboden eben',
  maxAbweichung < 0.05,
  `größte Höhenabweichung im Radius 52 m: ${maxAbweichung.toFixed(3)} m, größte Steigung ${(maxSteigung * 100).toFixed(1)} %`,
);

// 3. Keine Straße wurde verformt
let maxStrassenAenderung = 0;
strecke.punkte.forEach((p, i) => {
  maxStrassenAenderung = Math.max(
    maxStrassenAenderung,
    Math.abs(hoeheBei(terrain, p.x, p.z) - streckenhoehen[i]),
  );
});
pruefe(
  'Straßen unberührt',
  maxStrassenAenderung < 0.001,
  `größte Höhenänderung auf dem Rundkurs: ${maxStrassenAenderung.toFixed(4)} m`,
);

// 4. Abstand zur Straße größer als die eingeebnete Fläche
const strassenabstand = netz.randabstand(vorher.x, vorher.z);
pruefe(
  'Abstand zur Straße',
  strassenabstand > STUNTPARK.radius + STUNTPARK.uebergang,
  `${strassenabstand.toFixed(0)} m (Fläche reicht bis ${STUNTPARK.radius + STUNTPARK.uebergang} m)`,
);

// 5. Die Orte liegen nicht übereinander
const dorf = dorfOrt(terrain, netz);
const muehle = windmuehleOrt(terrain, netz);
const felsen = felsenfeldOrt(terrain, netz);
const orte = [
  ['Stuntpark', nachher],
  ['Dorf', dorf],
  ['Windmühle', muehle],
  ['Felsenfeld', felsen],
  ['Aussichtsturm', aussichtsturmOrt(terrain, netz)],
  ['Bauernhof', bauernhofOrt(terrain, netz)],
] as const;
let minAbstand = Infinity;
let paar = '';
for (let i = 0; i < orte.length; i++) {
  for (let k = i + 1; k < orte.length; k++) {
    const d = Math.hypot(orte[i][1].x - orte[k][1].x, orte[i][1].z - orte[k][1].z);
    if (d < minAbstand) {
      minAbstand = d;
      paar = `${orte[i][0]} <-> ${orte[k][0]}`;
    }
  }
}
pruefe('Orte getrennt', minAbstand > 120, `engstes Paar ${paar}: ${minAbstand.toFixed(0)} m`);

// 6. Alle Orte liegen im Weltgebiet
const rand = WELT.groesse / 2 - 60;
const drin = orte.every(([, o]) => Math.abs(o.x) < rand && Math.abs(o.z) < rand);
pruefe('Orte in der Welt', drin, orte.map(([n, o]) => `${n} (${o.x.toFixed(0)}, ${o.z.toFixed(0)})`).join(', '));

// 7. Bauplätze am Straßenrand: neben der Fahrbahn und richtig gedreht
const plaetze: [string, ReturnType<typeof strassenplatz>][] = [
  [
    'Tankstelle',
    strassenplatz(
      terrain, strecke, STRASSENBAUTEN.tankstelle.anteil, STRASSENBAUTEN.tankstelle.seitlich,
    ),
  ],
  ...STRASSENBAUTEN.rampen.map(
    (r, i) =>
      [`Rampe ${i + 1}`, strassenplatz(terrain, strecke, r.anteil, r.seitlich)] as [
        string,
        ReturnType<typeof strassenplatz>,
      ],
  ),
];
for (const [name, pl] of plaetze) {
  const d = netz.randabstand(pl.x, pl.z);
  // Ein Schritt in Blickrichtung muss näher an die Straße führen
  const vorX = pl.x + Math.sin(pl.gier) * 8;
  const vorZ = pl.z + Math.cos(pl.gier) * 8;
  const dVor = netz.randabstand(vorX, vorZ);
  pruefe(
    `Bauplatz ${name}`,
    d > 4 && dVor < d,
    `${d.toFixed(1)} m neben der Fahrbahn, Blickrichtung führt auf ${dVor.toFixed(1)} m heran`,
  );
}

console.log(`\n${fehler === 0 ? 'Alle Prüfungen bestanden.' : `${fehler} Prüfung(en) fehlgeschlagen.`}\n`);
