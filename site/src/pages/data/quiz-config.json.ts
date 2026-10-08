import type { APIRoute } from 'astro';
import { loadGroups, loadRawVocab } from '../../lib/data';
import { makeQuizConfig } from '../../lib/quiz-config';

// The vocabulary the match quiz needs, as a small file the quiz downloads when it opens. Written
// at build time from the same vocab.json the rest of the site uses.
export const GET: APIRoute = () => {
  const config = makeQuizConfig(loadRawVocab(), loadGroups().built);
  return new Response(JSON.stringify(config), { headers: { 'Content-Type': 'application/json' } });
};
