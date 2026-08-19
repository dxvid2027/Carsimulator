/**
 * Headless-Test der Fahrphysik.
 *
 * Startet die echte Rapier-Physik ohne Browser und ohne Grafik und misst
 * Beschleunigung, Topspeed, Bremsweg, Kurvenstabilität und Drift.
 *
 * Wichtig: Dieses Werkzeug benutzt exakt dieselbe `fahrschritt`-Funktion und
 * dieselbe `vehicleConfig` wie das Spiel. Wenn du in der Konfiguration etwas
 * änderst, siehst du hier sofort die Auswirkung – ohne selbst fahren zu müssen.
 *
 * Aufruf:  npm run physik
 */
import RAPIER from '@dimforge/rapier3d-compat';
import {
  FAHRZEUG,
  PHYSIK_DT,
  RAD_POSITIONEN,
  VORDERRAEDER,
} from '../src/game/config/vehicleConfig';
import { fahrschritt, neuerFahrZustand, type FahrZustand } from '../src/game/vehicle/fahrlogik';
import type { FahrEingabe } from '../src/game/input/useDrivingInput';

await RAPIER.init();

/** Baut eine Testwelt mit flachem Boden und einem Auto darauf. */
function welt() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = PHYSIK_DT;

  // Sehr große Ebene – sonst fällt das Auto bei langen Tests über die Kante
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(8000, 0.5, 8000),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0)),
  );

  const [sx, sy, sz] = FAHRZEUG.startPosition;
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(sx, sy, sz)
      .setCanSleep(false)
      .setLinearDamping(0)
      .setAngularDamping(FAHRZEUG.hilfen.winkelDaempfung),
  );

  const form = RAPIER.ColliderDesc.cuboid(
    FAHRZEUG.halbeGroesse.x,
    FAHRZEUG.halbeGroesse.y,
    FAHRZEUG.halbeGroesse.z,
  );
  form.setMassProperties(
    FAHRZEUG.masse,
    FAHRZEUG.schwerpunkt,
    FAHRZEUG.traegheit,
    { x: 0, y: 0, z: 0, w: 1 },
  );
  world.createCollider(form, body);

  const controller = world.createVehicleController(body);
  controller.indexUpAxis = 1;
  controller.setIndexForwardAxis = 2;

  const { federung, grip, rad } = FAHRZEUG;
  for (const p of RAD_POSITIONEN) {
    controller.addWheel(p, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, federung.ruhelaenge, rad.radius);
  }
  for (let i = 0; i < RAD_POSITIONEN.length; i++) {
    controller.setWheelSuspensionStiffness(i, federung.haerte);
    controller.setWheelSuspensionCompression(i, federung.daempfungDruck);
    controller.setWheelSuspensionRelaxation(i, federung.daempfungZug);
    controller.setWheelMaxSuspensionTravel(i, federung.maxWeg);
    controller.setWheelMaxSuspensionForce(i, federung.maxKraft);
    controller.setWheelFrictionSlip(i, VORDERRAEDER.includes(i as 0 | 1) ? grip.vorne : grip.hinten);
    controller.setWheelSideFrictionStiffness(i, grip.seite);
  }

  const zustand: FahrZustand = neuerFahrZustand();
  return { world, body, controller, zustand };
}

type Welt = ReturnType<typeof welt>;

const KEINE_EINGABE: FahrEingabe = {
  gas: 0, bremse: 0, lenken: 0, handbremse: false, reset: false,
};

/** Führt einen Physikschritt mit der gegebenen Eingabe aus. */
function schritt(w: Welt, eingabe: Partial<FahrEingabe> = {}) {
  fahrschritt(w.controller, w.body, { ...KEINE_EINGABE, ...eingabe }, w.zustand);
  w.world.step();
}

/** Lässt das Auto 1,5 s einfedern, bevor der eigentliche Test beginnt. */
function absetzen(w: Welt) {
  for (let i = 0; i < 90; i++) schritt(w);
}

const kmh = (w: Welt) => Math.abs(w.controller.currentVehicleSpeed()) * 3.6;

/** Y-Anteil der Fahrzeug-Hochachse. 1 = aufrecht, 0 = auf der Seite. */
function aufrecht(w: Welt) {
  const q = w.body.rotation();
  return 1 - 2 * (q.x * q.x + q.z * q.z);
}

/** Winkel zwischen Blickrichtung und Fahrtrichtung in Grad. */
function schraeglauf(w: Welt) {
  const q = w.body.rotation();
  const v = w.body.linvel();
  const tempo = Math.hypot(v.x, v.z);
  if (tempo < 2) return 0;
  const fx = 2 * (q.x * q.z + q.w * q.y);
  const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  const d = Math.max(-1, Math.min(1, (fx * v.x + fz * v.z) / tempo));
  return (Math.acos(d) * 180) / Math.PI;
}

console.log('\n=== Fahrphysik-Test ===\n');

// --- 1. Beschleunigung und Topspeed ---
{
  const w = welt();
  absetzen(w);
  let t60: number | null = null;
  let t100: number | null = null;
  let t200: number | null = null;
  for (let i = 0; i < 60 * 45; i++) {
    schritt(w, { gas: 1 });
    const v = kmh(w);
    if (t60 === null && v >= 60) t60 = i / 60;
    if (t100 === null && v >= 100) t100 = i / 60;
    if (t200 === null && v >= 200) t200 = i / 60;
  }
  const z = (s: number | null) => (s === null ? 'nicht erreicht' : `${s.toFixed(2)} s`);
  console.log('1) Beschleunigung');
  console.log(`   0–60 km/h:  ${z(t60)}`);
  console.log(`   0–100 km/h: ${z(t100)}`);
  console.log(`   0–200 km/h: ${z(t200)}`);
  console.log(`   Topspeed:   ${kmh(w).toFixed(0)} km/h`);
  console.log(`   Geradeauslauf: ${Math.abs(w.body.translation().x).toFixed(2)} m seitliche Abweichung\n`);
}

