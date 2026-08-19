import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, Group, Mesh, MeshStandardMaterial } from 'three';
import {
  RENNEN_EINSTELLUNGEN,
  TOR_BREITE,
  rennen,
  startzone,
} from './rennen';

/**
 * Die sichtbare Startzone und die Kontrollpunkt-Tore.
 *
 * Die Startzone liegt immer da, auch beim freien Fahren – sie ist die
 * Einladung, ein Rennen zu starten. Die Tore erscheinen erst, wenn das Rennen
 * läuft, und immer nur das nächste ist hell hervorgehoben. So sieht man
 * jederzeit, wohin es geht, ohne dass die Landschaft zugestellt wird.
 *
 * Alles hier ist nur Optik: kein Kollisionskörper, keine Physik.
 */

/** Höhe des Torbogens über der Fahrbahn. */
const TOR_HOEHE = 7;

export function RaceZone() {
  const ringRef = useRef<Mesh>(null);
  const saeulenRef = useRef<Group>(null);
  const toreRef = useRef<Group>(null);

  const zone = useMemo(() => startzone(), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);

    // --- Startzone: pulsiert, solange sie eine Einladung ist ---
    const ring = ringRef.current;
    if (ring) {
      const aktiv = rennen.phase === 'frei' || rennen.phase === 'bereit';
      ring.visible = aktiv;
      if (aktiv) {
        const material = ring.material as MeshStandardMaterial;
        // Pulsieren: stärker, wenn man drinsteht
        const takt = (Math.sin(performance.now() / 380) + 1) / 2;
        material.emissiveIntensity = rennen.inZone ? 2.2 + takt * 1.6 : 0.9 + takt * 0.5;
      }
    }
    const saeulen = saeulenRef.current;
    if (saeulen) saeulen.visible = rennen.phase === 'frei' || rennen.phase === 'bereit';

    // --- Kontrollpunkt-Tore: nur während des Rennens ---
    const tore = toreRef.current;
    if (tore) {
      const imRennen = rennen.phase === 'laeuft' || rennen.phase === 'countdown';
      tore.visible = imRennen;
      if (imRennen) {
        tore.children.forEach((kind, i) => {
          const naechstes = i === rennen.naechsterCheckpoint;
          // Nur das nächste Tor und das übernächste zeigen
          const uebernaechstes = i === (rennen.naechsterCheckpoint + 1) % rennen.checkpoints.length;
          kind.visible = naechstes || uebernaechstes;
          kind.traverse((teil) => {
            const mesh = teil as Mesh;
            if (!mesh.isMesh) return;
            const material = mesh.material as MeshStandardMaterial;
            if (!material.emissive) return;
            const ziel = naechstes ? 2.6 : 0.5;
            material.emissiveIntensity += (ziel - material.emissiveIntensity) * dt * 6;
          });
        });
      }
    }
  });

  if (!zone) return null;

  /** Drehung, damit ein Tor quer zur Fahrbahn steht. */
  const gier = (rx: number, rz: number) => Math.atan2(rx, rz);

  return (
    <group>
      {/* ---------- Startzone ---------- */}
      {/* Leuchtender Ring auf dem Asphalt */}
      <mesh
        ref={ringRef}
        position={[zone.x, zone.y + 0.08, zone.z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[RENNEN_EINSTELLUNGEN.zonenRadius - 1.6, RENNEN_EINSTELLUNGEN.zonenRadius, 48]} />
        <meshStandardMaterial
          color="#4fc3f7"
          emissive="#4fc3f7"
          emissiveIntensity={1.2}
          transparent
          opacity={0.85}
          side={DoubleSide}
          toneMapped={false}
        />
      </mesh>

      {/* Zwei Säulen links und rechts der Fahrbahn */}
      <group ref={saeulenRef} position={[zone.x, zone.y, zone.z]} rotation={[0, gier(zone.rx, zone.rz), 0]}>
        {[-1, 1].map((seite) => (
          <group key={seite} position={[seite * (TOR_BREITE / 2 + 1.6), 0, 0]}>
            <mesh position={[0, TOR_HOEHE / 2, 0]} castShadow>
              <boxGeometry args={[0.5, TOR_HOEHE, 0.5]} />
              <meshStandardMaterial color="#233240" metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[0, TOR_HOEHE * 0.72, 0]}>
              <boxGeometry args={[0.62, 1.6, 0.62]} />
              <meshStandardMaterial
                color="#4fc3f7"
                emissive="#4fc3f7"
                emissiveIntensity={1.8}
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}
        {/* Querbalken oben */}
        <mesh position={[0, TOR_HOEHE, 0]} castShadow>
          <boxGeometry args={[TOR_BREITE + 3.7, 0.55, 0.4]} />
          <meshStandardMaterial color="#1b2833" metalness={0.55} roughness={0.45} />
        </mesh>
      </group>

      {/* ---------- Kontrollpunkt-Tore ---------- */}
      <group ref={toreRef}>
        {rennen.checkpoints.map((c, i) => (
          <group key={i} position={[c.x, c.y, c.z]} rotation={[0, gier(c.rx, c.rz), 0]}>
            {[-1, 1].map((seite) => (
              <mesh key={seite} position={[seite * (TOR_BREITE / 2 + 1), 2.4, 0]}>
                <boxGeometry args={[0.4, 4.8, 0.4]} />
                <meshStandardMaterial
                  color="#ffb300"
                  emissive="#ffb300"
                  emissiveIntensity={1}
                  toneMapped={false}
                />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}
