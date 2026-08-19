import { useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { STRECKE, type Streckendaten } from './strecke';
import type { Strassennetz } from './strassennetz';
import { hoeheBei, type Terraindaten } from './heightmap';

/**
 * Leitplanken entlang der Strecke.
 *
 * Sie stehen bewusst NICHT überall, sondern nur dort, wo das Gelände neben der
 * Fahrbahn deutlich abfällt. Das ist auch in echt so, sieht besser aus und
 * spart viele hundert Kollisionskörper. In offenem Gelände soll man die
 * Strecke ja gerade verlassen dürfen.
 *
 * Gezeichnet wird mit Instanced Meshes: alle Pfosten sind ein einziger
 * Zeichenbefehl an die Grafikkarte, alle Planken ebenfalls.
 */

/** Abstand der Pfosten in Metern. */
const PFOSTEN_ABSTAND = 6;
/** Ab diesem Höhenunterschied neben der Fahrbahn wird gesichert. */
const ABSTURZ_AB = 1.8;
/**
 * In dieser Entfernung neben der Planke wird der Höhenunterschied gemessen.
 * Näher dran ist das Gelände durch den Straßeneinschnitt ohnehin geglättet –
 * dort fände man kaum eine Kante, und es stünden fast nirgends Leitplanken.
 * Mit diesen Werten sind rund 20 % der Strecke gesichert.
 */
const MESSWEITE = 18;

/**
 * So nah darf eine andere Straße oder Piste sein, bevor die Leitplanke
 * ausgelassen wird.
 *
 * Ohne diese Lücke stünde an jeder Kreuzung eine Planke quer über der
 * einmündenden Straße – man käme dort schlicht nicht durch.
 */
const KREUZUNGS_LUECKE = 14;
/** Wie weit neben der Fahrbahnmitte die Planke steht. */
const SEITLICH = STRECKE.breite / 2 + STRECKE.bankett * 0.65;
/** Höhe der Planke über dem Boden. */
const PLANKEN_HOEHE = 0.62;

interface Platzierung {
  position: Vector3;
  /** Drehung um die Hochachse. */
  gier: number;
  /** Länge des Plankenstücks bis zum nächsten Pfosten. */
  laenge: number;
}

function planePlatzierungen(
  strecke: Streckendaten,
  terrain: Terraindaten,
  netz: Strassennetz,
) {
  const pfosten: Platzierung[] = [];
  const planken: Platzierung[] = [];

  const schritt = Math.max(1, Math.round(PFOSTEN_ABSTAND / STRECKE.abtastung));

  for (const seite of [1, -1]) {
    let vorherigerPunkt: Vector3 | null = null;
    let vorherAbsturz = false;

    for (let i = 0; i <= strecke.punkte.length; i += schritt) {
      const p = strecke.punkte[i % strecke.punkte.length];
      const nx = -p.rz * seite;
      const nz = p.rx * seite;

      const x = p.x + nx * SEITLICH;
      const z = p.z + nz * SEITLICH;
      const y = hoeheBei(terrain, x, z);

      // Wie tief fällt das Gelände weiter außen ab?
      const aussenX = p.x + nx * (SEITLICH + MESSWEITE);
      const aussenZ = p.z + nz * (SEITLICH + MESSWEITE);
      const abfall = y - hoeheBei(terrain, aussenX, aussenZ);

      /*
        Kreuzt hier eine andere Straße oder Piste, bleibt die Planke weg.
        Der Rundkurs selbst zählt nicht mit – sonst wäre überall Lücke, denn
        die Planke steht ja direkt an ihm. Deshalb prüfen wir ein Stück weiter
        außen, wo nur noch fremde Wege liegen können.
      */
      const kreuzungX = p.x + nx * (SEITLICH + 6);
      const kreuzungZ = p.z + nz * (SEITLICH + 6);
      const fremderWeg = netz.randabstand(kreuzungX, kreuzungZ) < KREUZUNGS_LUECKE;

      const braucht = abfall > ABSTURZ_AB && !fremderWeg;

      const hier = new Vector3(x, y, z);

      if (braucht) {
        pfosten.push({ position: hier, gier: Math.atan2(p.rx, p.rz), laenge: 0 });
        // Planke nur setzen, wenn auch der vorherige Punkt gesichert war –
        // sonst würden freistehende Stücke in der Landschaft schweben
        if (vorherAbsturz && vorherigerPunkt) {
          const mitte = vorherigerPunkt.clone().lerp(hier, 0.5);
          const dx = hier.x - vorherigerPunkt.x;
          const dz = hier.z - vorherigerPunkt.z;
          planken.push({
            position: mitte,
            gier: Math.atan2(dx, dz),
            laenge: Math.hypot(dx, dz),
          });
        }
      }

      vorherigerPunkt = hier;
      vorherAbsturz = braucht;
    }
  }

  return { pfosten, planken };
}

interface LeitplankenProps {
  strecke: Streckendaten;
  terrain: Terraindaten;
  /** Kennt alle Fahrwege – lässt an Kreuzungen eine Lücke. */
  netz: Strassennetz;
}

export function Leitplanken({ strecke, terrain, netz }: LeitplankenProps) {
  const { pfosten, planken } = useMemo(
    () => planePlatzierungen(strecke, terrain, netz),
    [strecke, terrain, netz],
  );

  /** Baut die Transformationsmatrizen für ein Instanced Mesh. */
  const matrizen = (liste: Platzierung[], hoehe: number, laengeFest?: number) => {
    const q = new Quaternion();
    const skala = new Vector3(1, 1, 1);
    return liste.map(({ position, gier, laenge }) => {
      q.setFromEuler(new Euler(0, gier, 0));
      skala.set(1, 1, laengeFest ?? Math.max(0.1, laenge));
      return new Matrix4().compose(
        new Vector3(position.x, position.y + hoehe, position.z),
        q,
        skala,
      );
    });
  };

  const pfostenMatrizen = useMemo(() => matrizen(pfosten, PLANKEN_HOEHE / 2, 1), [pfosten]);
  const plankenMatrizen = useMemo(() => matrizen(planken, PLANKEN_HOEHE), [planken]);

  if (pfosten.length === 0) return null;

  return (
    <>
      {/* Pfosten */}
      <instancedMesh
        args={[undefined, undefined, pfostenMatrizen.length]}
        castShadow
        receiveShadow
        ref={(mesh) => {
          if (!mesh) return;
          pfostenMatrizen.forEach((m, i) => mesh.setMatrixAt(i, m));
          mesh.instanceMatrix.needsUpdate = true;
          mesh.computeBoundingSphere();
        }}
      >
        <boxGeometry args={[0.1, PLANKEN_HOEHE + 0.25, 0.1]} />
        <meshStandardMaterial color="#6f7479" metalness={0.75} roughness={0.5} />
      </instancedMesh>

      {/* Planken. Die Geometrie ist 1 m lang und wird pro Instanz gestreckt. */}
      <instancedMesh
        args={[undefined, undefined, plankenMatrizen.length]}
        castShadow
        receiveShadow
        ref={(mesh) => {
          if (!mesh) return;
          plankenMatrizen.forEach((m, i) => mesh.setMatrixAt(i, m));
          mesh.instanceMatrix.needsUpdate = true;
          mesh.computeBoundingSphere();
        }}
      >
        <boxGeometry args={[0.09, 0.32, 1]} />
        <meshStandardMaterial color="#c3c8cd" metalness={0.85} roughness={0.34} />
      </instancedMesh>

      {/*
        Kollision: ein einziger fester Körper mit vielen Quadern.
        Nur für die Planken, nicht für die Pfosten – das halbiert die Anzahl
        und man merkt beim Fahren keinen Unterschied.
      */}
      <RigidBody type="fixed" colliders={false} friction={0.4} restitution={0.15}>
        {planken.map((p, i) => (
          <CuboidCollider
            key={i}
            args={[0.12, 0.45, Math.max(0.1, p.laenge) / 2]}
            position={[p.position.x, p.position.y + PLANKEN_HOEHE, p.position.z]}
            rotation={[0, p.gier, 0]}
          />
        ))}
      </RigidBody>
    </>
  );
}
