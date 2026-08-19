import { useEffect, useRef, type RefObject } from 'react';
import { useRapier, type RapierRigidBody } from '@react-three/rapier';
import type { DynamicRayCastVehicleController } from '@dimforge/rapier3d-compat';
import { FAHRZEUG, RAD_POSITIONEN, VORDERRAEDER } from '../config/vehicleConfig';

/**
 * Erzeugt Rapiers Raycast-Fahrzeug-Controller für einen Chassis-Körper.
 *
 * Ein Raycast-Vehicle hat keine echten Rad-Körper. Stattdessen schießt es von
 * jedem Radaufhängungspunkt einen Strahl nach unten. Trifft der Strahl den Boden,
 * berechnet Rapier daraus Federkraft, Antriebs- und Seitenführungskraft.
 * Das ist stabil, schnell und der Standard in Rennspielen – deutlich besser als
 * vier echte Rad-Kollisionskörper, die ständig verhaken oder springen.
 */
export function useRaycastVehicle(chassisRef: RefObject<RapierRigidBody | null>) {
  const { world } = useRapier();
  const controllerRef = useRef<DynamicRayCastVehicleController | null>(null);

  useEffect(() => {
    const chassis = chassisRef.current;
    if (!chassis) return;

    const controller = world.createVehicleController(chassis);

    // Rapier muss wissen, welche Achse "oben" und welche "vorwärts" ist.
    // Achtung: Der Setter heißt in Rapier tatsächlich `setIndexForwardAxis`
    // (als Property, nicht als Methode) – das ist eine Eigenheit der Library.
    controller.indexUpAxis = 1; // Y = oben
    controller.setIndexForwardAxis = 2; // Z = vorwärts

    const { federung, grip, rad } = FAHRZEUG;

    for (const pos of RAD_POSITIONEN) {
      controller.addWheel(
        pos, // Aufhängungspunkt am Chassis
        { x: 0, y: -1, z: 0 }, // Federrichtung: nach unten
        { x: -1, y: 0, z: 0 }, // Radachse. Daraus ergibt sich vorwärts = +Z
        federung.ruhelaenge,
        rad.radius,
      );
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

    controllerRef.current = controller;

    return () => {
      world.removeVehicleController(controller);
      controllerRef.current = null;
    };
    // chassisRef ist ein stabiles Ref-Objekt, deshalb reicht `world` als Abhängigkeit
  }, [world, chassisRef]);

  return controllerRef;
}
