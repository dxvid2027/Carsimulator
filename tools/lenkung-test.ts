/**
 * Misst das Lenkverhalten – ohne Browser, ohne Grafik.
 *
 * Die Zahlen hier sind die Grundlage, um die Lenkung zu verbessern, statt nach
 * Gefühl an Werten zu drehen. Gemessen wird auf einer flachen Ebene, damit das
 * Gelände die Ergebnisse nicht verfälscht.
 *
 * Aufruf:  npm run lenkung
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

function welt() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = PHYSIK_DT;
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(8000, 0.5, 8000),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0)),
  );
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 1.2, 0)
      .setCanSleep(false)
      .setLinearDamping(0)
      .setAngularDamping(FAHRZEUG.hilfen.winkelDaempfung),
  );
  const form = RAPIER.ColliderDesc.cuboid(
    FAHRZEUG.halbeGroesse.x,
    FAHRZEUG.halbeGroesse.y,
    FAHRZEUG.halbeGroesse.z,
  );
  form.setMassProperties(FAHRZEUG.masse, FAHRZEUG.schwerpunkt, FAHRZEUG.traegheit, {
    x: 0, y: 0, z: 0, w: 1,
  });
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
const LEER: FahrEingabe = { gas: 0, bremse: 0, lenken: 0, handbremse: false, reset: false };

function schritt(w: Welt, e: Partial<FahrEingabe> = {}) {
  fahrschritt(w.controller, w.body, { ...LEER, ...e }, w.zustand);
  w.world.step();
}
const kmh = (w: Welt) => Math.abs(w.controller.currentVehicleSpeed()) * 3.6;
function absetzen(w: Welt) { for (let i = 0; i < 90; i++) schritt(w); }

/** Bringt das Auto auf das gewünschte Tempo und hält es dort. */
function beschleunigeAuf(w: Welt, ziel: number) {
  let sicherung = 0;
  while (kmh(w) < ziel && sicherung++ < 60 * 60) schritt(w, { gas: 1 });
}
/** Gasstellung, die das Tempo ungefähr hält. */
const halten = (w: Welt, ziel: number) => (kmh(w) < ziel ? 0.55 : 0.12);

/** Drehrate um die Hochachse in Grad pro Sekunde. */
const gierrate = (w: Welt) => (w.body.angvel().y * 180) / Math.PI;

/** Aktueller Radeinschlag in Grad. */
const einschlag = (w: Welt) => ((w.controller.wheelSteering(0) ?? 0) * 180) / Math.PI;

console.log('\n=== Lenkungs-Test ===\n');

// --- 1. Wie lange bis zum vollen Einschlag? ---
{
  console.log('1) Ansprechzeit der Lenkung');
  for (const tempo of [0, 60, 120, 180]) {
    const w = welt();
    absetzen(w);
    if (tempo > 0) beschleunigeAuf(w, tempo);

    // Maximal möglichen Einschlag bei diesem Tempo ermitteln
    let maxMoeglich = 0;
    for (let i = 0; i < 60 * 3; i++) {
      schritt(w, { lenken: 1, gas: halten(w, tempo) });
      maxMoeglich = Math.max(maxMoeglich, Math.abs(einschlag(w)));
    }

    // Neu messen: Zeit bis 90 % dieses Werts
    const w2 = welt();
    absetzen(w2);
    if (tempo > 0) beschleunigeAuf(w2, tempo);
    let frames = 0;
    while (Math.abs(einschlag(w2)) < maxMoeglich * 0.9 && frames < 60 * 5) {
      schritt(w2, { lenken: 1, gas: halten(w2, tempo) });
      frames++;
    }
    console.log(
      `   bei ${String(tempo).padStart(3)} km/h: max ${maxMoeglich.toFixed(1)}° Einschlag, ` +
        `90 % davon nach ${(frames / 60).toFixed(2)} s`,
    );
  }
}