// --- 2. Bremsweg ---
{
  const w = welt();
  absetzen(w);
  while (kmh(w) < 100) schritt(w, { gas: 1 });
  const start = w.body.translation().z;
  let frames = 0;
  while (kmh(w) > 1 && frames < 60 * 30) {
    schritt(w, { bremse: 1 });
    frames++;
  }
  console.log('2) Vollbremsung aus 100 km/h');
  console.log(`   ${(w.body.translation().z - start).toFixed(1)} m in ${(frames / 60).toFixed(1)} s\n`);
}

// --- 3. Kurvenstabilität ---
{
  const w = welt();
  absetzen(w);
  let minAufrecht = 1;
  let maxSchraeglauf = 0;
  for (let i = 0; i < 60 * 15; i++) {
    schritt(w, { gas: kmh(w) < 80 ? 1 : 0.3, lenken: i > 300 ? 1 : 0 });
    minAufrecht = Math.min(minAufrecht, aufrecht(w));
    maxSchraeglauf = Math.max(maxSchraeglauf, schraeglauf(w));
  }
  console.log('3) Dauerkurve bei 80 km/h');
  console.log(`   Aufrichtung: ${minAufrecht.toFixed(3)} ${minAufrecht > 0.9 ? '(stabil)' : '(KIPPT – Schwerpunkt tiefer legen!)'}`);
  console.log(`   max. Schräglauf: ${maxSchraeglauf.toFixed(0)}°, Tempo ${kmh(w).toFixed(0)} km/h\n`);
}

// --- 4. Handbremsen-Drift ---
{
  const w = welt();
  absetzen(w);
  while (kmh(w) < 70) schritt(w, { gas: 1 });
  let max = 0;
  for (let i = 0; i < 60 * 1.2; i++) {
    schritt(w, { gas: 0.4, lenken: 0.7, handbremse: true });
    max = Math.max(max, schraeglauf(w));
  }
  for (let i = 0; i < 60 * 3; i++) schritt(w, { gas: 0.7, lenken: -0.25 });
  console.log('4) Handbremsen-Drift aus 70 km/h');
  console.log(`   max. Schräglauf: ${max.toFixed(0)}° ${max > 18 && max < 100 ? '(kontrollierter Drift)' : '(zu wenig / dreht sich weg)'}`);
  console.log(`   fängt sich wieder auf ${schraeglauf(w).toFixed(0)}° bei ${kmh(w).toFixed(0)} km/h\n`);
}

// --- 5. Powerslide ---
{
  const w = welt();
  absetzen(w);
  let max = 0;
  for (let i = 0; i < 60 * 8; i++) {
    schritt(w, { gas: 1, lenken: 0.9 });
    max = Math.max(max, schraeglauf(w));
  }
  console.log('5) Vollgas + voller Einschlag');
  console.log(`   max. Schräglauf: ${max.toFixed(0)}° (Heck kommt ${max > 8 ? 'spürbar' : 'kaum'})\n`);
}

// --- 6. Luftlage: Sprung mit Drall ---
{
  console.log('6) Luftlage nach einem Sprung');
  for (const drall of [1.5, 3, 5]) {
    const w = welt();
    absetzen(w);
    while (kmh(w) < 90) schritt(w, { gas: 1 });
    // Abheben und ins Trudeln bringen
    w.body.applyImpulse({ x: 0, y: FAHRZEUG.masse * 7, z: 0 }, true);
    w.body.applyTorqueImpulse(
      { x: drall * FAHRZEUG.masse, y: 0, z: drall * 0.6 * FAHRZEUG.masse },
      true,
    );
    let minAufrecht = 1;
    for (let i = 0; i < 60 * 6; i++) {
      schritt(w, { gas: 0.3 });
      minAufrecht = Math.min(minAufrecht, aufrecht(w));
    }
    const gelandet = aufrecht(w);
    console.log(
      `   Drall ${drall}: tiefster Wert ${minAufrecht.toFixed(2)}, am Ende ${gelandet.toFixed(2)} ` +
        `${gelandet > 0.8 ? '(steht auf den Rädern)' : '(liegt auf dem Dach)'}`,
    );
  }
  console.log('');
}

// --- 7. Links/Rechts-Symmetrie ---
{
  const links = welt();
  const rechts = welt();
  absetzen(links);
  absetzen(rechts);
  for (let i = 0; i < 60 * 3; i++) {
    schritt(links, { gas: 1, lenken: 1 });
    schritt(rechts, { gas: 1, lenken: -1 });
  }
  const lx = links.body.translation().x;
  const rx = rechts.body.translation().x;
  console.log('7) Symmetrie der Lenkung');
  console.log(`   lenken=+1 → x = ${lx.toFixed(1)} m (muss positiv sein = links)`);
  console.log(`   lenken=-1 → x = ${rx.toFixed(1)} m (muss negativ sein = rechts)`);
  const abweichung = Math.abs(Math.abs(lx) - Math.abs(rx));
  console.log(`   Abweichung: ${abweichung.toFixed(2)} m ${abweichung < 1 ? '(symmetrisch)' : '(unsymmetrisch!)'}\n`);
}
