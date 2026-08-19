import { useMemo } from 'react';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { WELT, hoeheBei, steigungBei, type Terraindaten } from './heightmap';
import type { Strassennetz } from './strassennetz';
import { bebautesGebiet } from './orte';

/**
 * Bäume als Instanced Meshes.
 *
 * Zwei Zeichenbefehle für den ganzen Wald: einer für alle Stämme, einer für
 * alle Kronen. Ohne Instancing wäre jeder Baum ein eigener Zeichenbefehl –
 * bei 600 Bäumen bricht dadurch die Bildrate ein.
 *
 * Platziert wird nur dort, wo es Sinn ergibt: nicht auf der Strecke, nicht an
 * steilen Hängen und nicht im flachen Startbereich.
 */

const ANZAHL = 620;
/** Mindestabstand zum Fahrbahnrand – gilt für ALLE Wege, nicht nur den Rundkurs. */
const ABSTAND_STRASSE = 10;
/** Ab dieser Steigung wachsen keine Bäume mehr. */
const MAX_STEIGUNG = 0.55;
/** Zufallskeim, damit der Wald bei jedem Laden gleich aussieht. */
const KEIM = 4242;

function zufall(keim: number) {
  let a = keim >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Baum {
  x: number;
  y: number;
  z: number;
  /** Größenfaktor, damit nicht alle Bäume gleich aussehen. */
  groesse: number;
  drehung: number;
}

function platziereBaeume(terrain: Terraindaten, netz: Strassennetz): Baum[] {
  const rnd = zufall(KEIM);
  const baeume: Baum[] = [];
  const rand = WELT.groesse / 2 - 20;

  // Begrenzte Anzahl Versuche, damit die Schleife garantiert endet
  let versuche = 0;
  while (baeume.length < ANZAHL && versuche < ANZAHL * 40) {
    versuche++;
    const x = (rnd() - 0.5) * 2 * rand;
    const z = (rnd() - 0.5) * 2 * rand;

    // Nicht im flachen Startbereich
    if (Math.hypot(x, z) < WELT.startFlaeche + 20) continue;
    // Nicht auf oder direkt neben irgendeinem Fahrweg
    if (netz.randabstand(x, z) < ABSTAND_STRASSE) continue;
    if (bebautesGebiet(terrain, netz, x, z)) continue;
    // Nicht an steilen Hängen
    if (steigungBei(terrain, x, z) > MAX_STEIGUNG) continue;

    baeume.push({
      x,
      y: hoeheBei(terrain, x, z),
      z,
      groesse: 0.75 + rnd() * 0.7,
      drehung: rnd() * Math.PI * 2,
    });
  }
  return baeume;
}

interface BaeumeProps {
  terrain: Terraindaten;
  /** Kennt alle Fahrwege – hält die Bäume von jeder Fahrbahn fern. */
  netz: Strassennetz;
}

/** Höhe des Stamms bei Größenfaktor 1. */
const STAMM_HOEHE = 3.2;
/** Höhe der Krone bei Größenfaktor 1. */
const KRONE_HOEHE = 6.5;
const KRONE_RADIUS = 2.3;

export function Baeume({ terrain, netz }: BaeumeProps) {
  const baeume = useMemo(() => platziereBaeume(terrain, netz), [terrain, netz]);

  const { staemme, kronen } = useMemo(() => {
    const q = new Quaternion();
    const staemme: Matrix4[] = [];
    const kronen: Matrix4[] = [];

    for (const b of baeume) {
      q.setFromEuler(new Euler(0, b.drehung, 0));
      const s = b.groesse;
      staemme.push(
        new Matrix4().compose(
          new Vector3(b.x, b.y + (STAMM_HOEHE * s) / 2, b.z),
          q,
          new Vector3(s, s, s),
        ),
      );
      kronen.push(
        new Matrix4().compose(
          new Vector3(b.x, b.y + STAMM_HOEHE * s + (KRONE_HOEHE * s) / 2 - 0.6 * s, b.z),
          q,
          new Vector3(s, s, s),
        ),
      );
    }
    return { staemme, kronen };
  }, [baeume]);

  if (baeume.length === 0) return null;

  return (
    <>
      <instancedMesh
        args={[undefined, undefined, staemme.length]}
        castShadow
        ref={(mesh) => {
          if (!mesh) return;
          staemme.forEach((m, i) => mesh.setMatrixAt(i, m));
          mesh.instanceMatrix.needsUpdate = true;
          mesh.computeBoundingSphere();
        }}
      >
        <cylinderGeometry args={[0.19, 0.28, STAMM_HOEHE, 6]} />
        <meshStandardMaterial color="#4a3826" roughness={0.95} />
      </instancedMesh>

      <instancedMesh
        args={[undefined, undefined, kronen.length]}
        castShadow
        ref={(mesh) => {
          if (!mesh) return;
          kronen.forEach((m, i) => mesh.setMatrixAt(i, m));
          mesh.instanceMatrix.needsUpdate = true;
          mesh.computeBoundingSphere();
        }}
      >
        <coneGeometry args={[KRONE_RADIUS, KRONE_HOEHE, 7]} />
        <meshStandardMaterial color="#2f4a24" roughness={0.9} />
      </instancedMesh>

      {/*
        Kollision: ein fester Körper mit einem Zylinder je Stamm.
        Statische Körper sind billig – sie bewegen sich nie und liegen nur im
        Suchbaum der Physik. Ohne sie würde man durch die Bäume hindurchfahren.
      */}
      <RigidBody type="fixed" colliders={false} friction={0.8}>
        {baeume.map((b, i) => (
          <CylinderCollider
            key={i}
            args={[(STAMM_HOEHE * b.groesse) / 2, 0.34 * b.groesse]}
            position={[b.x, b.y + (STAMM_HOEHE * b.groesse) / 2, b.z]}
          />
        ))}
      </RigidBody>
    </>
  );
}
