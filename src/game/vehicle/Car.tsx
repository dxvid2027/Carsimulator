import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CuboidCollider,
  RigidBody,
  useBeforePhysicsStep,
  type RapierRigidBody,
} from '@react-three/rapier';
import type { Group, Object3D } from 'three';
import { FAHRZEUG, RAD_POSITIONEN } from '../config/vehicleConfig';
import { useDrivingInput } from '../input/useDrivingInput';
import { useRaycastVehicle } from './useRaycastVehicle';
import { fahrschritt, neuerFahrZustand } from './fahrlogik';
import { CarModel, WheelModel } from './CarModel';
import { abstandZurStrecke, startAufStrecke, STRECKE, type Streckendaten } from '../world/strecke';
import { letzterCheckpoint } from '../race/rennen';

interface CarProps {
  /** Wird mit dem sichtbaren Auto-Objekt befüllt, damit die Kamera ihm folgen kann. */
  followRef: React.RefObject<Object3D | null>;
  /** Der Rundkurs – bestimmt Startplatz und ob das Auto auf Asphalt fährt. */
  strecke: Streckendaten;
}

export function Car({ followRef, strecke }: CarProps) {
  const chassisRef = useRef<RapierRigidBody>(null);
  const controllerRef = useRaycastVehicle(chassisRef);
  const { eingabe, aktualisieren } = useDrivingInput();
  const fahrZustand = useRef(neuerFahrZustand());

  /** Refs auf die sichtbaren Räder: [Federung/Lenkung, Rollen] pro Rad. */
  const radAufhaengung = useRef<(Group | null)[]>([]);
  const radRollen = useRef<(Group | null)[]>([]);

  /**
   * Startplatz: auf der Start-/Ziellinie des Rundkurses, in Fahrtrichtung
   * ausgerichtet. Höhe und Richtung kommen aus der Strecke – ändert sich der
   * Kurs, stimmt der Start automatisch mit.
   */
  const start = useMemo(() => startAufStrecke(strecke), [strecke]);

  /** Drehung um die Hochachse als Quaternion (für Rapier). */
  const startDrehung = useMemo(
    () => ({
      x: 0,
      y: Math.sin(start.gierWinkel / 2),
      z: 0,
      w: Math.cos(start.gierWinkel / 2),
    }),
    [start],
  );

  /**
   * Setzt das Auto zurück (Taste R).
   *
   * Läuft gerade ein Rennen, geht es zum zuletzt passierten Kontrollpunkt –
   * sonst würde ein Ausrutscher das Rennen faktisch beenden. Beim freien
   * Fahren geht es zur Start-/Ziellinie.
   */
  const zuruecksetzen = () => {
    const body = chassisRef.current;
    if (!body) return;

    const cp = letzterCheckpoint();
    const [x, y, z] = cp ? [cp.x, cp.y + 1.2, cp.z] : start.position;
    const drehung = cp
      ? (() => {
          const gier = Math.atan2(cp.rx, cp.rz);
          return { x: 0, y: Math.sin(gier / 2), z: 0, w: Math.cos(gier / 2) };
        })()
      : startDrehung;

    body.setTranslation({ x, y, z }, true);
    body.setRotation(drehung, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    fahrZustand.current.lenkeinschlag = 0;
    fahrZustand.current.kopfueberZeit = 0;
  };

  // Eingabe einmal pro Frame einlesen (vor der Physik, priority sorgt für die Reihenfolge)
  useFrame(() => {
    aktualisieren();
    if (eingabe.current.reset) zuruecksetzen();

    // Automatischer Reset, wenn das Auto zu lange auf dem Dach liegt
    const grenze = FAHRZEUG.hilfen.autoResetSekunden;
    if (grenze > 0 && fahrZustand.current.kopfueberZeit > grenze) {
      zuruecksetzen();
    }
  }, -10);

  // Physikschritt: Kräfte setzen und das Fahrzeug aktualisieren
  useBeforePhysicsStep(() => {
    const controller = controllerRef.current;
    const body = chassisRef.current;
    if (!controller || !body) return;

    /*
      Untergrund bestimmen: Auf Asphalt hat das Auto mehr Grip als auf Wiese.
      Wir messen dazu den Abstand zur Streckenmitte. Das ist deutlich billiger
      als ein zweiter Kollisionskörper mit eigenem Reibwert.
    */
    const p = body.translation();
    const abstand = abstandZurStrecke(strecke, p.x, p.z).distanz;
    const halbeFahrbahn = STRECKE.breite / 2;
    // Innerhalb der Fahrbahn voller Asphalt-Grip, über das Bankett weich abfallend
    fahrZustand.current.asphalt =
      abstand <= halbeFahrbahn
        ? 1
        : Math.max(0, 1 - (abstand - halbeFahrbahn) / STRECKE.bankett);

    fahrschritt(controller, body, eingabe.current, fahrZustand.current);
  });

  // Sichtbare Räder an den Physik-Zustand angleichen
  useFrame(() => {
    const controller = controllerRef.current;
    if (!controller) return;

    for (let i = 0; i < RAD_POSITIONEN.length; i++) {
      const aufhaengung = radAufhaengung.current[i];
      const rollen = radRollen.current[i];
      if (!aufhaengung || !rollen) continue;

      // Radmitte = Aufhängungspunkt + Federrichtung × aktuelle Federlänge
      const federlaenge = controller.wheelSuspensionLength(i) ?? FAHRZEUG.federung.ruhelaenge;
      const anbau = RAD_POSITIONEN[i];
      aufhaengung.position.set(anbau.x, anbau.y - federlaenge, anbau.z);

      // Lenkeinschlag (nur vorne ungleich 0)
      aufhaengung.rotation.y = controller.wheelSteering(i) ?? 0;
      // Abrollen des Reifens
      rollen.rotation.x = controller.wheelRotation(i) ?? 0;
    }
  });

  return (
    <RigidBody
      ref={chassisRef}
      type="dynamic"
      colliders={false}
      position={start.position}
      rotation={[0, start.gierWinkel, 0]}
      canSleep={false}
      angularDamping={FAHRZEUG.hilfen.winkelDaempfung}
      linearDamping={0}
      // Continuous Collision Detection: verhindert Durchfliegen bei hohem Tempo
      ccd
    >
      {/*
        Der Kollisionskörper. Über massProperties setzen wir Masse UND Schwerpunkt.
        Der tiefe Schwerpunkt (y negativ) ist entscheidend gegen Umkippen.
      */}
      <CuboidCollider
        args={[FAHRZEUG.halbeGroesse.x, FAHRZEUG.halbeGroesse.y, FAHRZEUG.halbeGroesse.z]}
        massProperties={{
          mass: FAHRZEUG.masse,
          centerOfMass: FAHRZEUG.schwerpunkt,
          principalAngularInertia: FAHRZEUG.traegheit,
          angularInertiaLocalFrame: { x: 0, y: 0, z: 0, w: 1 },
        }}
      />

      {/* Sichtbares Auto. Die Kamera folgt diesem Objekt (nicht dem RigidBody),
          weil es zwischen den Physikschritten weich interpoliert wird. */}
      <group ref={followRef as React.RefObject<Group>}>
        <CarModel />
      </group>

      {RAD_POSITIONEN.map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            radAufhaengung.current[i] = el;
          }}
        >
          <group
            ref={(el) => {
              radRollen.current[i] = el;
            }}
          >
            <WheelModel />
          </group>
        </group>
      ))}
    </RigidBody>
  );
}
