# Carsimulator

3D-Open-World-Fahrspiel im Browser (Prototyp im Stil von Forza Horizon).

**Stand: Phase 1 – fahrbares Auto auf flacher Ebene.**

## Schnellstart

```bash
npm install
npm run dev
```

Dann `http://localhost:5173` im Browser öffnen und ins Bild klicken, damit die
Tastatureingaben ankommen.

## Steuerung

| Taste | Funktion |
|---|---|
| `W` / `↑` | Gas |
| `S` / `↓` | Bremse, im Stand Rückwärtsgang |
| `A` `D` / `←` `→` | Lenken |
| `Leertaste` | Handbremse (Drift) |
| `C` | Kamera umschalten: Verfolger → Nah → Cockpit → Übersicht |
| `R` | Auto zurücksetzen |

Ein Gamepad wird automatisch erkannt: RT = Gas, LT = Bremse,
linker Stick = Lenken, A-Taste = Handbremse.

## Was dieser Prototyp kann

- **Raycast-Vehicle über Rapier** – kein Arcade-Würfel, sondern vier Räder mit
  echter Federung, Grip und Radlastverteilung.
- **Drift** – zu viel Gas löst das Heck, die Handbremse blockiert die Hinterräder.
- **Weiche Verfolgerkamera** mit Nachlauf und tempoabhängigem Sichtfeld.
- **HUD** mit Tacho, Gang, Drehzahlbalken und Drift-Anzeige.

## Ordnerstruktur

```
src/
  main.tsx                  Einstiegspunkt
  App.tsx                   Canvas + HUD
  styles.css                HUD-Styling
  game/
    Scene.tsx               Beleuchtung, Physikwelt, Zusammenbau
    telemetrie.ts           Anzeigewerte ohne React-Re-Render
    config/
      vehicleConfig.ts      ALLE Tuning-Werte des Autos
    input/
      useDrivingInput.ts    Tastatur + Gamepad
    vehicle/
      useRaycastVehicle.ts  Erzeugt Rapiers Fahrzeug-Controller
      fahrlogik.ts          Motor, Bremse, Lenkung, Drift, Aerodynamik
      Car.tsx               Physikkörper + sichtbare Räder
      CarModel.tsx          Provisorische Karosserie
    world/
      Ground.tsx            Flache Testebene
    camera/
      ChaseCamera.tsx       Verfolgerkamera
    ui/
      Hud.tsx               Tacho-Overlay
tools/
  fahrphysik-test.ts        Headless-Test der Fahrphysik
```

## Fahrphysik testen ohne zu fahren

```bash
npm run physik
```

Das startet die echte Rapier-Physik ohne Browser und misst Beschleunigung,
Topspeed, Bremsweg, Kurvenstabilität, Drift und die Symmetrie der Lenkung.
Es benutzt **dieselbe** `fahrlogik.ts` und `vehicleConfig.ts` wie das Spiel –
wenn du also einen Wert in `vehicleConfig.ts` änderst, siehst du die Auswirkung
sofort in Zahlen.

Aktuelle Messwerte:

| Messung | Wert |
|---|---|
| 0–100 km/h | 4,97 s |
| Topspeed | 192 km/h |
| Bremsweg 100–0 km/h | 17,9 m |
| Dauerkurve 80 km/h | stabil, kippt nicht |
| Handbremsen-Drift | bis 63°, fängt sich wieder |

## Nützliche Hinweise

- **Achsen:** `+Z` ist die Fahrtrichtung, `+Y` ist oben, `+X` ist links.
- **Debug-Ansicht:** `http://localhost:5173/?debug` zeigt die Kollisionskörper
  als Drahtgitter.
- **Telemetrie in der Konsole:** im Dev-Modus einfach `telemetrie` in die
  Browser-Konsole tippen.
- **Tuning:** Fast alles Fahrverhalten steckt in `src/game/config/vehicleConfig.ts`
  und ist dort kommentiert.

## Weitere Befehle

```bash
npm run build      # Produktions-Build
npm run preview    # Produktions-Build lokal ansehen
npm run typecheck  # TypeScript prüfen
```

## Nächste Schritte

- 1 × 1 km Terrain aus einer Heightmap
- Asphaltstraße als geschlossener Rundkurs
- Bäume und Leitplanken als Instanced Meshes
- HDRI-Environment, Cascaded Shadows, Postprocessing (Bloom, SSAO)
- Rundenzeit im HUD
- LOD und Frustum Culling
