import { RoundedBox } from '@react-three/drei';
import { FAHRZEUG } from '../config/vehicleConfig';

/**
 * Die Karosserie: eine kantige Limousine, höhergelegt, auf Grobstollenreifen.
 *
 * Bewusst ohne fertiges 3D-Modell aus dem Netz – die verbreiteten freien
 * Auto-Modelle bilden echte Markenfahrzeuge unter unklaren Lizenzbedingungen
 * ab. Siehe public/ASSETS.md.
 *
 * Alle Höhen sind relativ zur Fahrzeugmitte (y = 0) angegeben und so gewählt,
 * dass sich die Teile überlappen. Bei zusammengesetzten Formen ist das
 * entscheidend: schon fünf Zentimeter Abstand sehen aus wie ein schwebendes Dach.
 *
 * Die Nase zeigt nach +Z – das ist die Fahrtrichtung.
 */

const LACK = '#5f6b4a';        // Olivgrün
const LACK_DUNKEL = '#4a5439';
const GLAS = '#1b2a2e';
const SCHWARZ = '#16181a';
const GUMMI = '#111214';
const CHROM = '#b9bcc0';
const FELGE = '#26292d';

export function CarModel() {
  const { x: hx, y: hy, z: hz } = FAHRZEUG.halbeGroesse;
  const { radstand, radius } = FAHRZEUG.rad;

  // ----- Aufbau in der Höhe -----
  const unterkante = -hy;              // -0.40
  const guertellinie = hy * 0.42;      //  0.17  Oberkante der unteren Karosserie
  const dachHoehe = 0.46;
  const dachMitte = guertellinie + dachHoehe / 2 - 0.05; // steckt in der Karosserie
  const dachOben = dachMitte + dachHoehe / 2;

  // ----- Aufbau in der Länge -----
  const kabineZ = -hz * 0.14;
  const kabineLaenge = hz * 0.86;

  return (
    <group>
      {/* ---------- Untere Karosserie ---------- */}
      <RoundedBox
        args={[hx * 2, hy * 1.42, hz * 2]}
        radius={0.07}
        smoothness={2}
        position={[0, -hy * 0.29, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={LACK} metalness={0.45} roughness={0.42} />
      </RoundedBox>

      {/* Motorhaube – lang und flach, typisch für diese Limousinen */}
      <RoundedBox
        args={[hx * 1.94, 0.12, hz * 0.78]}
        radius={0.04}
        smoothness={2}
        position={[0, guertellinie - 0.02, hz * 0.58]}
        castShadow
      >
        <meshStandardMaterial color={LACK} metalness={0.45} roughness={0.4} />
      </RoundedBox>

      {/* Kofferraumdeckel */}
      <RoundedBox
        args={[hx * 1.94, 0.12, hz * 0.44]}
        radius={0.04}
        smoothness={2}
        position={[0, guertellinie - 0.02, -hz * 0.74]}
        castShadow
      >
        <meshStandardMaterial color={LACK} metalness={0.45} roughness={0.4} />
      </RoundedBox>

      {/* ---------- Dachaufbau ---------- */}
      <RoundedBox
        args={[hx * 1.72, dachHoehe, kabineLaenge]}
        radius={0.06}
        smoothness={2}
        position={[0, dachMitte, kabineZ]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={LACK} metalness={0.45} roughness={0.42} />
      </RoundedBox>

      {/* Fensterband – ein durchgehender dunkler Ring wirkt wie Verglasung */}
      {[-1, 1].map((seite) => (
        <mesh key={seite} position={[seite * hx * 0.87, dachMitte + 0.03, kabineZ]}>
          <boxGeometry args={[0.03, dachHoehe * 0.6, kabineLaenge * 0.9]} />
          <meshStandardMaterial color={GLAS} metalness={0.3} roughness={0.06} />
        </mesh>
      ))}
      {/* Windschutzscheibe, leicht geneigt */}
      <mesh
        position={[0, dachMitte + 0.02, kabineZ + kabineLaenge / 2 - 0.02]}
        rotation={[-0.32, 0, 0]}
        castShadow
      >
        <boxGeometry args={[hx * 1.6, dachHoehe * 0.82, 0.05]} />
        <meshStandardMaterial color={GLAS} metalness={0.3} roughness={0.05} />
      </mesh>
      {/* Heckscheibe */}
      <mesh
        position={[0, dachMitte + 0.02, kabineZ - kabineLaenge / 2 + 0.02]}
        rotation={[0.34, 0, 0]}
        castShadow
      >
        <boxGeometry args={[hx * 1.58, dachHoehe * 0.78, 0.05]} />
        <meshStandardMaterial color={GLAS} metalness={0.3} roughness={0.05} />
      </mesh>

      {/* ---------- Dachträger mit Reserverad ---------- */}
      <group position={[0, dachOben, kabineZ + 0.1]}>
        {/* Grundrahmen */}
        <mesh position={[0, 0.06, 0]} castShadow>
          <boxGeometry args={[hx * 1.5, 0.05, kabineLaenge * 0.78]} />
          <meshStandardMaterial color={SCHWARZ} metalness={0.5} roughness={0.55} />
        </mesh>
        {/* Umlaufende Reling */}
        {[-1, 1].map((seite) => (
          <mesh key={seite} position={[seite * hx * 0.74, 0.14, 0]} castShadow>
            <boxGeometry args={[0.05, 0.14, kabineLaenge * 0.78]} />
            <meshStandardMaterial color={SCHWARZ} metalness={0.5} roughness={0.55} />
          </mesh>
        ))}
        {/*
          Reserverad liegt flach auf dem Träger.
          Die Zylinderachse zeigt nach oben (keine Drehung nötig) – mit einer
          Drehung um X stünde das Rad hochkant und sähe von hinten aus wie
          eine schwarze Kuppel.
        */}
        <mesh position={[0, 0.21, -0.12]} castShadow>
          <cylinderGeometry args={[radius * 0.9, radius * 0.9, 0.22, 20]} />
          <meshStandardMaterial color={GUMMI} roughness={0.95} metalness={0.02} />
        </mesh>
        <mesh position={[0, 0.33, -0.12]}>
          <cylinderGeometry args={[radius * 0.48, radius * 0.48, 0.03, 16]} />
          <meshStandardMaterial color={FELGE} metalness={0.6} roughness={0.5} />
        </mesh>
      </group>

      {/* ---------- Verbreiterte Radläufe ---------- */}
      {[
        [radstand, 1],
        [radstand, -1],
        [-radstand, 1],
        [-radstand, -1],
      ].map(([z, seite], i) => (
        <group key={i}>
          {/* Kotflügelverbreiterung: steht seitlich über */}
          <mesh position={[seite * (hx + 0.04), unterkante + 0.3, z]} castShadow>
            <boxGeometry args={[0.14, 0.34, radius * 2.5]} />
            <meshStandardMaterial color={SCHWARZ} roughness={0.9} metalness={0.05} />
          </mesh>
          {/* Radhaus dunkel, damit hinter dem Rad kein Lack durchscheint */}
          <mesh position={[seite * hx * 0.9, unterkante + 0.28, z]}>
            <boxGeometry args={[0.18, 0.4, radius * 2.2]} />
            <meshStandardMaterial color="#0a0b0c" roughness={1} />
          </mesh>
        </group>
      ))}

      {/* Seitenschweller */}
      {[-1, 1].map((seite) => (
        <mesh key={seite} position={[seite * (hx - 0.02), unterkante + 0.13, 0]} castShadow>
          <boxGeometry args={[0.14, 0.2, hz * 1.05]} />
          <meshStandardMaterial color={SCHWARZ} roughness={0.85} />
        </mesh>
      ))}

      {/* ---------- Front ---------- */}
      {/* Kühlergrill mit Chromrahmen */}
      <mesh position={[0, guertellinie - 0.19, hz - 0.02]} castShadow>
        <boxGeometry args={[hx * 0.92, 0.3, 0.08]} />
        <meshStandardMaterial color={CHROM} metalness={0.95} roughness={0.18} />
      </mesh>
      <mesh position={[0, guertellinie - 0.19, hz + 0.02]}>
        <boxGeometry args={[hx * 0.82, 0.24, 0.04]} />
        <meshStandardMaterial color="#0d0f11" metalness={0.5} roughness={0.45} />
      </mesh>

      {/* Doppelscheinwerfer je Seite */}
      {[-1, 1].map((seite) =>
        [0.34, 0.62].map((abstand, k) => (
          <mesh
            key={`${seite}-${k}`}
            position={[seite * hx * abstand + seite * 0.28, guertellinie - 0.17, hz]}
          >
            <boxGeometry args={[0.24, 0.17, 0.06]} />
            <meshStandardMaterial
              color="#fff7e2"
              emissive="#ffeec4"
              emissiveIntensity={k === 0 ? 2.4 : 1.2}
              toneMapped={false}
            />
          </mesh>
        )),
      )}

      {/* Robuster Frontstoßfänger */}
      <mesh position={[0, unterkante + 0.24, hz + 0.04]} castShadow>
        <boxGeometry args={[hx * 2.02, 0.22, 0.16]} />
        <meshStandardMaterial color={SCHWARZ} metalness={0.35} roughness={0.6} />
      </mesh>
      {/* Unterfahrschutz */}
      <mesh position={[0, unterkante + 0.02, hz * 0.86]} castShadow>
        <boxGeometry args={[hx * 1.5, 0.08, 0.5]} />
        <meshStandardMaterial color="#3d4045" metalness={0.7} roughness={0.45} />
      </mesh>

      {/* ---------- Heck ---------- */}
      {[-1, 1].map((seite) => (
        <mesh key={seite} position={[seite * hx * 0.62, guertellinie - 0.16, -hz - 0.01]}>
          <boxGeometry args={[hx * 0.66, 0.18, 0.06]} />
          <meshStandardMaterial
            color="#c8331b"
            emissive="#ff2a00"
            emissiveIntensity={1.9}
            toneMapped={false}
          />
        </mesh>
      ))}
      <mesh position={[0, unterkante + 0.24, -hz - 0.04]} castShadow>
        <boxGeometry args={[hx * 2.02, 0.22, 0.16]} />
        <meshStandardMaterial color={SCHWARZ} metalness={0.35} roughness={0.6} />
      </mesh>

      {/* Außenspiegel */}
      {[-1, 1].map((seite) => (
        <mesh
          key={seite}
          position={[seite * (hx + 0.1), dachMitte - 0.14, kabineZ + kabineLaenge / 2 - 0.06]}
          castShadow
        >
          <boxGeometry args={[0.18, 0.1, 0.09]} />
          <meshStandardMaterial color={LACK_DUNKEL} metalness={0.45} roughness={0.4} />
        </mesh>
      ))}

      {/* Dachscheinwerfer – passt zum Geländeaufbau */}
      <group position={[0, dachOben + 0.2, kabineZ + kabineLaenge / 2 - 0.05]}>
        {[-0.45, 0.45].map((x) => (
          <mesh key={x} position={[x, 0, 0]}>
            <boxGeometry args={[0.28, 0.16, 0.1]} />
            <meshStandardMaterial
              color="#fff9e8"
              emissive="#fff2cc"
              emissiveIntensity={2.6}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Ein einzelnes Rad: Grobstollenreifen auf schwarzer Stahlfelge. */
export function WheelModel() {
  const { radius, breite } = FAHRZEUG.rad;
  return (
    <group>
      {/* Reifen */}
      <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[radius, radius, breite, 24]} />
        <meshStandardMaterial color={GUMMI} roughness={0.96} metalness={0.02} />
      </mesh>

      {/* Grobe Stollen: ein paar Klötze rundum machen die Drehung sichtbar */}
      {Array.from({ length: 8 }, (_, i) => {
        const winkel = (i / 8) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[0, Math.cos(winkel) * radius * 0.99, Math.sin(winkel) * radius * 0.99]}
            rotation={[-winkel, 0, 0]}
          >
            <boxGeometry args={[breite * 0.9, 0.05, 0.13]} />
            <meshStandardMaterial color="#1c1e21" roughness={0.95} />
          </mesh>
        );
      })}

      {/* Stahlfelge auf beiden Seiten */}
      {[breite * 0.5, -breite * 0.5].map((x) => (
        <mesh key={x} rotation={[0, 0, Math.PI / 2]} position={[x, 0, 0]}>
          <cylinderGeometry args={[radius * 0.62, radius * 0.62, 0.04, 18]} />
          <meshStandardMaterial color={FELGE} metalness={0.55} roughness={0.55} />
        </mesh>
      ))}

      {/* Radschrauben – kleine Markierung, an der man die Drehung sieht */}
      {Array.from({ length: 5 }, (_, i) => {
        const winkel = (i / 5) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[
              breite * 0.53,
              Math.cos(winkel) * radius * 0.3,
              Math.sin(winkel) * radius * 0.3,
            ]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.035, 0.035, 0.03, 6]} />
            <meshStandardMaterial color={CHROM} metalness={0.9} roughness={0.3} />
          </mesh>
        );
      })}
    </group>
  );
}
