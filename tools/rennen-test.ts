/**
 * Prüft die Rennlogik ohne Browser.
 *
 * Aufruf:  npm run rennen
 */
import { erzeugeTerrain } from '../src/game/world/heightmap';
import { erzeugeWelt } from '../src/game/world/strecke';
import {
  RENNEN_EINSTELLUNGEN,
  rennen,
  rennenAktualisieren,
  rennenBeenden,
  rennenStarten,
  rennenVorbereiten,
  startzone,
  zeitText,
} from '../src/game/race/rennen';

// localStorage gibt es in Node nicht – die Bestzeit wird dann eben nicht gemerkt
const terrain = erzeugeTerrain();
const { strecke } = erzeugeWelt(terrain);
rennenVorbereiten(strecke);

console.log('\n=== Rennen-Test ===\n');
console.log('1) Kontrollpunkte');
console.log(`   ${rennen.checkpoints.length} Stück auf ${strecke.laenge.toFixed(0)} m`);
let minAbstand = Infinity;
for (let i = 0; i < rennen.checkpoints.length; i++) {
  const a = rennen.checkpoints[i];
  const b = rennen.checkpoints[(i + 1) % rennen.checkpoints.length];
  minAbstand = Math.min(minAbstand, Math.hypot(a.x - b.x, a.z - b.z));
}
console.log(`   kleinster Abstand zwischen zwei Toren: ${minAbstand.toFixed(0)} m`);
console.log(
  `   Erfassungsradius ${RENNEN_EINSTELLUNGEN.checkpointRadius} m -> ` +
    `${minAbstand > RENNEN_EINSTELLUNGEN.checkpointRadius * 3 ? 'kein Überschneiden' : 'TORE ZU DICHT (man könnte zwei auf einmal auslösen)'}`,
);

// --- Zustandsablauf durchspielen ---
const DT = 1 / 60;
const zone = startzone()!;

console.log('\n2) Ablauf');
console.log(`   Phase am Anfang: ${rennen.phase} ${rennen.phase === 'frei' ? '(freies Fahren)' : '(FALSCH)'}`);

// Weit weg vom Start -> nichts passiert
rennenAktualisieren(DT, { x: 0, y: 0, z: 0 }, 80);
console.log(`   weit weg von der Zone: ${rennen.phase} ${rennen.phase === 'frei' ? 'ok' : 'FALSCH'}`);

// In die Zone fahren, aber zu schnell
rennenAktualisieren(DT, zone, 120);
console.log(`   in der Zone mit 120 km/h: ${rennen.phase} ${rennen.phase === 'frei' ? 'ok (zu schnell)' : 'FALSCH'}`);

// Langsam in der Zone
rennenAktualisieren(DT, zone, 10);
console.log(`   in der Zone mit 10 km/h: ${rennen.phase} ${rennen.phase === 'bereit' ? 'ok (Einladung)' : 'FALSCH'}`);

// Wieder wegfahren -> Einladung verschwindet
rennenAktualisieren(DT, { x: zone.x + 200, y: 0, z: zone.z }, 10);
console.log(`   wieder weggefahren: ${rennen.phase} ${rennen.phase === 'frei' ? 'ok' : 'FALSCH'}`);

// Zurück und starten
rennenAktualisieren(DT, zone, 5);
rennenStarten();
console.log(`   nach Start: ${rennen.phase} ${rennen.phase === 'countdown' ? 'ok' : 'FALSCH'}`);

// Countdown abwarten
let frames = 0;
while (rennen.phase === 'countdown' && frames < 60 * 10) {
  rennenAktualisieren(DT, zone, 0);
  frames++;
}
console.log(`   Countdown dauerte ${(frames / 60).toFixed(1)} s -> ${rennen.phase} ${rennen.phase === 'laeuft' ? 'ok' : 'FALSCH'}`);

// --- Runden fahren: das Auto entlang der Strecke bewegen ---
console.log('\n3) Runden fahren (simuliertes Abfahren der Strecke mit 110 km/h)');
const tempo = 110 / 3.6; // m/s
/*
  Beim Kontrollpunkt 0 losfahren, nicht bei Streckenpunkt 0.
  Die Startzone liegt bewusst nicht am Startplatz des Autos – würde der Test
  bei Streckenpunkt 0 beginnen, enthielte die erste Runde zusätzlich die
  Anfahrt zum Tor und die Zeit sähe falsch aus.
*/
let strecke_i = strecke.punkte.reduce(
  (best, p, i) =>
    Math.hypot(p.x - zone.x, p.z - zone.z) <
    Math.hypot(strecke.punkte[best].x - zone.x, strecke.punkte[best].z - zone.z)
      ? i
      : best,
  0,
);
let sicherung = 0;
const rundenZeiten: number[] = [];
let letzteRunde = 1;

while (rennen.phase === 'laeuft' && sicherung++ < 60 * 60 * 6) {
  // Ein Stück entlang der Stützpunkte weiterrücken
  const proSchritt = (tempo * DT) / 2; // Stützpunkte liegen 2 m auseinander
  strecke_i = (strecke_i + proSchritt) % strecke.punkte.length;
  const p = strecke.punkte[Math.floor(strecke_i)];
  rennenAktualisieren(DT, p, 110);
  if (rennen.runde !== letzteRunde) {
    rundenZeiten.push(rennen.letzteRunde);
    letzteRunde = rennen.runde;
  }
}
if (rennen.letzteRunde > 0 && rundenZeiten[rundenZeiten.length - 1] !== rennen.letzteRunde) {
  rundenZeiten.push(rennen.letzteRunde);
}

const erwartet = strecke.laenge / tempo;
console.log(`   Phase am Ende: ${rennen.phase} ${rennen.phase === 'beendet' ? 'ok (Ziel)' : 'FALSCH'}`);
console.log(`   gefahrene Runden: ${rundenZeiten.length} (erwartet ${RENNEN_EINSTELLUNGEN.runden})`);
rundenZeiten.forEach((z, i) => console.log(`     Runde ${i + 1}: ${zeitText(z)}`));
console.log(`   theoretisch nötig: ${zeitText(erwartet)} pro Runde`);
const abweichung = rundenZeiten.length ? Math.abs(rundenZeiten[0] - erwartet) : 999;
console.log(`   Abweichung: ${abweichung.toFixed(2)} s ${abweichung < 2 ? '(Zeitmessung plausibel)' : '(ZEITMESSUNG FALSCH)'}`);
console.log(`   Gesamtzeit: ${zeitText(rennen.gesamtzeit)}`);

// --- Abkürzen soll nicht funktionieren ---
console.log('\n4) Abkürzen');
rennenBeenden();
rennenAktualisieren(DT, zone, 5);
rennenStarten();
while (rennen.phase === 'countdown') rennenAktualisieren(DT, zone, 0);
// Direkt zum vorletzten Kontrollpunkt springen und dann ins Ziel
const vorletzter = rennen.checkpoints[rennen.checkpoints.length - 1];
for (let i = 0; i < 120; i++) rennenAktualisieren(DT, vorletzter, 110);
for (let i = 0; i < 120; i++) rennenAktualisieren(DT, zone, 110);
console.log(`   nach Sprung ans Ziel: Runde ${rennen.runde}, nächster Kontrollpunkt ${rennen.naechsterCheckpoint}`);
console.log(
  `   ${rennen.runde <= 1 && rennen.naechsterCheckpoint === 1 ? 'ok – die Runde zählt nicht ohne die Kontrollpunkte dazwischen' : 'ABKÜRZEN MÖGLICH'}`,
);
console.log('');
