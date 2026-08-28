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
console.log(`Signed in as ${authData.user.email}`)

const { error } = await supabase
  .from('user_settings')
  .update({ draft: {} })
  .eq('user_id', authData.user.id)

if (error) {
  console.error('Failed to reset draft:', error.message)
  process.exit(1)
}
console.log('Cleared cached draft (in-progress session state). Your saved workout history and plans are untouched.')

await supabase.auth.signOut()
console.log('Done.')
