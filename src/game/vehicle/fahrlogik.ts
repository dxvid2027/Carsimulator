import type { RapierRigidBody } from '@react-three/rapier';
import type { DynamicRayCastVehicleController } from '@dimforge/rapier3d-compat';
import { FAHRZEUG, HINTERRAEDER, PHYSIK_DT, VORDERRAEDER } from '../config/vehicleConfig';
import type { FahrEingabe } from '../input/useDrivingInput';
import { telemetrie } from '../telemetrie';

/** Zustand, den die Fahrlogik über mehrere Physikschritte behalten muss. */
export interface FahrZustand {
  /** Aktueller (weich nachgeführter) Lenkeinschlag in Radiant. */
  lenkeinschlag: number;
  /** Wie lange das Auto schon kopfüber und still liegt (Sekunden). */
  kopfueberZeit: number;
  /** 1 = auf Asphalt, 0 = im Gelände. Wird von Car.tsx gesetzt. */
  asphalt: number;
}

export function neuerFahrZustand(): FahrZustand {
  return { lenkeinschlag: 0, kopfueberZeit: 0, asphalt: 1 };
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
 * Berechnet aus einem Quaternion die lokale Hochachse (+Y) in Weltkoordinaten.
 * Zeigt sie nach unten (y < 0), liegt das Auto auf dem Dach.
 */
function hochRichtung(q: { x: number; y: number; z: number; w: number }) {
  return {
    x: 2 * (q.x * q.y - q.w * q.z),
    y: 1 - 2 * (q.x * q.x + q.z * q.z),
    z: 2 * (q.y * q.z + q.w * q.x),
  };
}

/**
 * Schräglaufwinkel in Grad, MIT Vorzeichen.
 *
 * Der Winkel zwischen der Blickrichtung des Autos und der Richtung, in die es
 * sich tatsächlich bewegt. 0° = fährt geradeaus wohin es schaut,
 * 45° = deutlicher Drift.
 *
 * Das Vorzeichen sagt, zu welcher Seite es rutscht – das braucht die
 * Gegenlenk-Hilfe. Ohne Vorzeichen wüsste sie nicht, wohin sie lenken soll.
 */
function schraeglaufMitVorzeichen(body: RapierRigidBody) {
  const v = body.linvel();
  const tempo = Math.hypot(v.x, v.z);
  if (tempo < 2) return 0; // im Stand ist der Winkel bedeutungslos
  const f = vorwaertsRichtung(body.rotation());
  // Kreuzprodukt der beiden Richtungen in der XZ-Ebene (nur der Betrag zählt)
  const kreuz = f.x * v.z - f.z * v.x;
  const punkt = f.x * v.x + f.z * v.z;
  return (Math.atan2(kreuz, punkt) * 180) / Math.PI;
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

  /*
    Untergrund: Auf Asphalt voller Grip, im Gelände weniger.
    `zustand.asphalt` läuft von 1 (Fahrbahn) bis 0 (Wiese) und wird in Car.tsx
    aus dem Abstand zur Streckenmitte berechnet.
  */
  const untergrund = grip.gelaende + (1 - grip.gelaende) * zustand.asphalt;

  // Vorzeichenbehaftete Geschwindigkeit entlang der Fahrtrichtung
  const tempo = controller.currentVehicleSpeed();
  const tempoAbs = Math.abs(tempo);

  // ---------------------------------------------------------------
  // 1. Lenkung
  // ---------------------------------------------------------------
  /*
    a) Wie viel Einschlag ist bei diesem Tempo überhaupt erlaubt?

    Die Reduktion folgt einer Kurve statt einer Geraden: bei Schrittgeschwindig-
    keit bleibt fast der volle Einschlag (man will rangieren können), bei hohem
    Tempo wird kräftig zurückgenommen. Ohne das verlangt schon ein kurzer
    Tastendruck bei 180 km/h mehr Seitenkraft, als die Reifen liefern können –
    das Auto dreht sich dann weg, statt der Kurve zu folgen.
  */
  const tempoAnteil = Math.min(1, tempoAbs / antrieb.maxGeschwindigkeit);
  const tempoFaktor = 1 - lenkung.tempoDaempfung * Math.pow(tempoAnteil, lenkung.tempoKurve);
  const handbremsLimit = eingabe.handbremse ? lenkung.handbremsFaktor : 1;
  const maxHier = lenkung.maxEinschlag * tempoFaktor * handbremsLimit;

  /*
    b) Gegenlenk-Hilfe.

    Bricht das Heck aus, lenkt das Spiel automatisch ein Stück in die
    Rutschrichtung. Mit der Tastatur gibt es nur "ganz links" oder "ganz
    rechts" – fein dosiertes Gegenlenken ist damit unmöglich. Die Hilfe
    übernimmt den feinen Anteil, der Spieler den groben.

    `schraeglauf` ist negativ, wenn das Auto nach links rutscht. Positives
    Lenken bedeutet ebenfalls links, deshalb das Minuszeichen.
  */
  const schraeglaufSigniert = schraeglaufMitVorzeichen(body);
  const schraeglauf = Math.abs(schraeglaufSigniert);
  let gegenlenkung = 0;
  if (lenkung.gegenlenkHilfe > 0 && schraeglauf > lenkung.gegenlenkAb && tempoAbs > 4) {
    const ueberschuss = ((schraeglauf - lenkung.gegenlenkAb) * Math.PI) / 180;
    gegenlenkung = klemme(
      -Math.sign(schraeglaufSigniert) * ueberschuss * lenkung.gegenlenkHilfe,
      -lenkung.gegenlenkMax,
      lenkung.gegenlenkMax,
    );
  }

  const zielEinschlag = klemme(
    eingabe.lenken * maxHier + gegenlenkung,
    -lenkung.maxEinschlag,
    lenkung.maxEinschlag,
  );

  /*
    c) Weich nachführen – aber mit zwei verschiedenen Geschwindigkeiten.

    Einlenken geht bewusst langsamer als Zurückstellen. Beim Einlenken dosiert
    man, beim Zurückstellen will man sofort wieder geradeaus. Genau das ist der
    Unterschied zwischen "schwammig" und "direkt".

    Zusätzlich wird das Einlenken bei hohem Tempo verlangsamt: Bei Tempo reißt
    niemand das Lenkrad herum, und ohne diese Bremse lässt sich das Auto auf
    der Geraden mit einem Tastendruck aus der Bahn werfen.
  */
  const zurueck =
    Math.abs(zielEinschlag) < Math.abs(zustand.lenkeinschlag) ||
    Math.sign(zielEinschlag) !== Math.sign(zustand.lenkeinschlag);

  const tempo_ = zurueck
    ? lenkung.rueckstellTempo
    : lenkung.einschlagTempo * (1 - lenkung.tempoRatenDaempfung * tempoAnteil);

  zustand.lenkeinschlag +=
    (zielEinschlag - zustand.lenkeinschlag) * Math.min(1, PHYSIK_DT * tempo_);
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
  for (const i of VORDERRAEDER) {
    controller.setWheelFrictionSlip(i, grip.vorne * untergrund);
    controller.setWheelSideFrictionStiffness(i, grip.seite * untergrund);
    controller.setWheelBrake(i, bremskraft * antrieb.bremseVorne);
  }
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
    controller.setWheelFrictionSlip(i, gripHinten * untergrund);
    controller.setWheelSideFrictionStiffness(i, seiteHinten * untergrund);
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
  // 5a. Luftlage
  // ---------------------------------------------------------------
  // Ohne Bodenkontakt richten wir das Auto sanft wieder waagerecht aus und
  // dämpfen das Trudeln. Sonst landet man nach jedem Sprung über eine Kuppe
  // auf dem Dach – und muss jedes Mal von Hand zurücksetzen.
  let raederAmBoden = 0;
  for (let i = 0; i < 4; i++) if (controller.wheelIsInContact(i)) raederAmBoden++;

  const hoch = hochRichtung(body.rotation());

  if (raederAmBoden === 0) {
    const w = body.angvel();
    // Drehachse, die die Hochachse des Autos zur Welt-Hochachse dreht:
    // Kreuzprodukt aus lokaler Hochachse und (0, 1, 0)
    const achseX = -hoch.z;
    const achseZ = hoch.x;
    const k = hilfen.luftAusrichtung * FAHRZEUG.masse * PHYSIK_DT;
    const d = hilfen.luftDaempfung * FAHRZEUG.masse * PHYSIK_DT;
    body.applyTorqueImpulse(
      {
        x: achseX * k - w.x * d,
        y: -w.y * d * 0.3, // Gieren nur leicht dämpfen, damit man sich noch drehen darf
        z: achseZ * k - w.z * d,
      },
      true,
    );
  }

  // ---------------------------------------------------------------
  // 5b. Sanfte Stabilisierung am Boden
  // ---------------------------------------------------------------
  // Ohne diese Hilfe dreht sich das Auto beim Handbremsen endlos im Kreis.
  // Sie bremst nur die Drehung, wenn der Schräglaufwinkel wirklich groß wird –
  // kleine, kontrollierte Drifts bleiben also erhalten.
  if (schraeglauf > hilfen.abSchraeglauf) {
    /*
      Mit dem Tempo verstärken: Bei 190 km/h ist ein Ausbrecher sonst nicht
      mehr einzufangen, bei Schrittgeschwindigkeit stört die Hilfe dagegen nur.
    */
    const tempoBonus = 1 + tempoAnteil * hilfen.tempoVerstaerkung;
    const staerke =
      (eingabe.handbremse
        ? hilfen.stabilisierung * hilfen.handbremsFaktor
        : hilfen.stabilisierung) * tempoBonus;
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
  telemetrie.bodenkontakt = raederAmBoden;
  telemetrie.aufAsphalt = zustand.asphalt;

  // Kopfüber und still? Dann Zeit sammeln – Car.tsx setzt danach zurück.
  if (hoch.y < 0.2 && tempoAbs < 2) {
    zustand.kopfueberZeit += PHYSIK_DT;
  } else {
    zustand.kopfueberZeit = 0;
  }
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
