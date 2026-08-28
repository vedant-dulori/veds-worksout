import { createClient } from '@supabase/supabase-js'
import { createInterface } from 'node:readline/promises'
import { readFileSync } from 'node:fs'

function loadEnvLocal() {
  try {
    const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of text.split('\n')) {
      const match = line.match(/^([A-Z_]+)=(.*)$/)
      if (match) process.env[match[1]] ??= match[2]
    }
  } catch {}
}
loadEnvLocal()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Run this from the project root with .env.local present.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const rl = createInterface({ input: process.stdin, output: process.stdout })
const email = await rl.question('Email: ')
const password = await rl.question('Password: ')
rl.close()

const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
if (authError) {
  console.error('Sign-in failed:', authError.message)
  process.exit(1)
}
console.log(`Signed in as ${authData.user.email}\n`)

const { data, error } = await supabase
  .from('user_settings')
  .select('draft, updated_at')
  .maybeSingle()

if (error) {
  console.error('Failed to read draft:', error.message)
  process.exit(1)
}

if (!data || !data.draft || Object.keys(data.draft).length === 0) {
  console.log('No in-progress draft is stored (either nothing was saved, or it was already cleared).')
} else {
  console.log(`Last updated: ${data.updated_at}\n`)
  console.log('Session status:', data.draft.sessionStatus)
  console.log('Selected plan:', data.draft.selectedPlanId)
  console.log('Workout note:', data.draft.workoutNote || '(none)')
  const drafts = data.draft.drafts ?? {}
  const exerciseIds = Object.keys(drafts)
  console.log(`\nLogged sets for ${exerciseIds.length} exercise(s):`)
  for (const exerciseId of exerciseIds) {
    const entry = drafts[exerciseId]
    const completedCount = Array.isArray(entry?.sets) ? entry.sets.filter((s) => s?.completed).length : '?'
    const totalCount = Array.isArray(entry?.sets) ? entry.sets.length : '?'
    console.log(`  - ${exerciseId}: ${completedCount}/${totalCount} sets completed`, Array.isArray(entry?.sets) ? entry.sets : '(malformed)')
  }
}

await supabase.auth.signOut()
console.log('\nDone.')
