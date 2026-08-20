/**
 * Türsteher für die ganze Seite.
 *
 * Cloudflare Pages ruft diese Datei bei JEDER Anfrage auf – auch für die
 * JavaScript-Dateien und Bilder des Spiels. Das ist der Punkt: Wer kein
 * gültiges Ticket hat, bekommt nichts vom Spiel zu sehen, nicht einmal die
 * heruntergeladenen Dateien.
 */
import { einrichtungsSeite, anmeldeSeite } from '../zutritt/anmeldeseite';
import { passwortGesetzt, zutrittErlaubt, type Umgebung } from '../zutritt/gemeinsam';

interface Kontext {
  request: Request;
  env: Umgebung;
  next: () => Promise<Response>;
}

/** Antwort mit HTML, die nirgends zwischengespeichert werden darf. */
function html(inhalt: string, status: number): Response {
  return new Response(inhalt, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Ohne das könnte ein Zwischenspeicher die Anmeldeseite an jemanden
      // ausliefern, der eigentlich schon angemeldet ist – oder umgekehrt.
      'Cache-Control': 'no-store',
    },
  });
}

export async function onRequest(kontext: Kontext): Promise<Response> {
  const { request, env, next } = kontext;
  const pfad = new URL(request.url).pathname;

  /*
    Die Schnittstelle zum Anmelden muss offen bleiben – sonst könnte man sich
    nie anmelden. Sie prüft das Passwort selbst.
  */
  if (pfad.startsWith('/api/')) return next();

  // Das Symbol braucht die Anmeldeseite selbst, bevor jemand drin ist.
  if (pfad === '/icon.svg') return next();

  const kv = env.PASSWORT;
  if (!kv) return html(einrichtungsSeite(), 503);

  if (await zutrittErlaubt(request, kv)) return next();

  return html(anmeldeSeite(await passwortGesetzt(kv)), 401);
}
