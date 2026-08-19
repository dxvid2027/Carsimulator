import { useMemo } from 'react';
import { ConvexHullCollider, CuboidCollider, RigidBody } from '@react-three/rapier';
import { BufferAttribute, BufferGeometry, CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { hoeheBei, type Terraindaten } from './heightmap';
import type { Strassennetz } from './strassennetz';
import { stuntparkOrt } from './orte';

/**
 * Der Stuntpark: Sprungrampen, Landeplattformen und Container zum Draufspringen.
 *
 * Die Rampen sind echte Keile, keine gekippten Quader. Das ist wichtig: Ein
 * gekippter Quader hat an der Unterkante eine Stufe, an der das Auto hängen
 * bleibt statt hinaufzufahren. Der Keil läuft dagegen bei null aus.
 *
 * Der Kollisionskörper ist eine konvexe Hülle aus genau denselben sechs
 * Eckpunkten wie die sichtbare Form – Bild und Physik können also gar nicht
 * auseinanderlaufen.
 */

export const STUNTPARK = {
  /** Halbe Kantenlänge des Geländes, das eingeebnet wird. */
  flaeche: 60,
} as const;

/**
 * Baut einen Keil: Er beginnt bei z = 0 flach am Boden und steigt bis z = laenge
 * auf die Höhe an.
 */
function macheKeil(breite: number, laenge: number, hoehe: number) {
  const b = breite / 2;
  // 0..3 unten, 4..5 oben an der hohen Kante
  const p = [
    [-b, 0, 0], [b, 0, 0],
    [-b, 0, laenge], [b, 0, laenge],
    [-b, hoehe, laenge], [b, hoehe, laenge],
  ];

  const dreiecke: number[][][] = [
    // Fahrfläche (von unten vorn nach oben hinten)
    [p[0], p[1], p[5]], [p[0], p[5], p[4]],
    // Boden
    [p[0], p[2], p[3]], [p[0], p[3], p[1]],
    // Rückwand
    [p[2], p[4], p[5]], [p[2], p[5], p[3]],
    // Seiten
    [p[0], p[4], p[2]], [p[1], p[3], p[5]],
  ];

  /*
    Die Reihenfolge der Eckpunkte bestimmt, wohin eine Fläche zeigt. Zeigt sie
    nach innen, ist sie unsichtbar – man schaut in den hohlen Körper hinein.
    Statt jede Fläche von Hand richtig herum zu schreiben (und dabei Fehler zu
    machen), drehen wir sie hier automatisch:

    Bei einem konvexen Körper zeigt jede Außenfläche vom Mittelpunkt WEG.
    Wir vergleichen also die Flächennormale mit der Richtung zum Mittelpunkt
    und tauschen zwei Eckpunkte, wenn sie nach innen zeigt.
  */
  const mittelpunkt = p.reduce(
    (summe, v) => [summe[0] + v[0] / p.length, summe[1] + v[1] / p.length, summe[2] + v[2] / p.length],
    [0, 0, 0],
  );

  const positionen = new Float32Array(dreiecke.length * 9);
  dreiecke.forEach((dreieck, i) => {
    const [a, b2, c] = dreieck;
    const u = [b2[0] - a[0], b2[1] - a[1], b2[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const normale = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    const nachAussen = [
      (a[0] + b2[0] + c[0]) / 3 - mittelpunkt[0],
      (a[1] + b2[1] + c[1]) / 3 - mittelpunkt[1],
      (a[2] + b2[2] + c[2]) / 3 - mittelpunkt[2],
    ];
    const zeigtNachInnen =
      normale[0] * nachAussen[0] + normale[1] * nachAussen[1] + normale[2] * nachAussen[2] < 0;
    const richtig = zeigtNachInnen ? [a, c, b2] : [a, b2, c];
    positionen.set(richtig.flat(), i * 9);
  });

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(positionen, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  // Dieselben Eckpunkte für die konvexe Hülle
  const huelle = new Float32Array(p.flat());
  return { geo, huelle };
}

/** Holz- und Metalltexturen im Code erzeugt. */
function macheTexturen() {
  // Holzplanken
  const hg = 256;
  const hc = document.createElement('canvas');
  hc.width = hc.height = hg;
  const hx = hc.getContext('2d')!;
  hx.fillStyle = '#8a6440';
  hx.fillRect(0, 0, hg, hg);
  for (let i = 0; i < 8; i++) {
    const y = (i / 8) * hg;
    hx.fillStyle = `rgba(0,0,0,${0.12 + Math.random() * 0.1})`;
    hx.fillRect(0, y, hg, 2);
    // Maserung
    for (let k = 0; k < 40; k++) {
      hx.strokeStyle = `rgba(${90 + Math.random() * 60}, ${64 + Math.random() * 40}, ${40 + Math.random() * 26}, 0.35)`;
      hx.lineWidth = 0.8 + Math.random();
      hx.beginPath();
      hx.moveTo(Math.random() * hg, y + Math.random() * (hg / 8));
      hx.lineTo(Math.random() * hg, y + Math.random() * (hg / 8));
      hx.stroke();
    }
  }
  const holz = new CanvasTexture(hc);
  holz.wrapS = holz.wrapT = RepeatWrapping;
  holz.colorSpace = SRGBColorSpace;
  holz.anisotropy = 8;

  // Container-Riffelblech
  const cg = 128;
  const cc = document.createElement('canvas');
  cc.width = cc.height = cg;
  const cx = cc.getContext('2d')!;
  cx.fillStyle = '#c8c8c8';
  cx.fillRect(0, 0, cg, cg);
  for (let x = 0; x < cg; x += 10) {
    cx.fillStyle = 'rgba(0,0,0,0.16)';
    cx.fillRect(x, 0, 4, cg);
    cx.fillStyle = 'rgba(255,255,255,0.16)';
    cx.fillRect(x + 4, 0, 2, cg);
  }
  const blech = new CanvasTexture(cc);
  blech.wrapS = blech.wrapT = RepeatWrapping;
  blech.colorSpace = SRGBColorSpace;

  return { holz, blech };
}

interface RampeProps {
  x: number;
  y: number;
  z: number;
  gier: number;
  breite: number;
  laenge: number;
  hoehe: number;
  farbe?: string;
  textur?: CanvasTexture;
}

/** Eine einzelne Sprungrampe. */
export function Rampe({ x, y, z, gier, breite, laenge, hoehe, farbe, textur }: RampeProps) {
  const { geo, huelle } = useMemo(
    () => macheKeil(breite, laenge, hoehe),
    [breite, laenge, hoehe],
  );

  return (
    <group position={[x, y, z]} rotation={[0, gier, 0]}>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial
          map={textur}
          color={farbe ?? '#a8845c'}
          roughness={0.9}
          metalness={0.05}
        />
      </mesh>
      {/*
        Die konvexe Hülle nutzt genau dieselben Eckpunkte wie die sichtbare
        Form. Ein Quader-Kollisionskörper wäre hier falsch: Er würde die
        schräge Fahrfläche als senkrechte Wand abbilden.
      */}
      <RigidBody type="fixed" colliders={false} friction={1.1}>
        <ConvexHullCollider args={[huelle]} />
      </RigidBody>
    </group>
  );
}

interface StuntparkProps {
  terrain: Terraindaten;
  netz: Strassennetz;
}

export function Stuntpark({ terrain, netz }: StuntparkProps) {
  const ort = useMemo(() => stuntparkOrt(terrain, netz), [terrain, netz]);
  const { holz, blech } = useMemo(() => macheTexturen(), []);

  /** Höhe an einer Stelle des Parks, relativ zum Mittelpunkt. */
  const h = (dx: number, dz: number) => hoeheBei(terrain, ort.x + dx, ort.z + dz);

  return (
    <group>
      {/* ---------- Weitsprung: Absprung- und Landerampe ---------- */}
      {/*
        Zwei Rampen, die einander zugewandt sind. Dazwischen eine Lücke: Man
        springt von der einen ab und landet auf der Gegenschräge. Die
        Landerampe steht andersherum, damit man auf ihrer Schräge aufsetzt und
        nicht gegen eine Kante prallt.
      */}
      <Rampe
        x={ort.x} y={h(0, -34)} z={ort.z - 34}
        gier={0} breite={11} laenge={16} hoehe={3.4}
        textur={holz}
      />
      <Rampe
        x={ort.x} y={h(0, 34)} z={ort.z + 34}
        gier={Math.PI} breite={13} laenge={18} hoehe={3.0}
        textur={holz}
      />

      {/* ---------- Große Rampe auf eine Plattform ---------- */}
      <Rampe
        x={ort.x - 40} y={h(-40, -18)} z={ort.z - 18}
        gier={0} breite={9} laenge={22} hoehe={5.5}
        textur={holz}
      />
      {/* Die Plattform schließt oben an die Rampe an */}
      <group position={[ort.x - 40, h(-40, -18) + 5.5, ort.z + 6]}>
        <mesh position={[0, -0.4, 0]} castShadow receiveShadow>
          <boxGeometry args={[13, 0.8, 26]} />
          <meshStandardMaterial map={holz} color="#96784f" roughness={0.9} />
        </mesh>
        {/* Stützen */}
        {[-5.5, 5.5].map((sx) =>
          [-11, 0, 11].map((sz) => (
            <mesh key={`${sx}-${sz}`} position={[sx, -3.2, sz]} castShadow>
              <boxGeometry args={[0.6, 5.6, 0.6]} />
              <meshStandardMaterial color="#6b5136" roughness={0.95} />
            </mesh>
          )),
        )}
        <RigidBody type="fixed" colliders={false} friction={1}>
          <CuboidCollider args={[6.5, 0.4, 13]} position={[0, -0.4, 0]} />
        </RigidBody>
      </group>
      {/* Abfahrt von der Plattform auf der anderen Seite */}
      <Rampe
        x={ort.x - 40} y={h(-40, 32)} z={ort.z + 32 + 14}
        gier={Math.PI} breite={9} laenge={14} hoehe={5.5}
        textur={holz}
      />

      {/* ---------- Container zum Draufspringen ---------- */}
      {[
        { dx: 40, dz: -20, h: 1, laenge: 12 },
        { dx: 40, dz: -6, h: 2, laenge: 12 },
        { dx: 40, dz: 8, h: 3, laenge: 12 },
      ].map((c, i) => (
        <group key={i} position={[ort.x + c.dx, h(c.dx, c.dz), ort.z + c.dz]}>
          {Array.from({ length: c.h }, (_, etage) => (
            <mesh
              key={etage}
              position={[0, 1.3 + etage * 2.6, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[2.9, 2.6, c.laenge]} />
              <meshStandardMaterial
                map={blech}
                color={['#b8492f', '#2f6ab8', '#3f8f4f'][etage % 3]}
                roughness={0.6}
                metalness={0.35}
              />
            </mesh>
          ))}
          <RigidBody type="fixed" colliders={false} friction={0.9}>
            <CuboidCollider
              args={[1.45, (c.h * 2.6) / 2, c.laenge / 2]}
              position={[0, (c.h * 2.6) / 2, 0]}
            />
          </RigidBody>
        </group>
      ))}
      {/* Anfahrtsrampe zu den Containern */}
      <Rampe
        x={ort.x + 40} y={h(40, -36)} z={ort.z - 36}
        gier={0} breite={8} laenge={13} hoehe={2.6}
        textur={holz}
      />

      {/* ---------- Reifenstapel als Abgrenzung ---------- */}
      {Array.from({ length: 16 }, (_, i) => {
        const winkel = (i / 16) * Math.PI * 2;
        const r = 52;
        const dx = Math.cos(winkel) * r;
        const dz = Math.sin(winkel) * r;
        return (
          <group key={i} position={[ort.x + dx, h(dx, dz), ort.z + dz]}>
            {[0, 1, 2].map((etage) => (
              <mesh key={etage} position={[0, 0.28 + etage * 0.5, 0]} castShadow>
                <torusGeometry args={[0.62, 0.24, 8, 14]} />
                <meshStandardMaterial color="#1a1c1f" roughness={0.95} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* ---------- Schild ---------- */}
      <group position={[ort.x, h(0, -52), ort.z - 52]}>
        {[-2.6, 2.6].map((sx) => (
          <mesh key={sx} position={[sx, 2.2, 0]} castShadow>
            <boxGeometry args={[0.3, 4.4, 0.3]} />
            <meshStandardMaterial color="#5a4630" roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[0, 4.6, 0]} castShadow>
          <boxGeometry args={[6.4, 1.5, 0.2]} />
          <meshStandardMaterial
            color="#e8a33d"
            emissive="#c07a1a"
            emissiveIntensity={0.5}
            roughness={0.7}
          />
        </mesh>
      </group>
    </group>
  );
}
