/**
 * Prüft den Rundkurs, ohne den Browser zu starten.
 *
 * Aufruf:  npm run strecke
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { WELT, erzeugeTerrain, hoeheBei } from '../src/game/world/heightmap';
import { STRECKE, erzeugeWelt, abstandZurStrecke, bewerteStrecke, streckeInGrenzen } from '../src/game/world/strecke';

await RAPIER.init();

const terrain = erzeugeTerrain();
const { strecke } = erzeugeWelt(terrain);

console.log('\n=== Strecken-Test ===\n');
console.log('1) Form');
console.log(`   Länge: ${strecke.laenge.toFixed(0)} m, ${strecke.punkte.length} Stützpunkte`);
console.log(`   Fahrbahn ${STRECKE.breite} m + ${STRECKE.bankett} m Bankett je Seite`);
console.log(`   passt aufs Terrain: ${streckeInGrenzen(strecke) ? 'ja' : 'NEIN – Radius verkleinern!'}`);

// --- Kurvenradien: gibt es Haarnadeln, die man nicht fahren kann? ---
{
  const schritt = Math.max(1, Math.round(12 / STRECKE.abtastung)); // ca. 12 m Basis
  let engster = Infinity;
  let engsterIndex = 0;
  for (let i = 0; i < strecke.punkte.length; i++) {
    const a = strecke.punkte[i];
    const b = strecke.punkte[(i + schritt) % strecke.punkte.length];
    const c = strecke.punkte[(i + 2 * schritt) % strecke.punkte.length];
    // Radius des Kreises durch drei Punkte
    const ab = Math.hypot(b.x - a.x, b.z - a.z);
    const bc = Math.hypot(c.x - b.x, c.z - b.z);
    const ca = Math.hypot(a.x - c.x, a.z - c.z);
    const flaeche = Math.abs((b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z)) / 2;
    if (flaeche < 1e-6) continue;
    const r = (ab * bc * ca) / (4 * flaeche);
    if (r < engster) {
      engster = r;
      engsterIndex = i;
    }
  }
  // Wie schnell kann man diese Kurve fahren? v = sqrt(mu * g * r)
  const tempo = Math.sqrt(1.0 * 9.81 * engster) * 3.6;
  console.log('\n2) Kurven');
  console.log(`   engster Radius: ${engster.toFixed(0)} m bei Streckenmeter ${strecke.punkte[engsterIndex].distanz.toFixed(0)}`);
  console.log(`   dort etwa ${tempo.toFixed(0)} km/h möglich ${tempo > 55 ? '(fahrbar)' : '(sehr eng)'}`);
}

// --- Ist das Terrain unter der Straße wirklich flach? ---
{
  let maxQuerneigung = 0;
  let maxAbweichung = 0;
  const halb = STRECKE.breite / 2;
  for (let i = 0; i < strecke.punkte.length; i += 5) {
    const p = strecke.punkte[i];
    // Quer zur Fahrtrichtung (Normale in XZ)
    const nx = -p.rz;
    const nz = p.rx;
    const links = hoeheBei(terrain, p.x + nx * halb, p.z + nz * halb);
    const rechts = hoeheBei(terrain, p.x - nx * halb, p.z - nz * halb);
    maxQuerneigung = Math.max(maxQuerneigung, Math.abs(links - rechts) / STRECKE.breite);
    maxAbweichung = Math.max(maxAbweichung, Math.abs(hoeheBei(terrain, p.x, p.z) - p.y));
  }
  console.log('\n3) Fahrbahn im Terrain');
  console.log(`   Höhe Terrain vs. Strecke: max ${maxAbweichung.toFixed(3)} m Abweichung ${maxAbweichung < 0.05 ? '(eingeschnitten)' : '(NICHT eingeschnitten!)'}`);
  console.log(`   max. Querneigung: ${((Math.atan(maxQuerneigung) * 180) / Math.PI).toFixed(2)}° ${maxQuerneigung < 0.05 ? '(eben)' : '(Fahrbahn haengt schief)'}`);
}

// --- Kollisionskörper prüfen: liegt der Boden wirklich auf Straßenhöhe? ---
{
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(
    RAPIER.ColliderDesc.heightfield(terrain.aufloesung, terrain.aufloesung, terrain.hoehen, {
      x: WELT.groesse, y: 1, z: WELT.groesse,
    }),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed()),
  );
  world.step();
  let maxFehler = 0;
  let ohneTreffer = 0;
  for (let i = 0; i < strecke.punkte.length; i += 3) {
    const p = strecke.punkte[i];
    const hit = world.castRay(new RAPIER.Ray({ x: p.x, y: 300, z: p.z }, { x: 0, y: -1, z: 0 }), 900, true);
    if (!hit) { ohneTreffer++; continue; }
    maxFehler = Math.max(maxFehler, Math.abs(300 - hit.timeOfImpact - p.y));
  }
  console.log('\n4) Kollisionskörper auf der Strecke');
  console.log(`   max. Abweichung zur Fahrbahnhöhe: ${maxFehler.toFixed(3)} m ${maxFehler < 0.15 ? '(passt)' : '(Auto wuerde schweben/einsinken)'}`);
  console.log(`   Stellen ohne Boden: ${ohneTreffer} ${ohneTreffer === 0 ? '(keine Löcher)' : '(LÖCHER!)'}`);
}

// --- Qualitaetskriterien mit derselben Funktion wie die Streckenerzeugung ---
{
  const g = bewerteStrecke(strecke);
  const wirkbreite = STRECKE.breite / 2 + STRECKE.bankett + STRECKE.uebergang;
  const grad = (s: number) => ((Math.atan(s) * 180) / Math.PI).toFixed(1);
  console.log('\n5) Qualitaet des Kurses');
  console.log(`   Selbstabstand:    ${g.selbstabstand.toFixed(0)} m (mind. ${STRECKE.minSelbstabstand}) ${g.selbstabstand >= STRECKE.minSelbstabstand ? 'ok' : 'ZU NAH – Einschnitte ueberlagern sich'}`);
  console.log(`   engster Radius:   ${g.minKurvenradius.toFixed(0)} m (mind. ${STRECKE.minKurvenradius}) ${g.minKurvenradius >= STRECKE.minKurvenradius ? 'ok' : 'HAARNADEL'}`);
  /*
    Achtung, zwei verschiedene Zahlen:
    `bewerteStrecke` misst die glatte Kurve – nach dieser Zahl wählt die
    Erzeugung den Zufallskeim aus. Was das Auto tatsächlich fährt, ist die
    aufs Terrain-Gitter gerastete Fahrbahn; die ist ein paar Prozent steiler.
    Als fahrbar gelten bis etwa 15°.
  */
  const basis = Math.max(1, Math.round(10 / STRECKE.abtastung));
  let echteSteigung = 0;
  for (let i = 0; i < strecke.punkte.length; i++) {
    const a2 = strecke.punkte[i];
    const b2 = strecke.punkte[(i + basis) % strecke.punkte.length];
    const weg = Math.hypot(b2.x - a2.x, b2.z - a2.z);
    if (weg < 1) continue;
    echteSteigung = Math.max(echteSteigung, Math.abs(b2.y - a2.y) / weg);
  }
  console.log(`   Steigung glatte Kurve: ${grad(g.maxSteigung)}° (Vorgabe max. ${grad(STRECKE.maxSteigung)}°) ${g.maxSteigung <= STRECKE.maxSteigung ? 'ok' : 'ZU STEIL'}`);
  console.log(`   Steigung tatsaechlich: ${grad(echteSteigung)}° ueber 10 m ${echteSteigung < 0.27 ? '(fahrbar)' : '(ZU STEIL)'}`);
  console.log(`   passt aufs Terrain: ${g.passtAufsTerrain ? 'ja' : 'NEIN'}`);
  console.log(`   (Einschnitt reicht ${wirkbreite.toFixed(0)} m je Seite ins Gelaende)`);
  const hoehen = strecke.punkte.map((p) => p.y);
  console.log(`   Hoehenbereich der Fahrbahn: ${Math.min(...hoehen).toFixed(1)} m bis ${Math.max(...hoehen).toFixed(1)} m`);
}

// --- Abstandsfunktion (fuer Asphalt-Grip) ---
{
  const p = strecke.punkte[Math.floor(strecke.punkte.length / 3)];
  const aufStrasse = abstandZurStrecke(strecke, p.x, p.z).distanz;
  const daneben = abstandZurStrecke(strecke, p.x + (-p.rz) * 30, p.z + p.rx * 30).distanz;
  console.log('\n6) Abstandsfunktion');
  console.log(`   auf der Mittellinie: ${aufStrasse.toFixed(2)} m`);
  console.log(`   30 m daneben:        ${daneben.toFixed(1)} m ${daneben > 25 ? '(plausibel)' : '(falsch)'}`);
}
console.log('');
