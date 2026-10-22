// POST /api/start-game -> { token }: a signed, single-use ticket for submitting this game's score.
const crypto = require('crypto');
const { configured, sb, sign, json } = require('./_lib/emfman');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!configured()) return json(res, 503, { error: 'Leaderboard is not set up yet' });
  try {
    const id = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    await sb('emfman_game_tokens', { method: 'POST', body: { token_id: id, started_at: startedAt, used: false } });
    // keep the token table small: drop tickets older than a week (ignore failures)
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    sb(`emfman_game_tokens?started_at=lt.${encodeURIComponent(weekAgo)}`, { method: 'DELETE' }).catch(() => {});
    return json(res, 200, { token: sign({ id, t: Date.parse(startedAt) }) });
  } catch (e) {
    console.error(e);
    return json(res, 503, { error: 'Leaderboard is offline' });
  }
};
