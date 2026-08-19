import type { RapierRigidBody } from '@react-three/rapier';
import type { DynamicRayCastVehicleController } from '@dimforge/rapier3d-compat';
import { FAHRZEUG, HINTERRAEDER, PHYSIK_DT, VORDERRAEDER } from '../config/vehicleConfig';
import type { FahrEingabe } from '../input/useDrivingInput';
import { telemetrie } from '../telemetrie';

/** Zustand, den die Fahrlogik über mehrere Physikschritte behalten muss. */
export interface FahrZustand {
  /** Aktueller (weich nachgeführter) Lenkeinschlag in Radiant. */
  lenkeinschlag: number;
}

export function neuerFahrZustand(): FahrZustand {
  return { lenkeinschlag: 0 };
}

/** Begrenzt einen Wert auf [min, max]. */
const klemme = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Berechnet aus einem Quaternion die lokale Vorwärtsachse (+Z) in Weltkoordinaten.
 * Das ist die Blickrichtung des Autos.
 */
function vorwaertsRichtung(q: { x: number; y: number; z: number; w: number }) {
  return {
    x: 2 * (q.x * q.z + q.w * q.y),
    y: 2 * (q.y * q.z - q.w * q.x),
    z: 1 - 2 * (q.x * q.x + q.y * q.y),
  };
}

/**
 * Schräglaufwinkel in Grad: der Winkel zwischen der Blickrichtung des Autos
 * und der Richtung, in die es sich tatsächlich bewegt.
 * 0° = fährt geradeaus wohin es schaut, 45° = deutlicher Drift.
 */
function schraeglaufGrad(body: RapierRigidBody) {
  const v = body.linvel();
  const tempo = Math.hypot(v.x, v.z);
  if (tempo < 2) return 0; // im Stand ist der Winkel bedeutungslos
  const f = vorwaertsRichtung(body.rotation());
  const punkt = (f.x * v.x + f.z * v.z) / tempo;
  return (Math.acos(klemme(punkt, -1, 1)) * 180) / Math.PI;
}

/**
 * Ein Physikschritt der Fahrzeugsteuerung.
 * Muss VOR `world.step()` laufen – deshalb wird sie aus `useBeforePhysicsStep` aufgerufen.
 */
