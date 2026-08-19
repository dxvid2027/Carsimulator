import { useMemo } from 'react';
import { HeightfieldCollider, RigidBody } from '@react-three/rapier';
import {
  BufferAttribute,
  CanvasTexture,
  Color,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import { WELT, ZELLE, type Terraindaten } from './heightmap';

/**
 * Anzahl Kacheln pro Kante. Das Terrain wird in einzelne Meshes zerlegt,
 * damit three.js Kacheln außerhalb des Sichtfelds überspringen kann
 * (Frustum Culling). Ein einziges großes Mesh wäre entweder ganz sichtbar
 * oder ganz unsichtbar – Culling würde also nichts bringen.
 */
const KACHELN = 4;

/**
 * Feine Detailtextur, im Code erzeugt (kein Download).
 *
 * Die Einfärbung über Vertex-Farben ist großflächig – aus der Nähe sähe der
 * Boden ohne diese Textur wie eine glatte grüne Fläche aus. Die Textur wird
 * mit der Vertex-Farbe multipliziert, deshalb liegen ihre Helligkeiten nahe
 * bei 1 (sie dunkelt nur leicht ab, statt eine eigene Farbe zu setzen).
 */
function macheDetailTextur() {
  const groesse = 256;
  const c = document.createElement('canvas');
  c.width = c.height = groesse;
  const ctx = c.getContext('2d')!;
  const bild = ctx.createImageData(groesse, groesse);

  for (let i = 0; i < groesse * groesse; i++) {
    // Grobkörniges Rauschen zwischen ca. 190 und 255
    const wert = 190 + Math.floor(Math.random() * 66);
    bild.data[i * 4] = wert;
    bild.data[i * 4 + 1] = wert;
    bild.data[i * 4 + 2] = wert;
    bild.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(bild, 0, 0);

  // Ein paar dunklere Flecken für etwas Struktur
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
    const r = 3 + Math.random() * 14;
    ctx.beginPath();
    ctx.arc(Math.random() * groesse, Math.random() * groesse, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  // Eine Kachel alle 8 Meter
  tex.repeat.set(WELT.groesse / 8 / KACHELN, WELT.groesse / 8 / KACHELN);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Farben nach Höhe und Steilheit. */
const FARBEN = {
  tal: new Color('#4a5c32'),
  wiese: new Color('#5e7239'),
  hang: new Color('#6b6a4e'),
  fels: new Color('#6e6960'),
  gipfel: new Color('#8a8578'),
};

/**
 * Baut die Geometrie einer Kachel.
 *
 * Der entscheidende Punkt: Die sichtbare Fläche muss exakt dieselben Höhen
 * benutzen wie der Kollisionskörper. Deshalb lesen wir die Höhe nicht neu aus
 * dem Noise, sondern greifen über die Weltposition jedes Eckpunkts direkt in
 * dasselbe Höhen-Array. Sonst würde das Auto sichtbar schweben oder einsinken.
 */
function baueKachel(daten: Terraindaten, kachelX: number, kachelZ: number) {
  const { hoehen, aufloesung, groesse, minHoehe, maxHoehe } = daten;
  const punkte = aufloesung + 1;
  const segmenteProKachel = aufloesung / KACHELN;
  const kachelGroesse = groesse / KACHELN;

  const geo = new PlaneGeometry(
    kachelGroesse,
    kachelGroesse,
    segmenteProKachel,
    segmenteProKachel,
  );
  // Die Ebene liegt zunächst senkrecht (XY). Drehen, damit sie flach liegt (XZ).
  geo.rotateX(-Math.PI / 2);

  // Mittelpunkt dieser Kachel in Weltkoordinaten
  const versatzX = (kachelX + 0.5) * kachelGroesse - groesse / 2;
  const versatzZ = (kachelZ + 0.5) * kachelGroesse - groesse / 2;

  const pos = geo.attributes.position as BufferAttribute;
  const farben = new Float32Array(pos.count * 3);
  const farbe = new Color();
  const spanne = Math.max(1, maxHoehe - minHoehe);

  for (let i = 0; i < pos.count; i++) {
    const weltX = pos.getX(i) + versatzX;
    const weltZ = pos.getZ(i) + versatzZ;

    // Weltposition -> Gitterindex. Die Eckpunkte liegen exakt auf Gitterpunkten,
    // deshalb genügt Runden (kein Interpolieren nötig).
    const ix = Math.round((weltX / groesse + 0.5) * aufloesung);
    const iz = Math.round((weltZ / groesse + 0.5) * aufloesung);
    const ixK = Math.min(punkte - 1, Math.max(0, ix));
    const izK = Math.min(punkte - 1, Math.max(0, iz));

    const h = hoehen[izK + ixK * punkte];
    pos.setY(i, h);

    // ----- Einfärbung nach Höhe und Steilheit -----
    // Steilheit aus den Nachbarhöhen im Gitter
    const links = hoehen[izK + Math.max(0, ixK - 1) * punkte];
    const rechts = hoehen[izK + Math.min(punkte - 1, ixK + 1) * punkte];
    const vorne = hoehen[Math.max(0, izK - 1) + ixK * punkte];
    const hinten = hoehen[Math.min(punkte - 1, izK + 1) + ixK * punkte];
    const neigung = Math.hypot(rechts - links, hinten - vorne) / (2 * ZELLE);
    const steil = Math.min(1, neigung / 1.1);

    const hoehenAnteil = (h - minHoehe) / spanne;

    if (hoehenAnteil < 0.42) {
      farbe.copy(FARBEN.tal).lerp(FARBEN.wiese, hoehenAnteil / 0.42);
    } else if (hoehenAnteil < 0.72) {
      farbe.copy(FARBEN.wiese).lerp(FARBEN.hang, (hoehenAnteil - 0.42) / 0.3);
    } else {
      farbe.copy(FARBEN.hang).lerp(FARBEN.gipfel, (hoehenAnteil - 0.72) / 0.28);
    }
    // Steile Stellen werden felsig – dort wächst kein Gras
    farbe.lerp(FARBEN.fels, steil * 0.85);

    farben[i * 3] = farbe.r;
    farben[i * 3 + 1] = farbe.g;
    farben[i * 3 + 2] = farbe.b;
  }

  geo.setAttribute('color', new BufferAttribute(farben, 3));
  // Normalen neu berechnen, sonst wäre die Beleuchtung flach und falsch
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  return { geo, versatzX, versatzZ };
}

interface TerrainProps {
  daten: Terraindaten;
}

export function Terrain({ daten }: TerrainProps) {
  const detail = useMemo(() => macheDetailTextur(), []);

  const kacheln = useMemo(() => {
    const liste: { geo: PlaneGeometry; versatzX: number; versatzZ: number; key: string }[] = [];
    for (let kx = 0; kx < KACHELN; kx++) {
      for (let kz = 0; kz < KACHELN; kz++) {
        const { geo, versatzX, versatzZ } = baueKachel(daten, kx, kz);
        liste.push({ geo, versatzX, versatzZ, key: `${kx}-${kz}` });
      }
    }
    return liste;
  }, [daten]);

  return (
    <RigidBody type="fixed" friction={1.1} colliders={false}>
      {/*
        Der Kollisionskörper: ein einziges Heightfield über das ganze Terrain.
        scale.y = 1, weil in `hoehen` bereits echte Meter stehen.

        Der Cast ist nötig, weil @react-three/rapier hier `number[]` als Typ
        angibt. Rapier selbst erwartet aber ein Float32Array und verarbeitet es
        auch so – ein echtes Array wäre nur unnötig groß (66.000 Zahlen).
      */}
      <HeightfieldCollider
        args={[
          daten.aufloesung,
          daten.aufloesung,
          daten.hoehen as unknown as number[],
          { x: WELT.groesse, y: 1, z: WELT.groesse },
        ]}
      />

      {kacheln.map(({ geo, versatzX, versatzZ, key }) => (
        <mesh
          key={key}
          geometry={geo}
          position={[versatzX, 0, versatzZ]}
          receiveShadow
          castShadow
        >
          <meshStandardMaterial map={detail} vertexColors roughness={0.95} metalness={0} />
        </mesh>
      ))}
    </RigidBody>
  );
}
