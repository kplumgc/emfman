// POST /api/submit-score { player_name, score, level, token } -> { id, top10 }
const { configured, sb, topScores, verify, cleanName, isProfane, json, readBody, MIN_GAME_MS } = require('./_lib/emfman');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!configured()) return json(res, 503, { error: 'Leaderboard is not set up yet' });
  const { player_name, score, level, token } = readBody(req);

  const ticket = verify(token);
  if (!ticket || !UUID.test(String(ticket.id))) return json(res, 400, { error: 'This game can\'t be submitted. Please play again.' });
  if (!Number.isInteger(score) || score < 0 || score > 9999999) return json(res, 400, { error: 'Invalid score' });
  if (!Number.isInteger(level) || level < 1 || level > 999) return json(res, 400, { error: 'Invalid level' });
  const name = cleanName(player_name);
  if (!name) return json(res, 400, { error: 'Names need 1 to 20 letters, numbers or spaces', field: 'name' });
  if (isProfane(name)) return json(res, 400, { error: 'Please choose a different name', field: 'name' });

  try {
    const rows = await sb(`emfman_game_tokens?select=started_at,used&token_id=eq.${ticket.id}`);
    const row = rows && rows[0];
    if (!row) return json(res, 400, { error: 'This game can\'t be submitted. Please play again.' });
    if (row.used) return json(res, 409, { error: 'This score has already been saved' });
    if (Date.now() - Date.parse(row.started_at) < MIN_GAME_MS) return json(res, 400, { error: 'That game was too short to count' });

    // claim the ticket atomically: only one request can flip used false -> true
    const claimed = await sb(`emfman_game_tokens?token_id=eq.${ticket.id}&used=eq.false`, {
      method: 'PATCH', body: { used: true }, prefer: 'return=representation',
    });
    if (!claimed || !claimed.length) return json(res, 409, { error: 'This score has already been saved' });

    const [saved] = await sb('emfman_scores', {
      method: 'POST', body: { player_name: name, score, level }, prefer: 'return=representation',
    });
    return json(res, 200, { id: saved.id, top10: await topScores() });
  } catch (e) {
    console.error(e);
    return json(res, 503, { error: 'Leaderboard is offline' });
  }
};