// --- 1b. Kurzer Tastendruck: wie viel passiert bei einem Antippen? ---
{
  console.log('\n1b) Kurzer Tastendruck (Dosierbarkeit)');
  for (const tempo of [30, 60, 120]) {
    for (const dauer of [0.1, 0.2, 0.4]) {
      const w = welt();
      absetzen(w);
      beschleunigeAuf(w, tempo);
      const startRichtung = w.body.rotation();
      for (let i = 0; i < Math.round(dauer * 60); i++) schritt(w, { lenken: 1, gas: halten(w, tempo) });
      const einschlagNach = Math.abs(einschlag(w));
      // Noch 1 s ausrollen lassen und schauen, wie weit sich das Auto gedreht hat
      let maxRate = Math.abs(gierrate(w));
      for (let i = 0; i < 60; i++) { schritt(w, { lenken: 0, gas: halten(w, tempo) }); maxRate = Math.max(maxRate, Math.abs(gierrate(w))); }
      const q0 = startRichtung, q1 = w.body.rotation();
      const gier0 = Math.atan2(2 * (q0.w * q0.y + q0.x * q0.z), 1 - 2 * (q0.y * q0.y + q0.z * q0.z));
      const gier1 = Math.atan2(2 * (q1.w * q1.y + q1.x * q1.z), 1 - 2 * (q1.y * q1.y + q1.z * q1.z));
      let gedreht = ((gier1 - gier0) * 180) / Math.PI;
      while (gedreht > 180) gedreht -= 360;
      while (gedreht < -180) gedreht += 360;
      console.log(
        `   ${String(tempo).padStart(3)} km/h, ${dauer.toFixed(1)} s antippen: ` +
          `${einschlagNach.toFixed(1).padStart(5)}° Einschlag erreicht, ` +
          `Auto dreht sich um ${Math.abs(gedreht).toFixed(0).padStart(3)}°, max ${maxRate.toFixed(0)}°/s`,
      );
    }
  }
}

// --- 2. Rückstellung: wie schnell steht das Lenkrad wieder gerade? ---
{
  const w = welt();
  absetzen(w);
  beschleunigeAuf(w, 80);
  for (let i = 0; i < 60 * 2; i++) schritt(w, { lenken: 1, gas: halten(w, 80) });
  const start = Math.abs(einschlag(w));
  let frames = 0;
  while (Math.abs(einschlag(w)) > start * 0.1 && frames < 60 * 5) {
    schritt(w, { lenken: 0, gas: halten(w, 80) });
    frames++;
  }
  console.log(`\n2) Rückstellung bei 80 km/h`);
  console.log(`   von ${start.toFixed(1)}° auf 10 % in ${(frames / 60).toFixed(2)} s`);
}

// --- 3. Gegenlenken: wie lange von voll links nach voll rechts? ---
{
  const w = welt();
  absetzen(w);
  beschleunigeAuf(w, 80);
  for (let i = 0; i < 60 * 2; i++) schritt(w, { lenken: 1, gas: halten(w, 80) });
  const start = einschlag(w);
  let frames = 0;
  while (einschlag(w) > -Math.abs(start) * 0.9 && frames < 60 * 5) {
    schritt(w, { lenken: -1, gas: halten(w, 80) });
    frames++;
  }
  console.log(`\n3) Gegenlenken bei 80 km/h`);
  console.log(`   von ${start.toFixed(1)}° auf ${einschlag(w).toFixed(1)}° in ${(frames / 60).toFixed(2)} s`);
}

