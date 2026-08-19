import { useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { WELT, hoeheBei, steigungBei, type Terraindaten } from './heightmap';
import { STRECKE, abstandZurStrecke, type Streckendaten } from './strecke';

/**
 * Ausstattung der Landschaft: Felsen, Büsche und ein kleines Dorf.
 *
 * Felsen und Büsche sind Instanced Meshes – alle Felsen zusammen sind ein
 * einziger Zeichenbefehl. Ohne das wären mehrere hundert Objekte einzelne
 * Aufträge an die Grafikkarte und die Bildrate bräche ein.
 *
 * Die Häuser sind einzelne Objekte, weil es nur wenige sind und sie
 * unterschiedlich aussehen sollen.
 */

const DEKO = {
  felsen: 260,
  buesche: 420,
  /** Mindestabstand zur Straße, damit nichts die Fahrbahn blockiert. */
  abstandStrasse: STRECKE.breite / 2 + STRECKE.bankett + 4,
  keim: 20261,
} as const;

function zufall(keim: number) {
  let a = keim >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Platz {
  x: number;
  y: number;
  z: number;
  drehung: number;
  groesse: number;
}

/** Sucht freie Plätze in der Landschaft. */
function verteile(
  terrain: Terraindaten,
  strecke: Streckendaten,
  anzahl: number,
  keim: number,
  maxSteigung: number,
  minAbstand: number,
): Platz[] {
  const rnd = zufall(keim);
  const liste: Platz[] = [];
  const rand = WELT.groesse / 2 - 25;
  let versuche = 0;
  while (liste.length < anzahl && versuche < anzahl * 30) {
    versuche++;
    const x = (rnd() - 0.5) * 2 * rand;
    const z = (rnd() - 0.5) * 2 * rand;
    if (abstandZurStrecke(strecke, x, z).distanz < minAbstand) continue;
    if (steigungBei(terrain, x, z) > maxSteigung) continue;
    liste.push({
      x,
      y: hoeheBei(terrain, x, z),
      z,
      drehung: rnd() * Math.PI * 2,
      groesse: 0.6 + rnd() * 0.9,
    });
  }
  return liste;
}

/** Baut die Matrizen für ein Instanced Mesh. */
function matrizen(liste: Platz[], hoehenVersatz: (p: Platz) => number) {
  const q = new Quaternion();
  return liste.map((p) => {
    q.setFromEuler(new Euler(0, p.drehung, 0));
    return new Matrix4().compose(
      new Vector3(p.x, p.y + hoehenVersatz(p), p.z),
      q,
      new Vector3(p.groesse, p.groesse * (0.7 + p.groesse * 0.3), p.groesse),
    );
  });
}

interface DekoProps {
  terrain: Terraindaten;
  strecke: Streckendaten;
}

export function Deko({ terrain, strecke }: DekoProps) {
  const felsen = useMemo(
    () => verteile(terrain, strecke, DEKO.felsen, DEKO.keim, 0.85, DEKO.abstandStrasse),
    [terrain, strecke],
  );
  const buesche = useMemo(
    () => verteile(terrain, strecke, DEKO.buesche, DEKO.keim + 7, 0.6, DEKO.abstandStrasse - 2),
    [terrain, strecke],
  );

  const felsenMatrizen = useMemo(() => matrizen(felsen, (p) => p.groesse * 0.35), [felsen]);
  const buschMatrizen = useMemo(() => matrizen(buesche, (p) => p.groesse * 0.4), [buesche]);

  /** Ein kleines Dorf: mehrere Häuser auf einer flachen Stelle. */
  const dorf = useMemo(() => {
    const rnd = zufall(DEKO.keim + 31);
    // Eine flache, freie Stelle in einiger Entfernung zur Strecke suchen
    let mitte = { x: 0, z: 0 };
    let beste = -Infinity;
    for (let i = 0; i < 900; i++) {
      const x = (rnd() - 0.5) * (WELT.groesse - 260);
      const z = (rnd() - 0.5) * (WELT.groesse - 260);
      const d = abstandZurStrecke(strecke, x, z).distanz;
      if (d < 45 || d > 130) continue;
      const flachheit = 1 - steigungBei(terrain, x, z);
      const punktzahl = flachheit * 3 - Math.abs(d - 70) / 100;
      if (punktzahl > beste) {
        beste = punktzahl;
        mitte = { x, z };
      }
    }

    const haeuser: (Platz & { breite: number; tiefe: number; hoehe: number; farbe: string })[] = [];
    const farben = ['#d8cdb8', '#c9b79b', '#b8a68d', '#cdbfa6', '#a89478'];
    for (let i = 0; i < 7; i++) {
      const winkel = (i / 7) * Math.PI * 2 + rnd() * 0.5;
      const radius = 16 + rnd() * 26;
      const x = mitte.x + Math.cos(winkel) * radius;
      const z = mitte.z + Math.sin(winkel) * radius;
      if (abstandZurStrecke(strecke, x, z).distanz < 30) continue;
      haeuser.push({
        x,
        y: hoeheBei(terrain, x, z),
        z,
        drehung: Math.round(rnd() * 4) * (Math.PI / 2) + (rnd() - 0.5) * 0.3,
        groesse: 1,
        breite: 5 + rnd() * 3.5,
        tiefe: 6 + rnd() * 4,
        hoehe: 3 + rnd() * 1.6,
        farbe: farben[Math.floor(rnd() * farben.length)],
      });
    }
    return haeuser;
  }, [terrain, strecke]);

  return (
    <>
      {/* ---------- Felsen ---------- */}
      <instancedMesh
        args={[undefined, undefined, felsenMatrizen.length]}
        castShadow
        receiveShadow
        ref={(mesh) => {
          if (!mesh) return;
          felsenMatrizen.forEach((m, i) => mesh.setMatrixAt(i, m));
          mesh.instanceMatrix.needsUpdate = true;
          mesh.computeBoundingSphere();
        }}
      >
        {/* Wenige Flächen, damit die Felsen kantig wirken statt wie Kugeln */}
        <dodecahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial color="#7c7a74" roughness={0.95} metalness={0.02} flatShading />
      </instancedMesh>

      {/* ---------- Büsche ---------- */}
      <instancedMesh
        args={[undefined, undefined, buschMatrizen.length]}
        castShadow
        ref={(mesh) => {
          if (!mesh) return;
          buschMatrizen.forEach((m, i) => mesh.setMatrixAt(i, m));
          mesh.instanceMatrix.needsUpdate = true;
          mesh.computeBoundingSphere();
        }}
      >
        <icosahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color="#3f5c2c" roughness={0.95} flatShading />
      </instancedMesh>

      {/* ---------- Dorf ---------- */}
      {dorf.map((h, i) => (
        <group key={i} position={[h.x, h.y, h.z]} rotation={[0, h.drehung, 0]}>
          {/* Wände */}
          <mesh position={[0, h.hoehe / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[h.breite, h.hoehe, h.tiefe]} />
            <meshStandardMaterial color={h.farbe} roughness={0.85} />
          </mesh>
          {/* Satteldach: ein flach gedrücktes Prisma aus einem Zylinder mit 3 Seiten */}
          <mesh
            position={[0, h.hoehe + h.breite * 0.22, 0]}
            rotation={[0, Math.PI / 4, 0]}
            castShadow
          >
            <cylinderGeometry args={[h.breite * 0.78, h.breite * 0.78, h.tiefe * 1.06, 4, 1]} />
            <meshStandardMaterial color="#7a3b2e" roughness={0.9} flatShading />
          </mesh>
          {/* Schornstein */}
          <mesh position={[h.breite * 0.26, h.hoehe + h.breite * 0.42, h.tiefe * 0.2]} castShadow>
            <boxGeometry args={[0.5, 1.1, 0.5]} />
            <meshStandardMaterial color="#6b5a4e" roughness={0.9} />
          </mesh>
          {/* Fenster als leuchtende Flächen – abends sieht man das Dorf von weitem */}
          {[-1, 1].map((seite) => (
            <mesh key={seite} position={[seite * (h.breite / 2 + 0.01), h.hoehe * 0.55, 0]}>
              <boxGeometry args={[0.05, 0.8, h.tiefe * 0.45]} />
              <meshStandardMaterial
                color="#ffdca0"
                emissive="#ffcf80"
                emissiveIntensity={0.7}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/*
        Kollision nur für die Häuser. Felsen und Büsche bleiben ohne –
        sonst müsste die Physik mehrere hundert zusätzliche Körper verwalten,
        und über einen Busch fährt man ohnehin gern hinweg.
      */}
      <RigidBody type="fixed" colliders={false}>
        {dorf.map((h, i) => (
          <CuboidCollider
            key={i}
            args={[h.breite / 2, h.hoehe / 2 + 0.6, h.tiefe / 2]}
            position={[h.x, h.y + h.hoehe / 2, h.z]}
            rotation={[0, h.drehung, 0]}
          />
        ))}
      </RigidBody>
    </>
  );
}
