/**
 * Die Anmelde-Schnittstelle unter /api/passwort.
 *
 * GET  liefert nur, OB schon ein Passwort gesetzt ist – nie das Passwort
 *      selbst und auch nicht seinen Hash.
 * POST setzt das Passwort (wenn noch keines existiert) oder prüft es.
 */
import {
  MIN_LAENGE,
  cookieKopf,
  passwortGesetzt,
  passwortSetzen,
  passwortStimmt,
  ticketErzeugen,
  type KvSpeicher,
} from './gemeinsam';

function json(daten: unknown, status = 200, cookie?: string): Response {
  const kopf: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };
  if (cookie) kopf['Set-Cookie'] = cookie;
  return new Response(JSON.stringify(daten), { status, headers: kopf });
}

/** Beantwortet eine Anfrage an /api/passwort. */
export async function passwortSchnittstelle(
  request: Request,
  kv: KvSpeicher | undefined,
): Promise<Response> {
  if (!kv) return json({ ok: false, meldung: 'Storage not configured.' }, 503);

  if (request.method === 'GET') return json({ gesetzt: await passwortGesetzt(kv) });
  if (request.method !== 'POST') return json({ ok: false, meldung: 'Method not allowed.' }, 405);

  let passwort = '';
  try {
    const koerper = (await request.json()) as { passwort?: unknown };
    if (typeof koerper.passwort === 'string') passwort = koerper.passwort;
  } catch {
    return json({ ok: false, meldung: 'Bad request.' }, 400);
  }

  if (passwort.length < MIN_LAENGE) {
    return json({ ok: false, meldung: `Please use at least ${MIN_LAENGE} characters.` }, 400);
  }
  // Obergrenze, damit niemand die Function mit einem riesigen Text beschäftigt
  if (passwort.length > 200) {
    return json({ ok: false, meldung: 'Password too long.' }, 400);
  }

  /*
    Der erste Besucher legt das Passwort fest.

    `passwortSetzen` schreibt nur, wenn noch keines existiert – die Prüfung
    steckt dort drin und nicht hier, damit sie nicht versehentlich übersprungen
    werden kann.
  */
  if (!(await passwortGesetzt(kv))) {
    const gesetzt = await passwortSetzen(kv, passwort);
    if (gesetzt) return json({ ok: true }, 200, cookieKopf(await ticketErzeugen(kv)));
    // Jemand war in derselben Sekunde schneller – dann normal weiterprüfen.
  }

  if (await passwortStimmt(kv, passwort)) {
    return json({ ok: true }, 200, cookieKopf(await ticketErzeugen(kv)));
  }

  /*
    Kurze Wartezeit nach einem Fehlversuch.

    Sie kostet einen echten Nutzer nichts, macht aber das Durchprobieren
    tausender Passwörter deutlich langsamer.
  */
  await new Promise((f) => setTimeout(f, 400));
  return json({ ok: false, meldung: 'Wrong password.' }, 401);
}
