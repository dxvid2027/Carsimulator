/**
 * Prüft das Terrain, ohne den Browser zu starten.
 *
 * Die wichtigste Frage: Stimmt Rapiers Kollisionskörper mit den Höhen überein,
 * die auch das sichtbare Mesh benutzt? Wenn nicht, schwebt das Auto über dem
 * Boden oder versinkt darin – ein Fehler, den man visuell leicht übersieht.
 *
 * Aufruf:  npm run terrain
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { WELT, erzeugeTerrain, hoeheBei, steigungBei } from '../src/game/world/heightmap';

await RAPIER.init();

const daten = erzeugeTerrain();
const punkte = daten.aufloesung + 1;

console.log('\n=== Terrain-Test ===\n');
console.log('1) Heightmap');
console.log(`   ${WELT.groesse} × ${WELT.groesse} m, ${punkte} × ${punkte} Höhenpunkte`);
console.log(`   Zellgröße: ${(WELT.groesse / WELT.aufloesung).toFixed(2)} m`);
console.log(`   Höhen von ${daten.minHoehe.toFixed(1)} m bis ${daten.maxHoehe.toFixed(1)} m`);
console.log(`   Speicher: ${(daten.hoehen.byteLength / 1024).toFixed(0)} kB\n`);

// --- Startbereich muss flach sein ---
{
  let maxAbweichung = 0;
  let maxSteigung = 0;
  for (let i = 0; i < 400; i++) {
    const winkel = (i / 400) * Math.PI * 2;
    for (const r of [0, 15, 30, 45, 60]) {
      const x = Math.cos(winkel) * r;
      const z = Math.sin(winkel) * r;
      maxAbweichung = Math.max(maxAbweichung, Math.abs(hoeheBei(daten, x, z)));
      maxSteigung = Math.max(maxSteigung, steigungBei(daten, x, z));
    }
  }
  console.log('2) Startbereich (Radius 60 m)');
  console.log(`   max. Höhenabweichung: ${maxAbweichung.toFixed(3)} m ${maxAbweichung < 0.05 ? '(flach)' : '(NICHT flach!)'}`);
  console.log(`   max. Steigung: ${(maxSteigung * 100).toFixed(1)} %\n`);
}

// --- Kollisionskörper gegen Höhen-Array prüfen ---
{
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(
    RAPIER.ColliderDesc.heightfield(daten.aufloesung, daten.aufloesung, daten.hoehen, {
      x: WELT.groesse,
      y: 1,
      z: WELT.groesse,
    }),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed()),
  );
  world.step(); // Broad-Phase aufbauen, sonst trifft kein Raycast

  const START_Y = 400;
  const strahl = (x: number, z: number) => {
    const hit = world.castRay(
      new RAPIER.Ray({ x, y: START_Y, z }, { x: 0, y: -1, z: 0 }),
      1000,
      true,
    );
    return hit ? START_Y - hit.timeOfImpact : null;
  };

  // a) Exakt auf Gitterpunkten – hier müssen die Werte identisch sein
  let maxFehlerGitter = 0;
  let fehlversuche = 0;
  for (let n = 0; n < 500; n++) {
    const ix = 1 + Math.floor(Math.random() * (punkte - 2));
    const iz = 1 + Math.floor(Math.random() * (punkte - 2));
    const x = (ix / daten.aufloesung - 0.5) * WELT.groesse;
    const z = (iz / daten.aufloesung - 0.5) * WELT.groesse;
    const erwartet = daten.hoehen[iz + ix * punkte];
    const gemessen = strahl(x, z);
    if (gemessen === null) fehlversuche++;
    else maxFehlerGitter = Math.max(maxFehlerGitter, Math.abs(gemessen - erwartet));
  }

  // b) Mitten in den Zellen – kleine Abweichung ist normal, weil Rapier
  //    pro Zelle zwei Dreiecke benutzt, unsere Funktion aber bilinear rechnet
  let maxFehlerZelle = 0;
  for (let n = 0; n < 500; n++) {
    const x = (Math.random() - 0.5) * (WELT.groesse - 20);
    const z = (Math.random() - 0.5) * (WELT.groesse - 20);
    const gemessen = strahl(x, z);
    if (gemessen !== null) {
      maxFehlerZelle = Math.max(maxFehlerZelle, Math.abs(gemessen - hoeheBei(daten, x, z)));
    }
  }

  console.log('3) Kollisionskörper vs. Höhen-Array');
  console.log(`   auf Gitterpunkten:  max. Fehler ${maxFehlerGitter.toFixed(4)} m ${maxFehlerGitter < 0.01 ? '(passt exakt)' : '(FALSCHE INDIZIERUNG!)'}`);
  console.log(`   in Zellmitten:      max. Fehler ${maxFehlerZelle.toFixed(3)} m ${maxFehlerZelle < 1.0 ? '(erwartungsgemäß klein)' : '(zu groß!)'}`);
  console.log(`   Strahlen ohne Treffer: ${fehlversuche} von 500 ${fehlversuche === 0 ? '(Terrain lückenlos)' : '(LÖCHER im Terrain!)'}\n`);

  // c) Ränder – fällt das Auto an der Kante ins Nichts?
  const rand = WELT.groesse / 2;
  const ecken: [number, number][] = [
    [-rand + 0.5, -rand + 0.5],
    [rand - 0.5, -rand + 0.5],
    [-rand + 0.5, rand - 0.5],
    [rand - 0.5, rand - 0.5],
    [0, rand - 0.5],
    [rand - 0.5, 0],
  ];
  const treffer = ecken.filter(([x, z]) => strahl(x, z) !== null).length;
  console.log('4) Ränder');
  console.log(`   ${treffer} von ${ecken.length} Randpunkten haben Boden ${treffer === ecken.length ? '(vollständig)' : '(Lücken am Rand)'}\n`);
}

// --- Steigungen: ist das Terrain überhaupt befahrbar? ---
{
  let summe = 0;
  let maxS = 0;
  let zuSteil = 0;
  const proben = 4000;
  for (let i = 0; i < proben; i++) {
    const x = (Math.random() - 0.5) * (WELT.groesse - 40);
    const z = (Math.random() - 0.5) * (WELT.groesse - 40);
    const s = steigungBei(daten, x, z);
    summe += s;
    maxS = Math.max(maxS, s);
    if (s > 0.6) zuSteil++; // steiler als ca. 37° -> kaum befahrbar
  }
  const grad = (s: number) => ((Math.asin(s) * 180) / Math.PI).toFixed(0);
  console.log('5) Befahrbarkeit');
  console.log(`   mittlere Neigung: ${grad(summe / proben)}°`);
  console.log(`   steilste Stelle:  ${grad(maxS)}°`);
  console.log(`   ${((zuSteil / proben) * 100).toFixed(1)} % der Fläche steiler als 37°\n`);
}
