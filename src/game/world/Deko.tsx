import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import {
  Color,
  Euler,
  Group,
  Matrix4,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { WELT, hoeheBei, steigungBei, type Terraindaten } from './heightmap';
import { bebautesGebiet, dorfOrt, windmuehleOrt } from './orte';
import type { Strassennetz } from './strassennetz';
import type { Streckendaten } from './strecke';

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
  /** Mindestabstand zum Fahrbahnrand, damit nichts die Fahrbahn blockiert. */
  abstandStrasse: 6,
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
  netz: Strassennetz,
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
    if (netz.randabstand(x, z) < minAbstand) continue;
    if (bebautesGebiet(terrain, netz, strecke, x, z)) continue;
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

/**
 * Windmühle auf einer Anhöhe – ein Wahrzeichen, an dem man sich orientieren
 * kann. Die Flügel drehen sich, das zieht den Blick auf sich und macht die
 * Landschaft lebendig.
 */
function Windmuehle({ x, y, z }: { x: number; y: number; z: number }) {
  const fluegel = useRef<Group>(null);
  useFrame((_, delta) => {
    if (fluegel.current) fluegel.current.rotation.z += delta * 0.55;
  });

  const turmHoehe = 13;
  return (
    <group position={[x, y, z]}>
      {/* Turm: unten breit, oben schmal */}
      <mesh position={[0, turmHoehe / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.5, 2.6, turmHoehe, 12]} />
        <meshStandardMaterial color="#d5cdbb" roughness={0.9} />
      </mesh>
      {/* Dach */}
      <mesh position={[0, turmHoehe + 1.3, 0]} castShadow>
        <coneGeometry args={[2.1, 2.8, 12]} />
        <meshStandardMaterial color="#5c3a2c" roughness={0.9} flatShading />
      </mesh>
      {/* Flügelkreuz, leicht nach vorn geneigt wie bei echten Mühlen */}
      <group ref={fluegel} position={[0, turmHoehe - 0.6, 2.4]} rotation={[0.12, 0, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation={[0, 0, (i / 4) * Math.PI * 2]}>
            <mesh position={[0, 4.4, 0]} castShadow>
              <boxGeometry args={[0.85, 8.4, 0.16]} />
              <meshStandardMaterial color="#e3dccb" roughness={0.85} />
            </mesh>
            <mesh position={[0, 4.4, 0.12]}>
              <boxGeometry args={[0.14, 8.4, 0.1]} />
              <meshStandardMaterial color="#6b4a35" roughness={0.9} />
            </mesh>
          </group>
        ))}
        {/* Nabe */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.55, 0.55, 0.7, 10]} />
          <meshStandardMaterial color="#4a3428" roughness={0.9} />
        </mesh>
      </group>

      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[turmHoehe / 2, 2.3]} position={[0, turmHoehe / 2, 0]} />
      </RigidBody>
    </group>
  );
}

interface DekoProps {
  terrain: Terraindaten;
  /** Wird für die Sperrkreise um Tankstelle und Straßenrampen gebraucht. */
  strecke: Streckendaten;
  /** Kennt alle Fahrwege – hält Felsen, Büsche und Häuser von jeder Fahrbahn fern. */
  netz: Strassennetz;
}

