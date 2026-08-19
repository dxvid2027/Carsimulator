import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Group, type Mesh } from 'three';
import { hoeheBei, type Terraindaten } from './heightmap';
import type { Strassennetz } from './strassennetz';
import type { Streckendaten } from './strecke';
import { STRASSENBAUTEN, aussichtsturmOrt, felsenfeldOrt, strassenplatz } from './orte';
import { Rampe, macheTexturen } from './Stuntpark';

/**
 * Die Sehenswürdigkeiten der Welt.
 *
 * Alles hier hat denselben Zweck: Die Landschaft soll Ziele haben, auf die man
 * zufahren kann. Deshalb ist jede Attraktion entweder hoch (man sieht sie von
 * weitem), befahrbar (Rampen, Tordurchfahrt) oder beides.
 *
 * Wo die Dinge stehen, entscheidet `orte.ts` – dieselbe Quelle, aus der auch
 * die Karte ihre Marker holt. So zeigt ein Kartensymbol nie ins Leere.
 */

/** Streifen für die Ballonhülle – im Code gezeichnet, kein Bilddownload. */
function macheBallonTextur(farbe: string, zweite: string) {
  const g = 128;
  const c = document.createElement('canvas');
  c.width = c.height = g;
  const x = c.getContext('2d')!;
  x.fillStyle = farbe;
  x.fillRect(0, 0, g, g);
  x.fillStyle = zweite;
  for (let i = 0; i < g; i += 16) x.fillRect(i, 0, 8, g);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}

/**
 * Ein Heißluftballon, der langsam auf und ab schwebt.
 *
 * Er hat absichtlich keinen Kollisionskörper: Er hängt 60 m hoch und soll nur
 * die Blickrichtung geben ("da hinten ist was").
 */
function Ballon({
  x, y, z, farbe, zweite, versatz,
}: { x: number; y: number; z: number; farbe: string; zweite: string; versatz: number }) {
  const gruppe = useRef<Group>(null);
  const huelle = useMemo(() => macheBallonTextur(farbe, zweite), [farbe, zweite]);

  useFrame(({ clock }) => {
    if (!gruppe.current) return;
    const t = clock.elapsedTime + versatz;
    // Schweben: langsam auf und ab, dazu eine sanfte Drehung
    gruppe.current.position.y = y + Math.sin(t * 0.25) * 3.5;
    gruppe.current.rotation.y = t * 0.06;
  });

  return (
    <group ref={gruppe} position={[x, y, z]}>
      <mesh castShadow>
        <sphereGeometry args={[6, 20, 16]} />
        <meshStandardMaterial map={huelle} roughness={0.65} />
      </mesh>
      {/* Der untere Kegel läuft zum Korb zusammen */}
      <mesh position={[0, -7.2, 0]}>
        <coneGeometry args={[2.6, 4, 16, 1, true]} />
        <meshStandardMaterial map={huelle} roughness={0.65} side={2} />
      </mesh>
      {/* Seile */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * 0.9, -10.4, sz * 0.9]}>
          <boxGeometry args={[0.08, 2.4, 0.08]} />
          <meshStandardMaterial color="#3a3128" roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, -11.9, 0]} castShadow>
        <boxGeometry args={[2.2, 1.6, 2.2]} />
        <meshStandardMaterial color="#9a7444" roughness={0.95} />
      </mesh>
    </group>
  );
}

/**
 * Der Aussichtsturm: ein Gittermast mit Plattform und Blinklicht.
 *
 * Das Blinklicht ist der eigentliche Trick – es macht den Turm auch aus zwei
 * Kilometern Entfernung als Ziel erkennbar.
 */
