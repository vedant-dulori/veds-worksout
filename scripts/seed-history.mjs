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

function log(exerciseId, sets) {
  return {
    exerciseId,
    completed: true,
    sets: sets.map(([weight, reps]) => ({ weight, reps, completed: true })),
  }
}

const seedWorkouts = [
  {
    id: 'seed-squat-day-w1',
    planId: 'squat-day',
    date: '2026-08-11',
    note: 'Seeded from prior training log (week 1).',
    logs: [
      log('barbell-squat', [[85, 10], [105, 10], [115, 10], [125, 8]]),
      log('bench-press', [[95, 10], [105, 10], [115, 10], [120, 10]]),
      log('pull-ups', [[0, 11], [0, 10], [0, 11], [0, 11]]),
      log('stationary-lunges', [[22.5, 10], [25, 10]]),
      log('push-ups', [[0, 20], [0, 20], [0, 20]]),
      log('bent-over-row', [[25, 10], [25, 10], [25, 10]]),
      log('side-plank', [[0, 35], [0, 35]]),
      log('farmer-carry', [[35.2, 2], [35.2, 2]]),
      log('incline-curls', [[20, 10], [20, 10]]),
      log('hanging-knee-raises', [[0, 10], [0, 10]]),
    ],
  },
  {
    id: 'seed-squat-day-w2',
    planId: 'squat-day',
    date: '2026-08-18',
    note: 'Seeded from prior training log (week 2).',
    logs: [
      log('barbell-squat', [[95, 10], [105, 10], [125, 10], [130, 8]]),
      log('bench-press', [[95, 10], [105, 10], [115, 10], [125, 8]]),
      log('pull-ups', [[0, 12], [0, 11], [0, 11], [0, 10]]),
      log('stationary-lunges', [[25, 10], [25, 10]]),
      log('push-ups', [[0, 20], [0, 20], [0, 20]]),
      log('bent-over-row', [[30, 10], [30, 10], [30, 10]]),
      log('side-plank', [[0, 43], [0, 43]]),
      log('farmer-carry', [[35.2, 2], [35.2, 2]]),
      log('incline-curls', [[22.5, 10], [22.5, 10]]),
      log('hanging-knee-raises', [[0, 11], [0, 11]]),
    ],
  },
  {
    id: 'seed-squat-day',
    planId: 'squat-day',
    date: '2026-08-28',
    note: 'Seeded from prior training log.',
    logs: [
      log('barbell-squat', [[95, 10], [105, 10], [125, 10], [130, 10]]),
      log('bench-press', [[95, 10], [105, 10], [115, 10], [125, 10]]),
      log('pull-ups', [[0, 12], [0, 11], [0, 11], [0, 10]]),
      log('stationary-lunges', [[25, 10]]),
      log('push-ups', [[0, 25], [0, 25], [0, 25]]),
      log('bent-over-row', [[25, 10], [30, 10], [30, 10]]),
      log('side-plank', [[0, 45], [0, 45]]),
      log('farmer-carry', [[35.2, 2], [35.2, 2]]),
      log('incline-curls', [[22.5, 10], [22.5, 10]]),
      log('hanging-knee-raises', [[0, 12], [0, 12]]),
    ],
  },
  {
    id: 'seed-full-body-b-w1',
    planId: 'full-body-b',
    date: '2026-08-13',
    note: 'Seeded from prior training log (week 1).',
    logs: [
      log('trap-bar-deadlift', [[115, 6], [130, 6], [140, 6], [140, 8]]),
      log('ohp-barbell', [[55, 8], [60, 8], [65, 8]]),
      log('chin-ups', [[0, 11], [0, 11], [0, 11], [0, 11]]),
      log('rkc-plank', [[0, 35], [0, 35]]),
      log('box-jumps', [[0, 8], [0, 8]]),
      log('kb-overhead-press', [[18, 10], [18, 10]]),
      log('seated-row', [[75, 12], [75, 12]]),
      log('ab-curl-ups', [[0, 20], [0, 20]]),
      log('hammer-curl', [[27.5, 10], [27.5, 10]]),
    ],
  },
  {
    id: 'seed-full-body-b-w2',
    planId: 'full-body-b',
    date: '2026-08-20',
    note: 'Seeded from prior training log (week 2).',
    logs: [
      log('trap-bar-deadlift', [[115, 6], [130, 6], [140, 6], [140, 8]]),
      log('ohp-barbell', [[55, 8], [60, 8], [65, 8]]),
      log('chin-ups', [[0, 11], [0, 11], [0, 11], [0, 11]]),
      log('rkc-plank', [[0, 40], [0, 40]]),
      log('box-jumps', [[0, 8], [0, 8]]),
      log('kb-overhead-press', [[18, 10], [18, 10]]),
      log('seated-row', [[75, 12], [75, 12]]),
      log('ab-curl-ups', [[0, 20], [0, 20]]),
      log('hammer-curl', [[27.5, 10], [27.5, 10]]),
    ],
  },
  {
    id: 'seed-full-body-b',
    planId: 'full-body-b',
    date: '2026-08-26',
    note: 'Seeded from prior training log.',
    logs: [
      log('trap-bar-deadlift', [[115, 6], [130, 6], [140, 6], [140, 8]]),
      log('ohp-barbell', [[55, 8], [60, 8], [65, 8]]),
      log('chin-ups', [[0, 11], [0, 11], [0, 11], [0, 11]]),
      log('rkc-plank', [[0, 35], [0, 40]]),
      log('box-jumps', [[0, 8], [0, 8]]),
      log('kb-overhead-press', [[18, 10], [18, 10]]),
      log('seated-row', [[75, 12], [75, 12]]),
      log('ab-curl-ups', [[0, 20], [0, 20]]),
      log('hammer-curl', [[27.5, 10], [27.5, 10]]),
    ],
  },
  {
    id: 'seed-full-body-c',
    planId: 'full-body-c',
    date: '2026-08-24',
    note: 'Seeded from prior training log.',
    logs: [
      log('fbc-incline-bench', [[35, 11], [35, 11], [35, 11]]),
      log('fbc-lat-pulldown', [[80, 11], [80, 11], [80, 11]]),
      log('fbc-chest-row', [[30, 11], [30, 11], [30, 11]]),
      log('fbc-lateral-raise', [[12.5, 13], [12.5, 13], [12.5, 13]]),
      log('fbc-rear-delt-fly', [[12.5, 13], [12.5, 13], [12.5, 13]]),
      log('fbc-face-pull', [[25, 13], [25, 13], [25, 13]]),
      log('fbc-tricep-pushdown', [[30, 12], [30, 12], [30, 12]]),
      log('fbc-incline-curl', [[22.5, 11], [22.5, 11], [22.5, 11]]),
      log('fbc-overhead-tricep-ext', [[25, 12], [25, 12], [25, 12]]),
      log('fbc-hammer-curl', [[27.5, 11], [27.5, 11], [27.5, 11]]),
      log('fbc-leg-press', [[190, 12], [190, 12], [190, 12]]),
      log('fbc-leg-curl', [[65, 12], [65, 12], [65, 12]]),
      log('fbc-hanging-knee-raises', [[0, 12], [0, 12], [0, 12]]),
      log('fbc-cable-crunch', [[45, 12], [45, 12], [45, 12]]),
    ],
  },
]

for (const workout of seedWorkouts) {
  const { error } = await supabase.from('workouts').upsert({
    id: workout.id,
    plan_id: workout.planId,
    performed_on: workout.date,
    logs: workout.logs,
    note: workout.note,
  })
  if (error) {
    console.error(`Failed to seed ${workout.id}:`, error.message)
  } else {
    console.log(`Seeded ${workout.id} (${workout.date})`)
  }
}

await supabase.auth.signOut()
console.log('Done.')
