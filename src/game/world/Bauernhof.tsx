import { useMemo } from 'react';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import { hoeheBei, type Terraindaten } from './heightmap';
import type { Strassennetz } from './strassennetz';
import { bauernhofOrt } from './orte';

/**
 * Ein Bauernhof: Scheune, Silo, Wasserturm und ein Weidezaun.
 *
 * Warum ein Hof und nicht noch ein paar Häuser? Weil die drei Gebäude
 * unterschiedlich hoch sind. Der Wasserturm ist von weitem zu sehen, das Silo
 * gibt die Richtung vor, und die Scheune erkennt man erst aus der Nähe – so
 * entsteht beim Hinfahren nach und nach ein Ort.
 *
 * Alle Gebäude stehen auf einem Sockel, der in den Boden reicht. Damit stehen
 * sie auch an einer leichten Schräge sauber da, ohne dass das Terrain dafür
 * verändert werden müsste.
 */

/** Bretterwand und Wellblech im Code gezeichnet. */
function macheHofTexturen() {
  const g = 256;
  const bc = document.createElement('canvas');
  bc.width = bc.height = g;
  const bx = bc.getContext('2d')!;
  bx.fillStyle = '#9c3b2e';
  bx.fillRect(0, 0, g, g);
  for (let x = 0; x < g; x += 16) {
    bx.fillStyle = `rgba(0,0,0,${0.1 + Math.random() * 0.12})`;
    bx.fillRect(x, 0, 2, g);
    bx.fillStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.05})`;
    bx.fillRect(x + 3, 0, 3, g);
  }
  const bretter = new CanvasTexture(bc);
  bretter.wrapS = bretter.wrapT = RepeatWrapping;
  bretter.colorSpace = SRGBColorSpace;
  bretter.repeat.set(4, 2);

  const wc = document.createElement('canvas');
  wc.width = wc.height = g;
  const wx = wc.getContext('2d')!;
  wx.fillStyle = '#b9bcc0';
  wx.fillRect(0, 0, g, g);
  for (let x = 0; x < g; x += 12) {
    wx.fillStyle = 'rgba(0,0,0,0.14)';
    wx.fillRect(x, 0, 5, g);
    wx.fillStyle = 'rgba(255,255,255,0.18)';
    wx.fillRect(x + 6, 0, 3, g);
  }
  const wellblech = new CanvasTexture(wc);
  wellblech.wrapS = wellblech.wrapT = RepeatWrapping;
  wellblech.colorSpace = SRGBColorSpace;
  wellblech.repeat.set(6, 2);

  return { bretter, wellblech };
}

interface BauernhofProps {
  terrain: Terraindaten;
  netz: Strassennetz;
}

export function Bauernhof({ terrain, netz }: BauernhofProps) {
  const ort = useMemo(() => bauernhofOrt(terrain, netz), [terrain, netz]);
  const { bretter, wellblech } = useMemo(() => macheHofTexturen(), []);

  /*
    Der Giebel ist ein einzelnes Dreieck: unten so breit wie die Scheune,
    oben so hoch wie der First. Drei Eckpunkte genügen dafür.
  */
  const giebel = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([-7, 0, 0, 7, 0, 0, 0, 3.45, 0]), 3),
    );
    g.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0.5, 1]), 2));
    g.computeVertexNormals();
    return g;
  }, []);

  /** Höhe an einer Stelle des Hofes, relativ zum Mittelpunkt. */
  const h = (dx: number, dz: number) => hoeheBei(terrain, ort.x + dx, ort.z + dz);

  return (
    <group>
      {/* ---------- Scheune ---------- */}
      <group position={[ort.x, h(0, 0), ort.z]} rotation={[0, 0.4, 0]}>
        {/* Sockel */}
        <mesh position={[0, -0.8, 0]} receiveShadow>
          <boxGeometry args={[15, 2, 10]} />
          <meshStandardMaterial color="#8d8878" roughness={0.98} />
        </mesh>
        <mesh position={[0, 2.6, 0]} castShadow receiveShadow>
          <boxGeometry args={[14, 5.2, 9]} />
          <meshStandardMaterial map={bretter} roughness={0.92} />
        </mesh>
        {/*
          Satteldach aus zwei geneigten Platten. Ein Kegel mit vier Seiten wäre
          einfacher, sähe aber wie ein Zelt aus – eine Scheune hat einen First.
        */}
        {[-1, 1].map((seite) => (
          <mesh
            key={seite}
            position={[0, 6.6, seite * 2.35]}
            rotation={[seite * -0.72, 0, 0]}
            castShadow
          >
            <boxGeometry args={[14.6, 0.3, 6.2]} />
            <meshStandardMaterial map={wellblech} color="#5d6066" roughness={0.7} metalness={0.25} />
          </mesh>
        ))}
        {/*
          Giebelwände. Ohne sie klafft zwischen Wand und Dach ein Loch und man
          sieht in die Scheune hinein – das Dach wirkt dann, als schwebe es.
        */}
        {[-1, 1].map((seite) => (
          <mesh key={seite} position={[0, 5.2, seite * 4.48]} geometry={giebel} castShadow>
            <meshStandardMaterial map={bretter} roughness={0.92} side={DoubleSide} />
          </mesh>
        ))}

        {/* Tor */}
        <mesh position={[0, 2.1, 4.55]}>
          <boxGeometry args={[5, 4.2, 0.16]} />
          <meshStandardMaterial color="#e6ded0" roughness={0.9} />
        </mesh>
        <mesh position={[0, 2.1, 4.63]}>
          <boxGeometry args={[0.3, 4.2, 0.06]} />
          <meshStandardMaterial color="#7d3227" roughness={0.9} />
        </mesh>
        <RigidBody type="fixed" colliders={false} friction={0.9}>
          <CuboidCollider args={[7, 2.6, 4.5]} position={[0, 2.6, 0]} />
          <CuboidCollider args={[7.5, 1, 5]} position={[0, -0.8, 0]} />
        </RigidBody>
      </group>

      {/* ---------- Silo ---------- */}
      <group position={[ort.x + 13, h(13, -9), ort.z - 9]}>
        <mesh position={[0, -0.7, 0]} receiveShadow>
          <cylinderGeometry args={[3.4, 3.4, 1.8, 16]} />
          <meshStandardMaterial color="#8d8878" roughness={0.98} />
        </mesh>
        <mesh position={[0, 6, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[3, 3, 12, 20]} />
          <meshStandardMaterial map={wellblech} color="#cfd3d7" roughness={0.55} metalness={0.35} />
        </mesh>
        <mesh position={[0, 13, 0]} castShadow>
          <coneGeometry args={[3.2, 2.4, 20]} />
          <meshStandardMaterial color="#9aa0a6" roughness={0.5} metalness={0.4} />
        </mesh>
        {/* Leiter */}
        <mesh position={[0, 6, 3.05]}>
          <boxGeometry args={[0.7, 12, 0.12]} />
          <meshStandardMaterial color="#6f7378" roughness={0.7} metalness={0.4} />
        </mesh>
        <RigidBody type="fixed" colliders={false}>
          <CylinderCollider args={[6, 3]} position={[0, 6, 0]} />
        </RigidBody>
      </group>

      {/* ---------- Wasserturm ---------- */}
      <group position={[ort.x - 16, h(-16, 6), ort.z + 6]}>
        <mesh position={[0, -0.7, 0]} receiveShadow>
          <boxGeometry args={[7, 1.8, 7]} />
          <meshStandardMaterial color="#8d8878" roughness={0.98} />
        </mesh>
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
          <mesh key={i} position={[sx * 2.2, 5, sz * 2.2]} rotation={[sz * 0.06, 0, -sx * 0.06]} castShadow>
            <boxGeometry args={[0.38, 10, 0.38]} />
            <meshStandardMaterial color="#6d5c43" roughness={0.92} />
          </mesh>
        ))}
        {[3.4, 7].map((hy) => (
          <group key={hy} position={[0, hy, 0]}>
            {[0, 1].map((achse) => (
              <mesh key={achse} rotation={[0, (achse * Math.PI) / 2, 0]}>
                <boxGeometry args={[4.6, 0.2, 0.2]} />
                <meshStandardMaterial color="#6d5c43" roughness={0.92} />
              </mesh>
            ))}
          </group>
        ))}
        <mesh position={[0, 12.4, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[3.6, 3.6, 4.6, 18]} />
          <meshStandardMaterial map={wellblech} color="#7f9aa8" roughness={0.6} metalness={0.3} />
        </mesh>
        <mesh position={[0, 15.4, 0]} castShadow>
          <coneGeometry args={[3.9, 1.8, 18]} />
          <meshStandardMaterial color="#54666f" roughness={0.7} metalness={0.2} />
        </mesh>
        <RigidBody type="fixed" colliders={false}>
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
            <CuboidCollider key={i} args={[0.3, 5, 0.3]} position={[sx * 2.2, 5, sz * 2.2]} />
          ))}
        </RigidBody>
      </group>

      {/*
        Weidezaun. Er hat bewusst keinen Kollisionskörper: Ein Zaun, der das
        Auto stoppt, macht aus der offenen Welt einen Flur. Man fährt hindurch.
      */}
      {Array.from({ length: 34 }, (_, i) => {
        const winkel = (i / 34) * Math.PI * 2;
        const r = 34;
        const dx = Math.cos(winkel) * r;
        const dz = Math.sin(winkel) * r * 0.75;
        return (
          <group key={i} position={[ort.x + dx, h(dx, dz), ort.z + dz]} rotation={[0, -winkel, 0]}>
            <mesh position={[0, 0.75, 0]} castShadow>
              <boxGeometry args={[0.16, 1.5, 0.16]} />
              <meshStandardMaterial color="#7d6a4e" roughness={0.95} />
            </mesh>
            <mesh position={[0, 1.1, 3]}>
              <boxGeometry args={[0.1, 0.16, 6.2]} />
              <meshStandardMaterial color="#7d6a4e" roughness={0.95} />
            </mesh>
            <mesh position={[0, 0.55, 3]}>
              <boxGeometry args={[0.1, 0.16, 6.2]} />
              <meshStandardMaterial color="#7d6a4e" roughness={0.95} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