export function Deko({ terrain, netz, strecke }: DekoProps) {
  const felsen = useMemo(
    () => verteile(terrain, netz, strecke, DEKO.felsen, DEKO.keim, 0.85, DEKO.abstandStrasse),
    [terrain, netz, strecke],
  );
  const buesche = useMemo(
    () => verteile(terrain, netz, strecke, DEKO.buesche, DEKO.keim + 7, 0.6, DEKO.abstandStrasse),
    [terrain, netz, strecke],
  );

  const felsenMatrizen = useMemo(() => matrizen(felsen, (p) => p.groesse * 0.35), [felsen]);
  const buschMatrizen = useMemo(() => matrizen(buesche, (p) => p.groesse * 0.4), [buesche]);

  /*
    Eine eigene Farbe je Instanz – derselbe Trick wie bei den Baumkronen.

    `setColorAt` kostet keinen zusätzlichen Zeichenbefehl. Alle Felsen in
    exakt demselben Grau (und alle Büsche in exakt demselben Grün) sehen
    dagegen aus wie gestempelt. Weil die Farbe mit der Materialfarbe
    multipliziert wird, sind beide Materialien unten weiß.
  */
  const felsenFarben = useMemo(() => {
    const rnd = zufall(DEKO.keim + 401);
    const c = new Color();
    return felsen.map(() => {
      /*
        Graubraun mit wenig Sättigung, aber deutlich verschiedener Helligkeit.
        `SRGBColorSpace` nicht vergessen – ohne die Angabe rechnet three.js
        die Werte linear und alles wird deutlich zu hell.
      */
      c.setHSL(0.09 + rnd() * 0.04, 0.04 + rnd() * 0.07, 0.36 + rnd() * 0.18, SRGBColorSpace);
      return c.clone();
    });
  }, [felsen]);

  const buschFarben = useMemo(() => {
    const rnd = zufall(DEKO.keim + 507);
    const c = new Color();
    return buesche.map(() => {
      c.setHSL(0.22 + rnd() * 0.09, 0.3 + rnd() * 0.26, 0.16 + rnd() * 0.12, SRGBColorSpace);
      return c.clone();
    });
  }, [buesche]);

  /** Ein kleines Dorf. Der Platz kommt aus orte.ts, damit die Karte denselben kennt. */
  const dorf = useMemo(() => {
    const rnd = zufall(DEKO.keim + 31);
    const mitte = dorfOrt(terrain, netz);

    const haeuser: (Platz & {
      breite: number;
      tiefe: number;
      hoehe: number;
      farbe: string;
      dach: string;
    })[] = [];
    const farben = ['#d8cdb8', '#c9b79b', '#b8a68d', '#cdbfa6', '#a89478'];
    /* Ziegeldächer sind nie alle gleich – jeder Brand fällt anders aus. */
    const dachfarben = ['#8c4232', '#7a3b2e', '#9a4f34', '#6d4034', '#87462f'];
    for (let i = 0; i < 8; i++) {
      const winkel = (i / 8) * Math.PI * 2 + rnd() * 0.5;
      const radius = 16 + rnd() * 26;
      const x = mitte.x + Math.cos(winkel) * radius;
      const z = mitte.z + Math.sin(winkel) * radius;
      if (netz.randabstand(x, z) < 16) continue;
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
        dach: dachfarben[Math.floor(rnd() * dachfarben.length)],
      });
    }
    return { mitte, haeuser };
  }, [terrain, netz]);

  /** Standort der Windmühle. Kommt aus orte.ts. */
  const muehle = useMemo(() => windmuehleOrt(terrain, netz), [terrain, netz]);

  return (
    <>
      <Windmuehle x={muehle.x} y={muehle.y} z={muehle.z} />

      {/* ---------- Felsen ---------- */}
      <instancedMesh
        args={[undefined, undefined, felsenMatrizen.length]}
        castShadow
        receiveShadow
        ref={(mesh) => {
          if (!mesh) return;
          felsenMatrizen.forEach((m, i) => {
            mesh.setMatrixAt(i, m);
            mesh.setColorAt(i, felsenFarben[i]);
          });
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
          mesh.computeBoundingSphere();
        }}
      >
        {/* Wenige Flächen, damit die Felsen kantig wirken statt wie Kugeln */}
        <dodecahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={0.95} metalness={0.02} flatShading />
      </instancedMesh>

      {/* ---------- Büsche ---------- */}
      <instancedMesh
        args={[undefined, undefined, buschMatrizen.length]}
        castShadow
        ref={(mesh) => {
          if (!mesh) return;
          buschMatrizen.forEach((m, i) => {
            mesh.setMatrixAt(i, m);
            mesh.setColorAt(i, buschFarben[i]);
          });
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
          mesh.computeBoundingSphere();
        }}
      >
        <icosahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={0.95} flatShading />
      </instancedMesh>

      {/* ---------- Dorf ---------- */}
      {dorf.haeuser.map((h, i) => {
        /*
          Das Dach steht ringsum etwas über – erst dadurch wirkt es wie ein
          Dach und nicht wie ein aufgesetzter Deckel.
        */
        const dachRadius = h.breite / 2 + 0.4;
        const dachLaenge = h.tiefe + 0.8;
        return (
          <group key={i} position={[h.x, h.y, h.z]} rotation={[0, h.drehung, 0]}>
            {/*
              Steinsockel: bricht die Wandfläche unten auf und setzt das Haus
              sichtbar auf den Boden, statt es dort einfach enden zu lassen.
            */}
            <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
              <boxGeometry args={[h.breite + 0.16, 0.6, h.tiefe + 0.16]} />
              <meshStandardMaterial color="#8a8175" roughness={0.95} />
            </mesh>

            {/* Wände */}
            <mesh position={[0, h.hoehe / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[h.breite, h.hoehe, h.tiefe]} />
              <meshStandardMaterial color={h.farbe} roughness={0.88} />
            </mesh>

            {/*
              Satteldach: ein Vierkant-Prisma, dessen Achse waagerecht liegt.

              Bei einem Zylinder ist die Achse immer die Y-Achse. Vorher stand
              das Prisma deshalb hochkant und war rund 8 m hoch – von außen
              sah das aus wie ein etwas breiterer Kasten, nicht wie ein Dach.
              rotation X = 90° dreht die Achse von Y nach Z, der First läuft
              also in die Tiefe des Hauses. Von den vier Ecken zeigt dann eine
              nach oben (der First) und eine nach unten (steckt in den Wänden).
            */}
            <mesh
              position={[0, h.hoehe, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
              receiveShadow
            >
              <cylinderGeometry args={[dachRadius, dachRadius, dachLaenge, 4, 1]} />
              <meshStandardMaterial color={h.dach} roughness={0.85} flatShading />
            </mesh>

            {/*
              Dunkler Dachrand entlang der Traufe. Diese Trennlinie zwischen
              Wand und Dach fehlt sonst komplett, und beides fließt ineinander.
            */}
            {[-1, 1].map((seite) => (
              <mesh
                key={seite}
                position={[seite * dachRadius * 0.98, h.hoehe - 0.06, 0]}
                castShadow
              >
                <boxGeometry args={[0.14, 0.16, dachLaenge]} />
                <meshStandardMaterial color="#4b3a30" roughness={0.9} />
              </mesh>
            ))}

            {/* Schornstein, neben dem First statt mittendrin */}
            <mesh
              position={[h.breite * 0.24, h.hoehe + dachRadius * 0.75, h.tiefe * 0.22]}
              castShadow
            >
              <boxGeometry args={[0.55, 1.4, 0.55]} />
              <meshStandardMaterial color="#7a6355" roughness={0.92} />
            </mesh>

            {/* Tür an der Vorderseite */}
            <mesh position={[0, 1.05, h.tiefe / 2 + 0.03]}>
              <boxGeometry args={[0.9, 2.1, 0.08]} />
              <meshStandardMaterial color="#5a3b28" roughness={0.85} />
            </mesh>

            {/*
              Fenster als einzelne Rechtecke mit dunklem Rahmen statt eines
              durchgehenden Streifens. Vier Fenster pro Haus reichen: Sobald
              das Auge eine Fensterordnung erkennt, liest es das Objekt als
              Haus und nicht mehr als Kasten.
            */}
            {[-1, 1].map((seite) =>
              [-h.tiefe * 0.22, h.tiefe * 0.22].map((z, k) => (
                <group
                  key={`${seite}-${k}`}
                  position={[seite * (h.breite / 2 + 0.02), h.hoehe * 0.55, z]}
                >
                  <mesh>
                    <boxGeometry args={[0.06, 1.15, 0.95]} />
                    <meshStandardMaterial color="#4a3a2e" roughness={0.9} />
                  </mesh>
                  <mesh position={[seite * 0.02, 0, 0]}>
                    <boxGeometry args={[0.05, 0.9, 0.7]} />
                    <meshStandardMaterial
                      color="#ffdca0"
                      emissive="#ffcf80"
                      emissiveIntensity={0.7}
                      toneMapped={false}
                    />
                  </mesh>
                </group>
              )),
            )}
          </group>
        );
      })}

      {/*
        Kollision nur für die Häuser. Felsen und Büsche bleiben ohne –
        sonst müsste die Physik mehrere hundert zusätzliche Körper verwalten,
        und über einen Busch fährt man ohnehin gern hinweg.
      */}
      <RigidBody type="fixed" colliders={false}>
        {dorf.haeuser.map((h, i) => (
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
