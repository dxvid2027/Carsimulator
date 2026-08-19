# Assets in diesem Ordner

## venice_sunset_1k.hdr

- Herkunft: https://github.com/pmndrs/drei-assets (Ordner `hdri`)
- Ursprung laut Attribution dort: HDRI Haven (heute Poly Haven)
- Lizenz: CC0 (gemeinfrei) – darf frei verwendet werden, auch kommerziell

Die Datei liegt bewusst im Repository und wird nicht zur Laufzeit von einem
fremden Server geladen. So funktioniert das Spiel auch offline und ist nicht
davon abhängig, dass eine fremde Adresse erreichbar bleibt.

## Kein Auto-Modell aus dem Netz

Für die Karosserie wird bewusst kein fertiges 3D-Modell geladen. Die gängigen
frei verfügbaren Auto-Modelle (z. B. das Ferrari-Modell aus den three.js-
Beispielen) bilden echte Markenfahrzeuge ab und stehen unter unklaren
Lizenzbedingungen. Das Auto in `src/game/vehicle/CarModel.tsx` ist deshalb
vollständig im Code aufgebaut.
