/**
 * Prüft die Heuballen ohne Browser.
 *
 * Wichtig sind zwei Dinge:
 *   1. Liegen die Ballen sauber auf dem Boden und nicht in der Fahrbahn?
 *   2. Fliegen sie auseinander, wenn man hineinfährt – statt wie eine Mauer
 *      zu wirken oder durch den Boden zu fallen?
 *
 * Aufruf:  npm run heu
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { WELT, erzeugeTerrain, hoeheBei } from '../src/game/world/heightmap';
import { STRECKE, abstandZurStrecke, erzeugeWelt } from '../src/game/world/strecke';
import { HAUFEN, planeHaufen } from '../src/game/world/Heuballen';
import { FAHRZEUG, PHYSIK_DT, RAD_POSITIONEN, VORDERRAEDER } from '../src/game/config/vehicleConfig';
import { fahrschritt, neuerFahrZustand } from '../src/game/vehicle/fahrlogik';
import type { FahrEingabe } from '../src/game/input/useDrivingInput';

await RAPIER.init();

const terrain = erzeugeTerrain();
const strecke = erzeugeWelt(terrain);
const ballen = planeHaufen(terrain, strecke);

console.log('\n=== Heuballen-Test ===\n');
console.log('1) Platzierung');
console.log(`   ${ballen.length} Ballen in bis zu ${HAUFEN.anzahl} Haufen`);

// --- Liegen sie neben der Fahrbahn? ---
{
  let minAbstand = Infinity;
  let aufDerStrasse = 0;
  for (const b of ballen) {
    const d = abstandZurStrecke(strecke, b.x, b.z).distanz;
    minAbstand = Math.min(minAbstand, d);
    if (d < STRECKE.breite / 2) aufDerStrasse++;
  }
  console.log(`   kleinster Abstand zur Streckenmitte: ${minAbstand.toFixed(1)} m (Fahrbahn ist ${STRECKE.breite / 2} m breit)`);
  console.log(`   Ballen auf der Fahrbahn: ${aufDerStrasse} ${aufDerStrasse === 0 ? '(keiner blockiert die Strecke)' : '(BLOCKIEREN DIE STRECKE)'}`);
}

// --- Stecken welche im Boden oder schweben? ---
{
  let tiefsteUnterkante = Infinity;
  let hoechsteLuecke = 0;
  for (const b of ballen) {
    const boden = hoeheBei(terrain, b.x, b.z);
    const unterkante = b.y - HAUFEN.radius * b.groesse;
    tiefsteUnterkante = Math.min(tiefsteUnterkante, unterkante - boden);
    hoechsteLuecke = Math.max(hoechsteLuecke, unterkante - boden);
  }
  /*
    Der Abstand zum Boden ist nur für die UNTERE Reihe aussagekräftig.
    Gestapelte Ballen liegen selbstverständlich höher – sie ruhen auf den
    Ballen darunter, nicht auf dem Boden.
  */
  console.log(`   tiefster Ballen steckt ${(-tiefsteUnterkante).toFixed(2)} m im Boden ${tiefsteUnterkante > -0.25 ? '(ok)' : '(ZU TIEF)'}`);
  console.log(`   höchste Ballen-Unterkante: ${hoechsteLuecke.toFixed(2)} m über Grund (das sind die gestapelten)\n`);
}

