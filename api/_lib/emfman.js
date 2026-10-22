// Shared helpers for the EMF Man leaderboard functions (the _ prefix keeps this out of the routes).
const crypto = require('crypto');

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TOKEN_SECRET = process.env.EMFMAN_TOKEN_SECRET || '';

const MIN_GAME_MS = 10 * 1000;
const TOP_N = 10;

function configured() { return !!(SUPABASE_URL && SUPABASE_KEY && TOKEN_SECRET); }

// Supabase REST (PostgREST) call with the server key. Legacy service_role keys are JWTs and also go
// in Authorization; new sb_secret_ keys only go in apikey.
async function sb(path, { method = 'GET', body, prefer } = {}) {
  const headers = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
  if (SUPABASE_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`supabase ${method} ${path.split('?')[0]} ${r.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

function topScores() {
  return sb(`emfman_scores?select=id,player_name,score,level,created_at&order=score.desc,created_at.asc&limit=${TOP_N}`);
}

// ---------- signed game tokens ----------
const b64url = buf => Buffer.from(buf).toString('base64url');
const hmac = data => crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest();

function sign(payload) {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${b64url(hmac(body))}`;
}

// Returns the payload if the signature is valid, otherwise null.
function verify(token) {
  if (typeof token !== 'string' || token.length > 512) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const want = hmac(body), got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch (e) { return null; }
}

// ---------- names ----------
function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > 20) return null;
  if (!/^[\p{L}\p{M}0-9 '.\-]+$/u.test(name)) return null;
  return name;
}

// Matched anywhere in the name, even inside other words or with spaces between letters.
const BLOCK_ANYWHERE = [
  'fuck', 'fuk', 'fck', 'shit', 'cunt', 'nigger', 'nigga', 'faggot', 'whore', 'wank', 'bitch',
  'slut', 'porn', 'twat', 'bollock', 'motherf', 'dildo', 'jizz', 'hitler', 'retard', 'kike', 'spastic',
];
// Only matched as a whole word, so ordinary names like Cassandra, Dickson or Hancock still work.
const BLOCK_WORD = [
  'ass', 'arse', 'asshole', 'arsehole', 'dick', 'cock', 'prick', 'tit', 'tits', 'cum', 'fag', 'rape',
  'rapist', 'nazi', 'sex', 'anal', 'anus', 'piss', 'penis', 'vagina', 'boob', 'boobs', 'crap', 'poo',
  'poop', 'turd', 'homo', 'coon', 'paki', 'chink', 'spic', 'wog', 'dyke', 'tranny', 'kkk',
];
const BLOCK_WORD_SET = new Set(BLOCK_WORD);

// Undo common letter/number swaps. '1' and '|' could be i or l, so both readings are checked.
function deSwap(s, one) {
  return s.toLowerCase()
    .replace(/[4@]/g, 'a').replace(/3/g, 'e').replace(/[1!|]/g, one).replace(/0/g, 'o')
    .replace(/[5$]/g, 's').replace(/7/g, 't').replace(/8/g, 'b').replace(/9/g, 'g')
    .normalize('NFD').replace(/\p{M}/gu, '');
}
// Spellings to test: as typed, runs of 3+ cut to 2 ("asss" -> "ass"), runs cut to 1 ("fuuuck" -> "fuck").
const forms = w => [w, w.replace(/(.)\1{2,}/g, '$1$1'), w.replace(/(.)\1+/g, '$1')];

function isProfane(name) {
  for (const one of ['i', 'l']) {
    const s = deSwap(name, one);
    const joined = s.replace(/[^a-z]/g, '');
    if (forms(joined).some(f => BLOCK_ANYWHERE.some(b => f.includes(b)))) return true;
    for (const word of s.split(/[^a-z]+/)) {
      if (word && forms(word).some(f => BLOCK_WORD_SET.has(f))) return true;
    }
  }
  return false;
}

// ---------- http ----------
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return {};
}

module.exports = { configured, sb, topScores, sign, verify, cleanName, isProfane, json, readBody, MIN_GAME_MS };
