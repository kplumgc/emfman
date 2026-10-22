// GET /api/leaderboard -> top 10 [{ id, player_name, score, level, created_at }]
const { configured, topScores, json } = require('./_lib/emfman');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  if (!configured()) return json(res, 503, { error: 'Leaderboard is not set up yet' });
  try {
    return json(res, 200, await topScores());
  } catch (e) {
    console.error(e);
    return json(res, 503, { error: 'Leaderboard is offline' });
  }
};
