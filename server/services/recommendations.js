function scoreRoom(room, preferences = {}) {
  let score = 0;
  const budget = Number(preferences.budget || Infinity);
  const category = (preferences.roomCategory || "").toLowerCase();
  const amenities = (preferences.amenities || []).map(x => x.toLowerCase());

  if (room.price <= budget) score += 40;
  else score -= Math.min(30, (room.price - budget) / 300);

  if (category && room.category.toLowerCase() === category) score += 30;
  for (const a of amenities) {
    if ((room.amenities || []).some(x => x.toLowerCase().includes(a))) score += 10;
  }
  score += Math.max(0, 20 - room.price / 1000);
  return score;
}

function recommendRooms(rooms, preferences) {
  return [...rooms]
    .map(room => ({ room, score: scoreRoom(room, preferences) }))
    .sort((a, b) => b.score - a.score)
    .map(x => ({ ...x.room.toObject ? x.room.toObject() : x.room, recommendationScore: Math.round(x.score) }));
}

module.exports = { recommendRooms };