// --- Physik: hineinfahren ---
{
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = PHYSIK_DT;
  world.createCollider(
    RAPIER.ColliderDesc.heightfield(terrain.aufloesung, terrain.aufloesung, terrain.hoehen, {
      x: WELT.groesse, y: 1, z: WELT.groesse,
    }),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed()),
  );

  // Den Haufen nehmen, der dem Startplatz am nächsten liegt
  const start = strecke.punkte[0];
  let ziel = ballen[0];
  let besteDistanz = Infinity;
  for (const b of ballen) {
    const d = Math.hypot(b.x - start.x, b.z - start.z);
    if (d < besteDistanz) { besteDistanz = d; ziel = b; }
  }
  // Alle Ballen dieses Haufens (im Umkreis von 6 m)
  const gruppe = ballen.filter((b) => Math.hypot(b.x - ziel.x, b.z - ziel.z) < 6);

  const koerper = gruppe.map((b) => {
    const rb = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(b.x, b.y, b.z)
        .setLinearDamping(0.35)
        .setAngularDamping(0.7),
    );
    // Zylinder liegt quer: um Z drehen
    const q = { x: 0, y: Math.sin(b.gier / 2), z: 0, w: Math.cos(b.gier / 2) };
    const halb = Math.sin(Math.PI / 4);
    rb.setRotation(
      {
        x: q.w * 0 + q.x * halb + q.y * 0 - q.z * 0,
        y: q.w * 0 - q.x * 0 + q.y * halb + q.z * 0,
        z: q.w * halb + q.x * 0 - q.y * 0 + q.z * 0,
        w: q.w * halb - q.x * 0 - q.y * 0 - q.z * halb,
      },
      true,
    );
    const cd = RAPIER.ColliderDesc.cylinder((HAUFEN.laenge / 2) * b.groesse, HAUFEN.radius * b.groesse);
    cd.setMass(HAUFEN.masse);
    cd.setFriction(0.85);
    cd.setRestitution(0.06);
    world.createCollider(cd, rb);
    return rb;
  });

  // Auto 45 m vor dem Haufen, in dessen Richtung
  const richtung = { x: ziel.x - start.x, z: ziel.z - start.z };
  const laenge = Math.hypot(richtung.x, richtung.z) || 1;
  richtung.x /= laenge; richtung.z /= laenge;
  const autoX = ziel.x - richtung.x * 45;
  const autoZ = ziel.z - richtung.z * 45;
  const gier = Math.atan2(richtung.x, richtung.z);

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(autoX, hoeheBei(terrain, autoX, autoZ) + 1.4, autoZ)
      .setRotation({ x: 0, y: Math.sin(gier / 2), z: 0, w: Math.cos(gier / 2) })
      .setCanSleep(false)
      .setAngularDamping(FAHRZEUG.hilfen.winkelDaempfung),
  );
  const form = RAPIER.ColliderDesc.cuboid(
    FAHRZEUG.halbeGroesse.x, FAHRZEUG.halbeGroesse.y, FAHRZEUG.halbeGroesse.z,
  );
  form.setMassProperties(FAHRZEUG.masse, FAHRZEUG.schwerpunkt, FAHRZEUG.traegheit, { x:0,y:0,z:0,w:1 });
  world.createCollider(form, body);

  const controller = world.createVehicleController(body);
  controller.indexUpAxis = 1;
  controller.setIndexForwardAxis = 2;
  const { federung, grip, rad } = FAHRZEUG;
  for (const p of RAD_POSITIONEN) {
    controller.addWheel(p, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, federung.ruhelaenge, rad.radius);
  }
  for (let i = 0; i < 4; i++) {
    controller.setWheelSuspensionStiffness(i, federung.haerte);
    controller.setWheelSuspensionCompression(i, federung.daempfungDruck);
    controller.setWheelSuspensionRelaxation(i, federung.daempfungZug);
    controller.setWheelMaxSuspensionTravel(i, federung.maxWeg);
    controller.setWheelMaxSuspensionForce(i, federung.maxKraft);
    controller.setWheelFrictionSlip(i, VORDERRAEDER.includes(i as 0 | 1) ? grip.vorne : grip.hinten);
    controller.setWheelSideFrictionStiffness(i, grip.seite);
  }
  const zustand = neuerFahrZustand();
  const LEER: FahrEingabe = { gas: 0, bremse: 0, lenken: 0, handbremse: false, reset: false };
  const schritt = (e: Partial<FahrEingabe> = {}) => {
    fahrschritt(controller, body, { ...LEER, ...e }, zustand);
    world.step();
  };

  for (let i = 0; i < 120; i++) schritt();
  const vorher = koerper.map((k) => ({ ...k.translation() }));
  const autoTempoVorher: number[] = [];

  for (let i = 0; i < 60 * 8; i++) {
    schritt({ gas: 1 });
    autoTempoVorher.push(Math.abs(controller.currentVehicleSpeed()) * 3.6);
  }

  const nachher = koerper.map((k) => k.translation());
  let maxVersatz = 0;
  let bewegt = 0;
  let durchDenBoden = 0;
  for (let i = 0; i < koerper.length; i++) {
    const d = Math.hypot(nachher[i].x - vorher[i].x, nachher[i].z - vorher[i].z);
    maxVersatz = Math.max(maxVersatz, d);
    if (d > 1) bewegt++;
    if (nachher[i].y < hoeheBei(terrain, nachher[i].x, nachher[i].z) - 2) durchDenBoden++;
  }
  const tempoBeimTreffer = Math.max(...autoTempoVorher);
  const tempoDanach = Math.abs(controller.currentVehicleSpeed()) * 3.6;

  console.log('2) Durchfahren');
  console.log(`   Haufen aus ${koerper.length} Ballen, Anlauf mit bis zu ${tempoBeimTreffer.toFixed(0)} km/h`);
  console.log(`   ${bewegt} Ballen wurden weggeschoben, größter Versatz ${maxVersatz.toFixed(1)} m`);
  console.log(`   ${bewegt > 0 ? '=> man kann hindurchfahren' : '=> BALLEN WIRKEN WIE EINE MAUER'}`);
  console.log(`   Tempo danach: ${tempoDanach.toFixed(0)} km/h ${tempoDanach > 40 ? '(bremst nur ab, hält nicht auf)' : '(bremst stark aus)'}`);
  console.log(`   Ballen durch den Boden gefallen: ${durchDenBoden} ${durchDenBoden === 0 ? '(keine)' : '(FEHLER)'}`);
}
console.log('');