export function fahrschritt(
  controller: DynamicRayCastVehicleController,
  body: RapierRigidBody,
  eingabe: FahrEingabe,
  zustand: FahrZustand,
) {
  const { antrieb, lenkung, grip, drift, aero, hilfen } = FAHRZEUG;

  // Vorzeichenbehaftete Geschwindigkeit entlang der Fahrtrichtung
  const tempo = controller.currentVehicleSpeed();
  const tempoAbs = Math.abs(tempo);

  // ---------------------------------------------------------------
  // 1. Lenkung
  // ---------------------------------------------------------------
  // Bei hohem Tempo weniger Einschlag zulassen, sonst ist das Auto nicht fahrbar.
  const tempoFaktor = 1 - Math.min(1, tempoAbs / antrieb.maxGeschwindigkeit) * lenkung.tempoDaempfung;
  const handbremsLimit = eingabe.handbremse ? lenkung.handbremsFaktor : 1;
  const zielEinschlag = eingabe.lenken * lenkung.maxEinschlag * tempoFaktor * handbremsLimit;

  // Weich nachführen statt hart setzen -> das Lenkrad "dreht sich" statt zu springen
  zustand.lenkeinschlag +=
    (zielEinschlag - zustand.lenkeinschlag) * Math.min(1, PHYSIK_DT * lenkung.einschlagTempo);
  for (const i of VORDERRAEDER) controller.setWheelSteering(i, zustand.lenkeinschlag);

  // ---------------------------------------------------------------
  // 2. Motor und Bremse
  // ---------------------------------------------------------------
  // Die Motorkraft fällt linear mit dem Tempo auf 0. Das ersetzt eine echte
  // Drehmomentkurve und sorgt dafür, dass der Topspeed begrenzt ist.
  const kraftAbfall = Math.max(0, 1 - tempoAbs / antrieb.maxGeschwindigkeit);

  let motorkraft = 0;
  let bremskraft = 0;

  if (eingabe.gas > 0) {
    if (tempo < -0.5) {
      // Wir rollen rückwärts und der Fahrer gibt Gas -> erst abbremsen
      bremskraft = antrieb.bremskraft;
    } else {
      motorkraft = eingabe.gas * antrieb.maxMotorkraft * kraftAbfall;
    }
  } else if (eingabe.bremse > 0) {
    if (tempo > 0.5) {
      bremskraft = antrieb.bremskraft * eingabe.bremse;
    } else {
      // Steht oder rollt schon rückwärts -> Rückwärtsgang
      motorkraft = -eingabe.bremse * antrieb.maxMotorkraft * antrieb.rueckwaertsAnteil * kraftAbfall;
    }
  } else {
    // Kein Pedal: leichtes Ausrollen
    bremskraft = antrieb.rollwiderstand;
  }

  for (const i of HINTERRAEDER) controller.setWheelEngineForce(i, motorkraft);
  for (const i of VORDERRAEDER) controller.setWheelBrake(i, bremskraft * antrieb.bremseVorne);
  for (const i of HINTERRAEDER) controller.setWheelBrake(i, bremskraft * antrieb.bremseHinten);

  // ---------------------------------------------------------------
  // 3. Grip hinten -> Drift
  // ---------------------------------------------------------------
  // Je mehr Antriebskraft anliegt, desto weniger Seitenhalt hat die Hinterachse.
  // Dadurch kommt bei zu viel Gas in der Kurve das Heck.
  const gasAnteil = klemme(eingabe.gas * (motorkraft / antrieb.maxMotorkraft), 0, 1);
  let gripHinten = grip.hinten + (drift.gripVollgas - grip.hinten) * gasAnteil;
  let seiteHinten = grip.seite + (drift.seiteVollgas - grip.seite) * gasAnteil;

  if (eingabe.handbremse) {
    // Handbremse: Hinterräder blockieren, Seitenhalt bricht weg -> Drift
    gripHinten = drift.gripHandbremse;
    seiteHinten = drift.seiteHandbremse;
    for (const i of HINTERRAEDER) {
      controller.setWheelEngineForce(i, 0);
      controller.setWheelBrake(i, antrieb.handbremskraft);
    }
  }
  for (const i of HINTERRAEDER) {
    controller.setWheelFrictionSlip(i, gripHinten);
    controller.setWheelSideFrictionStiffness(i, seiteHinten);
  }

  // ---------------------------------------------------------------
  // 4. Aerodynamik
  // ---------------------------------------------------------------
  // Wichtig: Rapiers `addForce` wirkt dauerhaft weiter, bis man es zurücksetzt.
  // Deshalb benutzen wir Impulse (= Kraft × Zeit), die nur einen Schritt gelten.
  const v = body.linvel();
  const tempoBoden = Math.hypot(v.x, v.z);
  if (tempoBoden > 0.05) {
    const luftwiderstand = 0.5 * aero.luftdichte * aero.cwMalFlaeche * tempoBoden * tempoBoden;
    body.applyImpulse(
      {
        x: (-v.x / tempoBoden) * luftwiderstand * PHYSIK_DT,
        y: -aero.abtrieb * tempoBoden * PHYSIK_DT, // Abtrieb nach unten
        z: (-v.z / tempoBoden) * luftwiderstand * PHYSIK_DT,
      },
      true,
    );
  }

  // ---------------------------------------------------------------
  // 5. Sanfte Stabilisierung
  // ---------------------------------------------------------------
  // Ohne diese Hilfe dreht sich das Auto beim Handbremsen endlos im Kreis.
  // Sie bremst nur die Drehung, wenn der Schräglaufwinkel wirklich groß wird –
  // kleine, kontrollierte Drifts bleiben also erhalten.
  const schraeglauf = schraeglaufGrad(body);
  if (schraeglauf > hilfen.abSchraeglauf) {
    const staerke = eingabe.handbremse
      ? hilfen.stabilisierung * hilfen.handbremsFaktor
      : hilfen.stabilisierung;
    const w = body.angvel();
    const anteil = Math.min(1, (schraeglauf - hilfen.abSchraeglauf) / 90);
    body.applyTorqueImpulse({ x: 0, y: -w.y * staerke * anteil * FAHRZEUG.masse, z: 0 }, true);
  }

  // ---------------------------------------------------------------
  // 6. Fahrzeug-Update (muss vor world.step passieren)
  // ---------------------------------------------------------------
  controller.updateVehicle(PHYSIK_DT);

  // ---------------------------------------------------------------
  // 7. Werte fürs HUD
  // ---------------------------------------------------------------
  const kmh = tempoAbs * 3.6;
  telemetrie.tempoMs = tempo;
  telemetrie.tempoKmh = kmh;
  telemetrie.schraeglauf = schraeglauf;
  let kontakt = 0;
  for (let i = 0; i < 4; i++) if (controller.wheelIsInContact(i)) kontakt++;
  telemetrie.bodenkontakt = kontakt;
  const p = body.translation();
  telemetrie.position.x = p.x;
  telemetrie.position.y = p.y;
  telemetrie.position.z = p.z;

  // Gang und Drehzahl sind reine Anzeige – die Physik kennt keine Gänge.
  const grenzen = FAHRZEUG.getriebe.gangGrenzen;
  if (tempo < -0.5) {
    telemetrie.gang = -1;
  } else if (kmh < 1) {
    telemetrie.gang = 0;
  } else {
    let g = grenzen.findIndex((grenze) => kmh < grenze);
    if (g === -1) g = grenzen.length - 1;
    telemetrie.gang = g + 1;
    const unten = g === 0 ? 0 : grenzen[g - 1];
    const oben = grenzen[g];
    const anteil = klemme((kmh - unten) / (oben - unten), 0, 1);
    const { leerlaufDrehzahl, maxDrehzahl } = FAHRZEUG.getriebe;
    telemetrie.drehzahl = leerlaufDrehzahl + (maxDrehzahl - leerlaufDrehzahl) * (0.25 + 0.75 * anteil);
  }
  if (telemetrie.gang <= 0) telemetrie.drehzahl = FAHRZEUG.getriebe.leerlaufDrehzahl;
}
