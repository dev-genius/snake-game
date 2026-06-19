import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function submitScore(nickname: string, score: number) {
  const { error } = await supabase.from('scores').insert({ nickname, score })
  if (error) console.error(error)
}

export async function getTopScores() {
  const { data } = await supabase
    .from('scores')
    .select('nickname, score, created_at')
    .order('score', { ascending: false })
    .limit(10)
  return data ?? []
}
