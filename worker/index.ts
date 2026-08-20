/**
 * Der Worker: Türsteher vor der ganzen Seite.
 *
 * Dieses Projekt läuft bei Cloudflare als **Worker mit statischen Dateien**,
 * nicht als Pages-Projekt. Der Unterschied ist wichtig: Ein Pages-Projekt
 * führt den Ordner `functions/` aus, ein Worker nicht – dort ist stattdessen
 * diese Datei der Einstiegspunkt.
 *
 * Damit wirklich JEDE Anfrage hier ankommt (und nicht nur die, für die es
 * keine Datei gibt), steht in `wrangler.jsonc` `run_worker_first: true`.
 * Ohne das würde Cloudflare die Spieldateien direkt ausliefern und die Sperre
 * einfach übergehen.
 */
import { anmeldeSeite, einrichtungsSeite } from '../zutritt/anmeldeseite';
import { passwortSchnittstelle } from '../zutritt/api';
import { passwortGesetzt, zutrittErlaubt, type Umgebung } from '../zutritt/gemeinsam';

/** Antwort mit HTML, die nirgends zwischengespeichert werden darf. */
function html(inhalt: string, status: number): Response {
  return new Response(inhalt, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      /*
        Ohne das könnte ein Zwischenspeicher die Anmeldeseite an jemanden
        ausliefern, der längst angemeldet ist – oder umgekehrt.
      */
      'Cache-Control': 'no-store',
    },
  });
}

export default {
  async fetch(request: Request, env: Umgebung): Promise<Response> {
    const pfad = new URL(request.url).pathname;

    /*
      Die Anmelde-Schnittstelle muss offen bleiben – sonst könnte sich nie
      jemand anmelden. Sie prüft das Passwort selbst.
    */
    if (pfad === '/api/passwort') {
      return passwortSchnittstelle(request, env.PASSWORT);
    }

    if (!env.PASSWORT) return html(einrichtungsSeite(), 503);

    // Das Symbol zeigt schon die Anmeldeseite, bevor jemand drin ist.
    if (pfad === '/icon.svg') return env.ASSETS.fetch(request);

    if (await zutrittErlaubt(request, env.PASSWORT)) {
      // Ticket gültig: die angeforderte Datei ganz normal ausliefern.
      return env.ASSETS.fetch(request);
    }

    return html(anmeldeSeite(await passwortGesetzt(env.PASSWORT)), 401);
  },
};