function Aussichtsturm({ x, y, z }: { x: number; y: number; z: number }) {
  const HOEHE = 24;
  const BEIN = 2.6;
  const licht = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (!licht.current) return;
    const an = Math.sin(clock.elapsedTime * 2.2) > 0.4;
    const m = licht.current.material as unknown as { emissiveIntensity: number };
    m.emissiveIntensity = an ? 4 : 0.3;
  });

  const beine = [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const;

  return (
    <group position={[x, y, z]}>
      {/* Fundament, damit der Turm am Hang nicht in der Luft steht */}
      <mesh position={[0, -0.6, 0]} receiveShadow>
        <boxGeometry args={[8, 2, 8]} />
        <meshStandardMaterial color="#8f8b84" roughness={0.95} />
      </mesh>

      {/* Vier Beine */}
      {beine.map(([sx, sz], i) => (
        <mesh key={i} position={[sx * BEIN, HOEHE / 2, sz * BEIN]} castShadow>
          <boxGeometry args={[0.42, HOEHE, 0.42]} />
          <meshStandardMaterial color="#6a5f52" roughness={0.9} />
        </mesh>
      ))}

      {/* Querstreben – sie machen aus vier Stangen erst einen Turm */}
      {Array.from({ length: 6 }, (_, etage) => {
        const hy = 3 + etage * 3.6;
        return (
          <group key={etage} position={[0, hy, 0]}>
            {[0, 1].map((achse) => (
              <mesh key={achse} rotation={[0, achse * Math.PI / 2, 0]}>
                <boxGeometry args={[BEIN * 2, 0.22, 0.22]} />
                <meshStandardMaterial color="#6a5f52" roughness={0.9} />
              </mesh>
            ))}
            {[-1, 1].map((seite) => (
              <mesh key={seite} position={[0, 1.8, seite * BEIN]} rotation={[0, 0, 0.62]}>
                <boxGeometry args={[0.18, BEIN * 3, 0.18]} />
                <meshStandardMaterial color="#6a5f52" roughness={0.9} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Plattform mit Geländer */}
      <mesh position={[0, HOEHE, 0]} castShadow receiveShadow>
        <boxGeometry args={[8, 0.4, 8]} />
        <meshStandardMaterial color="#8a6f4c" roughness={0.92} />
      </mesh>
      {[[0, 3.9], [0, -3.9], [3.9, 0], [-3.9, 0]].map(([px, pz], i) => (
        <mesh key={i} position={[px, HOEHE + 0.8, pz]}>
          <boxGeometry args={[px === 0 ? 8 : 0.16, 1.2, pz === 0 ? 8 : 0.16]} />
          <meshStandardMaterial color="#c8402f" roughness={0.8} />
        </mesh>
      ))}
      {/* Dach */}
      <mesh position={[0, HOEHE + 3.2, 0]} castShadow>
        <coneGeometry args={[6.4, 2.6, 4]} />
        <meshStandardMaterial color="#7a3a2c" roughness={0.9} flatShading />
      </mesh>
      {/* Blinklicht */}
      <mesh ref={licht} position={[0, HOEHE + 5, 0]}>
        <sphereGeometry args={[0.42, 12, 10]} />
        <meshStandardMaterial color="#ff5544" emissive="#ff2a15" emissiveIntensity={3} />
      </mesh>

      {/* Nur die Beine sind fest – zwischen ihnen kann man hindurchfahren */}
      <RigidBody type="fixed" colliders={false}>
        {beine.map(([sx, sz], i) => (
          <CuboidCollider
            key={i}
            args={[0.35, HOEHE / 2, 0.35]}
            position={[sx * BEIN, HOEHE / 2, sz * BEIN]}
          />
        ))}
        <CuboidCollider args={[4, 1, 4]} position={[0, -0.6, 0]} />
      </RigidBody>
    </group>
  );
}

/**
 * Das Felsentor: ein Steinbogen, durch den man hindurchfahren kann.
 *
 * Fest sind nur die beiden Pfeiler. Der Bogen darüber ist hoch genug, dass ihn
 * auch ein Sprung nicht erwischt.
 */
function Felsentor({ x, y, z, gier }: { x: number; y: number; z: number; gier: number }) {
  return (
    <group position={[x, y, z]} rotation={[0, gier, 0]}>
      {[-1, 1].map((seite) => (
        <mesh key={seite} position={[seite * 9, 4.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.4, 9, 5]} />
          <meshStandardMaterial color="#8b8378" roughness={0.98} flatShading />
        </mesh>
      ))}
      {/*
        Der Bogen: ein halber Ring. Ein Torus liegt von Haus aus in der
        XY-Ebene und steht damit schon aufrecht – mit `arc = PI` bleibt genau
        die obere Hälfte übrig, deren Enden auf den beiden Pfeilern aufsetzen.
      */}
      <mesh position={[0, 9, 0]} castShadow>
        <torusGeometry args={[9, 2.2, 8, 20, Math.PI]} />
        <meshStandardMaterial color="#8b8378" roughness={0.98} flatShading />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        {[-1, 1].map((seite) => (
          <CuboidCollider key={seite} args={[2.2, 4.5, 2.5]} position={[seite * 9, 4.5, 0]} />
        ))}
      </RigidBody>
    </group>
  );
}

/**
 * Eine Tankstelle am Straßenrand.
 *
 * Der Vorplatz ist ein Quader, der zwei Meter in den Boden reicht. So steht
 * die Tankstelle auch dann sauber da, wenn das Gelände leicht abfällt – ohne
 * dass wir dafür das Terrain verändern müssten (das würde die Fahrbahn direkt
 * daneben verbiegen).
 */
function Tankstelle({ x, y, z, gier }: { x: number; y: number; z: number; gier: number }) {
  return (
    <group position={[x, y, z]} rotation={[0, gier, 0]}>
      {/* Vorplatz */}
      <mesh position={[0, -1.0, 0]} receiveShadow>
        <boxGeometry args={[22, 2.1, 15]} />
        <meshStandardMaterial color="#9a978f" roughness={0.95} />
      </mesh>

      {/* Dach über den Zapfsäulen */}
      <group position={[0, 0, -2]}>
        <mesh position={[0, 5.4, 0]} castShadow>
          <boxGeometry args={[14, 0.7, 9]} />
          <meshStandardMaterial color="#d9dde2" roughness={0.55} metalness={0.25} />
        </mesh>
        <mesh position={[0, 4.9, 0]}>
          <boxGeometry args={[14.3, 0.45, 9.3]} />
          <meshStandardMaterial color="#e04a2f" emissive="#8c2312" emissiveIntensity={0.4} roughness={0.6} />
        </mesh>
        {[[-5.5, -3.5], [5.5, -3.5], [-5.5, 3.5], [5.5, 3.5]].map(([px, pz], i) => (
          <mesh key={i} position={[px, 2.5, pz]} castShadow>
            <boxGeometry args={[0.55, 5, 0.55]} />
            <meshStandardMaterial color="#c9ccd0" roughness={0.5} metalness={0.3} />
          </mesh>
        ))}
        {/* Zapfsäulen */}
        {[-3, 3].map((px) => (
          <group key={px} position={[px, 0, 0]}>
            <mesh position={[0, 0.35, 0]} receiveShadow>
              <boxGeometry args={[3.2, 0.35, 5]} />
              <meshStandardMaterial color="#7f7c75" roughness={0.95} />
            </mesh>
            <mesh position={[0, 1.4, 0]} castShadow>
              <boxGeometry args={[1.1, 1.8, 0.9]} />
              <meshStandardMaterial color="#e6e8ea" roughness={0.5} metalness={0.2} />
            </mesh>
            <mesh position={[0, 1.9, 0.48]}>
              <boxGeometry args={[0.7, 0.5, 0.06]} />
              <meshStandardMaterial color="#1b2733" emissive="#2f7fd0" emissiveIntensity={0.8} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Shop */}
      <group position={[0, 0, 6]}>
        <mesh position={[0, 1.9, 0]} castShadow receiveShadow>
          <boxGeometry args={[10, 3.8, 5]} />
          <meshStandardMaterial color="#e7e3d8" roughness={0.85} />
        </mesh>
        <mesh position={[0, 3.95, 0]} castShadow>
          <boxGeometry args={[10.6, 0.35, 5.6]} />
          <meshStandardMaterial color="#c8402f" roughness={0.8} />
        </mesh>
        {/* Schaufenster zur Straße */}
        <mesh position={[0, 1.9, -2.55]}>
          <boxGeometry args={[7.4, 2.2, 0.1]} />
          <meshStandardMaterial color="#20303c" roughness={0.15} metalness={0.5} />
        </mesh>
      </group>

      {/* Preisschild an der Straße */}
      <group position={[-9, 0, -6]}>
        <mesh position={[0, 2.8, 0]} castShadow>
          <boxGeometry args={[0.35, 5.6, 0.35]} />
          <meshStandardMaterial color="#8d9096" roughness={0.6} metalness={0.3} />
        </mesh>
        <mesh position={[0, 6.1, 0]} castShadow>
          <boxGeometry args={[3.2, 2.2, 0.25]} />
          <meshStandardMaterial color="#e04a2f" emissive="#c0341c" emissiveIntensity={0.6} roughness={0.6} />
        </mesh>
      </group>

      <RigidBody type="fixed" colliders={false} friction={1}>
        <CuboidCollider args={[11, 1.05, 7.5]} position={[0, -1.0, 0]} />
        {[[-5.5, -5.5], [5.5, -5.5], [-5.5, 1.5], [5.5, 1.5]].map(([px, pz], i) => (
          <CuboidCollider key={i} args={[0.3, 2.5, 0.3]} position={[px, 2.5, pz]} />
        ))}
        {[-3, 3].map((px) => (
          <CuboidCollider key={px} args={[1.6, 0.2, 2.5]} position={[px, 0.35, -2]} />
        ))}
        <CuboidCollider args={[5, 1.9, 2.5]} position={[0, 1.9, 6]} />
        <CuboidCollider args={[0.3, 2.8, 0.3]} position={[-9, 2.8, -6]} />
      </RigidBody>
    </group>
  );
}

interface AttraktionenProps {
  terrain: Terraindaten;
  netz: Strassennetz;
  strecke: Streckendaten;
}

export function Attraktionen({ terrain, netz, strecke }: AttraktionenProps) {
  const { holz, streifen } = useMemo(() => macheTexturen(), []);

  const turm = useMemo(() => aussichtsturmOrt(terrain, netz), [terrain, netz]);
  const felsen = useMemo(() => felsenfeldOrt(terrain, netz), [terrain, netz]);
  const tanke = useMemo(
    () =>
      strassenplatz(
        terrain, strecke, STRASSENBAUTEN.tankstelle.anteil, STRASSENBAUTEN.tankstelle.seitlich,
      ),
    [terrain, strecke],
  );

  /*
    Straßenrampen: Sie stehen neben der Fahrbahn und zeigen von ihr weg. Man
    fährt also von der Straße herunter, auf die Rampe und springt ins Gelände.
  */
  const strassenrampen = useMemo(
    () =>
      STRASSENBAUTEN.rampen.map((r) => ({
        ...strassenplatz(terrain, strecke, r.anteil, r.seitlich),
        breite: r.breite,
        laenge: r.laenge,
        hoehe: r.hoehe,
      })),
    [terrain, strecke],
  );

  /** Ballons über den Sehenswürdigkeiten. */
  const ballons = useMemo(
    () => [
      { x: turm.x + 60, z: turm.z - 40, farbe: '#e0453a', zweite: '#f6efe2', versatz: 0 },
      { x: felsen.x - 50, z: felsen.z + 30, farbe: '#2f6fc0', zweite: '#ffd66b', versatz: 2.4 },
      { x: 40, z: 30, farbe: '#2f9d5b', zweite: '#f6efe2', versatz: 4.8 },
    ].map((b) => ({ ...b, y: hoeheBei(terrain, b.x, b.z) + 72 })),
    [terrain, turm, felsen],
  );

  return (
    <>
      <Aussichtsturm x={turm.x} y={turm.y} z={turm.z} />

      {/*
        Das Felsentor steht am Rand des Felsenfelds (Radius 42 m) und bildet
        seine Einfahrt – mitten im Feld stünde es zwischen den Blöcken.
      */}
      <Felsentor
        x={felsen.x}
        y={hoeheBei(terrain, felsen.x, felsen.z - 58)}
        z={felsen.z - 58}
        gier={0}
      />

      <Tankstelle x={tanke.x} y={tanke.y} z={tanke.z} gier={tanke.gier} />

      {strassenrampen.map((r, i) => (
        <Rampe
          key={i}
          x={r.x}
          y={r.y}
          z={r.z}
          /*
            `gier` aus strassenplatz zeigt zur Straße. Die Rampe steigt in
            ihre eigene +z-Richtung an – gedreht um 180° zeigt sie also von der
            Straße weg ins Gelände, und man springt von der Fahrbahn ab.
          */
          gier={r.gier + Math.PI}
          breite={r.breite}
          laenge={r.laenge}
          hoehe={r.hoehe}
          textur={holz}
          streifen={streifen}
        />
      ))}

      {ballons.map((b, i) => (
        <Ballon key={i} {...b} />
      ))}
    </>
  );
}
