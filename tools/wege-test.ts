/**
 * Prüft, ob alle Fahrwege wirklich frei befahrbar sind.
 *
 * Der Fehler, den dieser Test findet: Bäume, Felsen, Büsche, Heuballen und
 * Leitplanken kannten früher nur den Rundkurs. Auf den Nebenstraßen und
 * Geländepisten standen deshalb Büsche und quer liegende Leitplanken – die
 * Wege waren schlicht nicht durchfahrbar.
 *
 * Aufruf:  npm run wege
 */
import { WELT, erzeugeTerrain, hoeheBei, steigungBei } from '../src/game/world/heightmap';
import { STRECKE, erzeugeWelt } from '../src/game/world/strecke';
import { baueStrassennetz } from '../src/game/world/strassennetz';
import { OFFROAD, PISTEN_WEGE, machePiste } from '../src/game/world/Offroad';
import { planeHaufen } from '../src/game/world/Heuballen';

const terrain = erzeugeTerrain();
const { strecke, nebenstrassen } = erzeugeWelt(terrain);

/** Zwischenpunkte einfügen – wie in Scene.tsx. */
function verdichte(punkte: { x: number; z: number }[], abstand: number) {
  const dicht: { x: number; z: number }[] = [];
  for (let i = 0; i < punkte.length - 1; i++) {
    const a = punkte[i];
    const b = punkte[i + 1];
    const laenge = Math.hypot(b.x - a.x, b.z - a.z);
    const schritte = Math.max(1, Math.round(laenge / abstand));
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
  ...PISTEN_WEGE().map((w) => ({
    punkte: verdichte(w, 6),
    breite: OFFROAD.pistenBreite + 6,
  })),
]);

console.log('\n=== Wege-Test ===\n');

// Dieselben Regeln wie in den Komponenten
const REGELN = {
  baeume: 10,
  felsen: 6,
  buesche: 6,
};

/** Zählt, wie viele der erzeugten Objekte auf einem Weg landen würden. */
function pruefeVerteilung(name: string, anzahl: number, keim: number, maxSteigung: number, minAbstand: number) {
  let a = keim >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rand = WELT.groesse / 2 - 25;
  let gesetzt = 0;
  let aufWeg = 0;
  let versuche = 0;
  while (gesetzt < anzahl && versuche < anzahl * 40) {
    versuche++;
    const x = (rnd() - 0.5) * 2 * rand;
    const z = (rnd() - 0.5) * 2 * rand;
    if (netz.randabstand(x, z) < minAbstand) continue;
    if (steigungBei(terrain, x, z) > maxSteigung) continue;
    gesetzt++;
    // Gegenprobe: liegt der Platz trotzdem auf einer Fahrbahn?
    if (netz.randabstand(x, z) < 0) aufWeg++;
  }
  console.log(`   ${name.padEnd(9)} ${String(gesetzt).padStart(4)} platziert, ${aufWeg} auf einer Fahrbahn ${aufWeg === 0 ? 'ok' : 'FEHLER'}`);
}

console.log('1) Platzierung von Bewuchs');
pruefeVerteilung('Bäume', 620, 4242, 0.55, REGELN.baeume);
pruefeVerteilung('Felsen', 260, 20261, 0.85, REGELN.felsen);
pruefeVerteilung('Büsche', 420, 20268, 0.6, REGELN.buesche);

// --- Heuballen ---
{
  const ballen = planeHaufen(terrain, strecke, netz);
  const drauf = ballen.filter((b) => netz.randabstand(b.x, b.z) < 0).length;
  console.log(`   ${'Heuballen'.padEnd(9)} ${String(ballen.length).padStart(4)} platziert, ${drauf} auf einer Fahrbahn ${drauf === 0 ? 'ok' : 'FEHLER'}`);
}

// --- Sind die Wege selbst frei und fahrbar? ---
console.log('\n2) Befahrbarkeit der Wege');
const wege: { name: string; punkte: { x: number; z: number }[] }[] = [
  { name: 'Rundkurs', punkte: strecke.punkte },
  ...nebenstrassen.map((s, i) => ({ name: `Nebenstraße ${i + 1}`, punkte: s.punkte })),
  ...PISTEN_WEGE().map((w, i) => ({
    name: `Piste ${i + 1}`,
    punkte: machePiste(terrain, w).map((p) => ({ x: p.x, z: p.z })),
  })),
];

for (const weg of wege) {
  let maxSteigung = 0;
  let ausserhalb = 0;
  const rand = WELT.groesse / 2;
  for (let i = 0; i < weg.punkte.length - 1; i++) {
    const a = weg.punkte[i];
    const b = weg.punkte[i + 1];
    const strecke2d = Math.hypot(b.x - a.x, b.z - a.z);
    if (strecke2d < 0.5) continue;
    const dh = Math.abs(hoeheBei(terrain, b.x, b.z) - hoeheBei(terrain, a.x, a.z));
    maxSteigung = Math.max(maxSteigung, dh / strecke2d);
    if (Math.abs(a.x) > rand || Math.abs(a.z) > rand) ausserhalb++;
  }
  const grad = ((Math.atan(maxSteigung) * 180) / Math.PI).toFixed(0);
  console.log(
    `   ${weg.name.padEnd(14)} ${String(weg.punkte.length).padStart(5)} Punkte, ` +
      `steilste Stelle ${grad.padStart(2)}° ${Number(grad) < 32 ? 'fahrbar' : 'ZU STEIL'}` +
      `${ausserhalb > 0 ? `, ${ausserhalb} Punkte außerhalb der Karte!` : ''}`,
  );
}
console.log('');
