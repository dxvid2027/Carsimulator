import { FAHRZEUG } from '../config/vehicleConfig';

/**
 * Provisorische Karosserie aus einfachen Formen.
 * Wird später durch ein richtiges 3D-Modell (glTF) ersetzt.
 * Die Nase zeigt nach +Z – das ist die Fahrtrichtung.
 */
export function CarModel() {
  const { x: hx, y: hy, z: hz } = FAHRZEUG.halbeGroesse;

  return (
    <group>
      {/* Hauptkörper */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[hx * 2, hy * 2, hz * 2]} />
        <meshStandardMaterial color="#c8102e" metalness={0.6} roughness={0.35} />
      </mesh>

      {/* Dach / Kabine, leicht nach hinten versetzt */}
      <mesh castShadow position={[0, hy + 0.24, -0.25]}>
        <boxGeometry args={[hx * 1.7, 0.48, hz * 0.95]} />
        <meshStandardMaterial color="#8f0c22" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Windschutzscheibe */}
      <mesh position={[0, hy + 0.26, hz * 0.46]} rotation={[-0.45, 0, 0]}>
        <boxGeometry args={[hx * 1.62, 0.44, 0.06]} />
        <meshStandardMaterial color="#0d1b2a" metalness={0.9} roughness={0.08} />
      </mesh>

      {/* Heckscheibe */}
      <mesh position={[0, hy + 0.26, -hz * 0.72]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[hx * 1.6, 0.4, 0.06]} />
        <meshStandardMaterial color="#0d1b2a" metalness={0.9} roughness={0.08} />
      </mesh>

      {/* Scheinwerfer (vorne, also +Z) */}
      {[-0.52, 0.52].map((x) => (
        <mesh key={x} position={[x, 0.02, hz - 0.02]}>
          <boxGeometry args={[0.34, 0.16, 0.08]} />
          <meshStandardMaterial color="#fff6d5" emissive="#fff0c0" emissiveIntensity={1.6} />
        </mesh>
      ))}

      {/* Rücklichter (hinten, also -Z) */}
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.05, -hz + 0.02]}>
          <boxGeometry args={[0.3, 0.14, 0.08]} />
          <meshStandardMaterial color="#5a0000" emissive="#ff2200" emissiveIntensity={1.1} />
        </mesh>
      ))}
    </group>
  );
}

/** Ein einzelnes Rad. Der Zylinder wird um Z gedreht, damit seine Achse auf X liegt. */
export function WheelModel() {
  const { radius, breite } = FAHRZEUG.rad;
  return (
    <group>
      <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[radius, radius, breite, 20]} />
        <meshStandardMaterial color="#141414" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Felge, damit man die Raddrehung sieht */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[breite * 0.5, 0, 0]}>
        <cylinderGeometry args={[radius * 0.6, radius * 0.6, 0.03, 16]} />
        <meshStandardMaterial color="#c9ccd1" metalness={0.9} roughness={0.25} />
      </mesh>
      {/* Speiche als Drehmarkierung */}
      <mesh position={[breite * 0.52, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.04, 0.02, radius * 1.1]} />
        <meshStandardMaterial color="#2b2f36" metalness={0.7} roughness={0.4} />
      </mesh>
    </group>
  );
}