// --- 4. Sprungantwort: wie reagiert das Auto auf vollen Einschlag? ---
{
  console.log('\n4) Sprungantwort (Drehrate nach vollem Einschlag)');
  for (const tempo of [60, 120, 180]) {
    const w = welt();
    absetzen(w);
    beschleunigeAuf(w, tempo);
    const verlauf: number[] = [];
    for (let i = 0; i < 60 * 3; i++) {
      schritt(w, { lenken: 1, gas: halten(w, tempo) });
      verlauf.push(Math.abs(gierrate(w)));
    }
    // Beharrungswert = Mittel der letzten Sekunde
    const beharrung = verlauf.slice(-60).reduce((a, b) => a + b, 0) / 60;
    const spitze = Math.max(...verlauf);
    const ueberschwingen = beharrung > 0.1 ? (spitze / beharrung - 1) * 100 : 0;
    // Anstiegszeit auf 90 % des Beharrungswerts
    const anstieg = verlauf.findIndex((v) => v >= beharrung * 0.9);
    console.log(
      `   ${String(tempo).padStart(3)} km/h: ${beharrung.toFixed(1)}°/s Drehrate, ` +
        `Anstieg ${(anstieg / 60).toFixed(2)} s, Überschwingen ${ueberschwingen.toFixed(0)} %`,
    );
  }
}

// --- 5. Spurwechsel: einlenken, gegenlenken, wieder geradeaus ---
{
  const w = welt();
  absetzen(w);
  beschleunigeAuf(w, 100);
  const startX = w.body.translation().x;
  // 0,8 s einlenken
  for (let i = 0; i < 48; i++) schritt(w, { lenken: 0.85, gas: halten(w, 100) });
  // 0,8 s gegenlenken
  for (let i = 0; i < 48; i++) schritt(w, { lenken: -0.85, gas: halten(w, 100) });
  // loslassen und schauen, ob es sich beruhigt
  let frames = 0;
  while (Math.abs(gierrate(w)) > 3 && frames < 60 * 6) {
    schritt(w, { lenken: 0, gas: halten(w, 100) });
    frames++;
  }
  const versatz = Math.abs(w.body.translation().x - startX);
  console.log(`\n5) Spurwechsel bei 100 km/h (0,8 s links, 0,8 s rechts, dann loslassen)`);
  console.log(`   seitlicher Versatz: ${versatz.toFixed(1)} m`);
  console.log(`   beruhigt sich nach ${(frames / 60).toFixed(2)} s ${frames < 60 * 2 ? '(gutmütig)' : '(schwingt nach)'}`);
}

// --- 6. Nervosität bei hohem Tempo ---
{
  const w = welt();
  absetzen(w);
  beschleunigeAuf(w, 180);
  let maxRate = 0;
  for (let i = 0; i < 60 * 2; i++) {
    schritt(w, { lenken: 0.3, gas: halten(w, 180) });
    maxRate = Math.max(maxRate, Math.abs(gierrate(w)));
  }
  console.log(`\n6) Kleine Lenkbewegung (30 %) bei 180 km/h`);
  console.log(`   max. Drehrate ${maxRate.toFixed(1)}°/s ${maxRate < 28 ? '(ruhig)' : '(nervös)'}`);
}

// --- 7. Drift abfangen ---
{
  const w = welt();
  absetzen(w);
  beschleunigeAuf(w, 90);
  // Handbremse + Lenken -> Heck bricht aus
  for (let i = 0; i < 60 * 1.1; i++) schritt(w, { lenken: 0.8, gas: 0.4, handbremse: true });
  const schraeg = () => {
    const q = w.body.rotation();
    const v = w.body.linvel();
    const t = Math.hypot(v.x, v.z);
    if (t < 2) return 0;
    const fx = 2 * (q.x * q.z + q.w * q.y);
    const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
    return (Math.acos(Math.max(-1, Math.min(1, (fx * v.x + fz * v.z) / t))) * 180) / Math.PI;
  };
  const beimAusbrechen = schraeg();
  // Gegenlenken
  let frames = 0;
  while (schraeg() > 10 && frames < 60 * 6) {
    schritt(w, { lenken: -1, gas: 0.5 });
    frames++;
  }
  console.log(`\n7) Drift abfangen`);
  console.log(`   ausgebrochen auf ${beimAusbrechen.toFixed(0)}°, mit Gegenlenken in ${(frames / 60).toFixed(2)} s wieder unter 10°`);
  console.log(`   ${frames < 60 * 2.5 ? '(gut abfangbar)' : '(schwer abzufangen)'}`);
}
console.log('');
