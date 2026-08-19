import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { WELT } from './heightmap';

/**
 * Unsichtbare Mauern am Rand des Terrains.
 *
 * Ohne sie fährt man bei ca. 500 m einfach über die Kante und fällt endlos.
 * Später übernehmen an der Strecke sichtbare Leitplanken diese Aufgabe –
 * diese Wände hier sind die Notbremse für den offenen Rest der Welt.
 */

/** Halbe Kantenlänge des Terrains. */
const RAND = WELT.groesse / 2;
/** Halbe Höhe der Wände. Muss den gesamten Höhenbereich abdecken. */
const HOEHE = 60;
/** Halbe Dicke der Wände. */
const DICKE = 2;

export function Weltgrenze() {
  return (
    <RigidBody type="fixed" colliders={false}>
      {/* Nord (+Z) und Süd (-Z) */}
      <CuboidCollider args={[RAND + DICKE, HOEHE, DICKE]} position={[0, 0, RAND + DICKE]} />
      <CuboidCollider args={[RAND + DICKE, HOEHE, DICKE]} position={[0, 0, -RAND - DICKE]} />
      {/* Ost (+X) und West (-X) */}
      <CuboidCollider args={[DICKE, HOEHE, RAND + DICKE]} position={[RAND + DICKE, 0, 0]} />
      <CuboidCollider args={[DICKE, HOEHE, RAND + DICKE]} position={[-RAND - DICKE, 0, 0]} />
    </RigidBody>
  );
}
