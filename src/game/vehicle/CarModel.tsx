import { RoundedBox } from '@react-three/drei';
import { FAHRZEUG } from '../config/vehicleConfig';

/**
 * Karosserie aus einfachen Formen – bewusst ohne fertiges 3D-Modell.
 *
 * Warum kein Download-Modell? Die frei verfügbaren Auto-Modelle (etwa das
 * Ferrari-Modell aus den three.js-Beispielen) bilden echte Markenfahrzeuge ab
 * und stehen unter unklaren Lizenzbedingungen. Siehe public/ASSETS.md.
 *
 * Die Nase zeigt nach +Z – das ist die Fahrtrichtung.
 */

const LACK = '#c4102e';
const LACK_DUNKEL = '#8d0c21';
const GLAS = '#141c26';
const SCHWARZ = '#1a1c1f';

export function CarModel() {
  const { x: hx, z: hz } = FAHRZEUG.halbeGroesse;

  /*
    Alle Höhen sind relativ zur Fahrzeugmitte (y = 0) angegeben und so gewählt,
    dass sich die Teile überlappen. Bei zusammengesetzten Formen ist das
    entscheidend: schon 5 cm Abstand sehen aus wie ein schwebendes Dach.
  */
  const koerperMitte = -0.06;
  const koerperHoehe = 0.52;
  const koerperOben = koerperMitte + koerperHoehe / 2; // 0.20

  const kabineHoehe = 0.5;
  const kabineMitte = 0.32; // Unterkante 0.07 -> steckt 13 cm im Körper
  const kabineOben = kabineMitte + kabineHoehe / 2;
  const kabineZ = -hz * 0.08;
  const kabineLaenge = hz * 0.94;

  return (
    <group>
      {/* ---------- Grundkörper ---------- */}
      <RoundedBox
        args={[hx * 2, koerperHoehe, hz * 2]}
        radius={0.15}
        smoothness={3}
        position={[0, koerperMitte, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={LACK} metalness={0.6} roughness={0.26} />
      </RoundedBox>

      {/* ---------- Dach / Kabine ---------- */}
      <RoundedBox
        args={[hx * 1.58, kabineHoehe, kabineLaenge]}
        radius={0.14}
        smoothness={3}
        position={[0, kabineMitte, kabineZ]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={LACK_DUNKEL} metalness={0.55} roughness={0.3} />
      </RoundedBox>

      {/* Windschutzscheibe – sitzt vorn an der Kabine und taucht in sie ein */}
      <mesh
        position={[0, kabineMitte - 0.02, kabineZ + kabineLaenge / 2 - 0.05]}
        rotation={[-0.58, 0, 0]}
        castShadow
      >
        <boxGeometry args={[hx * 1.42, 0.5, 0.05]} />
        <meshStandardMaterial color={GLAS} metalness={0.25} roughness={0.05} />
      </mesh>

      {/* Heckscheibe */}
      <mesh
        position={[0, kabineMitte - 0.01, kabineZ - kabineLaenge / 2 + 0.05]}
        rotation={[0.62, 0, 0]}
        castShadow
      >
        <boxGeometry args={[hx * 1.4, 0.44, 0.05]} />
        <meshStandardMaterial color={GLAS} metalness={0.25} roughness={0.05} />
      </mesh>

      {/* Seitenscheiben */}
      {[-1, 1].map((seite) => (
        <mesh key={seite} position={[seite * hx * 0.8, kabineMitte + 0.05, kabineZ]}>
          <boxGeometry args={[0.03, 0.3, kabineLaenge * 0.78]} />
          <meshStandardMaterial color={GLAS} metalness={0.25} roughness={0.05} />
        </mesh>
      ))}

      {/* ---------- Radkästen ---------- */}
      {[
        [FAHRZEUG.rad.radstand, 1],
        [FAHRZEUG.rad.radstand, -1],
        [-FAHRZEUG.rad.radstand, 1],
        [-FAHRZEUG.rad.radstand, -1],
      ].map(([z, seite], i) => (
        <mesh key={i} position={[seite * hx * 0.97, koerperMitte - 0.08, z]} castShadow>
          <boxGeometry args={[0.12, 0.4, FAHRZEUG.rad.radius * 2.4]} />
          <meshStandardMaterial color={SCHWARZ} roughness={0.85} metalness={0.1} />
        </mesh>
      ))}

      {/* Seitenschweller */}
      {[-1, 1].map((seite) => (
        <mesh key={seite} position={[seite * hx * 0.95, koerperMitte - 0.19, 0]} castShadow>
          <boxGeometry args={[0.12, 0.16, hz * 1.1]} />
          <meshStandardMaterial color={SCHWARZ} roughness={0.8} />
        </mesh>
      ))}

      {/* ---------- Stoßfänger ---------- */}
      {[hz - 0.05, -hz + 0.05].map((z) => (
        <mesh key={z} position={[0, koerperMitte - 0.15, z]} castShadow>
          <boxGeometry args={[hx * 1.92, 0.24, 0.14]} />
          <meshStandardMaterial color={SCHWARZ} roughness={0.7} metalness={0.2} />
        </mesh>
      ))}

      {/* Kühlergrill */}
      <mesh position={[0, koerperMitte + 0.02, hz - 0.01]}>
        <boxGeometry args={[hx * 1.05, 0.19, 0.06]} />
        <meshStandardMaterial color="#0e1013" roughness={0.5} metalness={0.45} />
      </mesh>

      {/* ---------- Leuchten ---------- */}
      {[-0.55, 0.55].map((x) => (
        <mesh key={`h${x}`} position={[x, koerperMitte + 0.12, hz - 0.02]}>
          <boxGeometry args={[0.36, 0.12, 0.07]} />
          <meshStandardMaterial
            color="#fffbe8"
            emissive="#fff2c8"
            emissiveIntensity={2.4}
            toneMapped={false}
          />
        </mesh>
      ))}
      {[-0.57, 0.57].map((x) => (
        <mesh key={`r${x}`} position={[x, koerperMitte + 0.13, -hz + 0.02]}>
          <boxGeometry args={[0.34, 0.11, 0.07]} />
          <meshStandardMaterial
            color="#ff3311"
            emissive="#ff2200"
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* ---------- Heckflügel ---------- */}
      {/* Streben stehen auf dem Kofferraumdeckel (koerperOben), der Flügel darüber */}
      {[-0.5, 0.5].map((x) => (
        <mesh key={`s${x}`} position={[x, koerperOben + 0.06, -hz + 0.28]} castShadow>
          <boxGeometry args={[0.05, 0.16, 0.09]} />
          <meshStandardMaterial color={SCHWARZ} metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, koerperOben + 0.14, -hz + 0.28]} castShadow>
        <boxGeometry args={[hx * 1.5, 0.05, 0.3]} />
        <meshStandardMaterial color={SCHWARZ} metalness={0.6} roughness={0.35} />
      </mesh>

      {/* Außenspiegel – sitzen an der Kabinenvorderkante */}
      {[-1, 1].map((seite) => (
        <mesh
          key={seite}
          position={[seite * (hx + 0.07), kabineOben - 0.16, kabineZ + kabineLaenge / 2]}
          castShadow
        >
          <boxGeometry args={[0.15, 0.08, 0.1]} />
          <meshStandardMaterial color={LACK_DUNKEL} metalness={0.55} roughness={0.3} />
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
      {/* Reifen */}
      <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[radius, radius, breite, 24]} />
        <meshStandardMaterial color="#131315" roughness={0.92} metalness={0.03} />
      </mesh>

      {/* Felge auf beiden Seiten */}
      {[breite * 0.51, -breite * 0.51].map((x) => (
        <mesh key={x} rotation={[0, 0, Math.PI / 2]} position={[x, 0, 0]}>
          <cylinderGeometry args={[radius * 0.62, radius * 0.62, 0.03, 20]} />
          <meshStandardMaterial color="#b9bfc6" metalness={0.92} roughness={0.22} />
        </mesh>
      ))}

      {/* Speichen – machen die Raddrehung sichtbar */}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh
          key={i}
          position={[breite * 0.53, 0, 0]}
          rotation={[(i * Math.PI) / 5, 0, Math.PI / 2]}
        >
          <boxGeometry args={[0.03, 0.05, radius * 1.15]} />
          <meshStandardMaterial color="#8e959d" metalness={0.85} roughness={0.3} />
        </mesh>
      ))}

      {/* Bremsscheibe */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[radius * 0.44, radius * 0.44, breite * 0.72, 16]} />
        <meshStandardMaterial color="#4a4d52" metalness={0.7} roughness={0.45} />
      </mesh>
    </group>
  );
}
