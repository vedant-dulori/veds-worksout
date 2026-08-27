import './style.css'
import type { Session } from '@supabase/supabase-js'
import {
  cloudConfigured,
  currentSession,
  deleteCloudCheckIn,
  deleteCloudWorkout,
  loadCloudData,
  onAuthChange,
  saveCloudCheckIn,
  saveCloudSettings,
  saveCloudWorkout,
  signIn,
  signOut,
  signUp,
} from './cloud'

type Exercise = { id: string; blockId: string; name: string; sets: number; reps: string; cue: string; timed?: boolean; defaultSeconds?: number }
type WorkoutBlock = { id: string; name: string; focus: string; rounds: number }
type Plan = { id: string; name: string; focus: string; duration: string; blocks: WorkoutBlock[]; exercises: Exercise[] }
type SetLog = { weight: number; reps: number; completed: boolean }
type Log = { exerciseId: string; sets: SetLog[]; completed: boolean }
type Workout = { id: string; planId: string; date: string; logs: Log[]; note?: string; durationSeconds?: number }
type CheckIn = { id: string; date: string; bodyWeight?: number; note: string; photoId: string; photoUrl?: string }
type DraftSet = { weight: string; reps: string; completed: boolean }
type State = {
  workouts: Workout[]
  checkIns: CheckIn[]
  selectedPlanId: string
  activeTab: 'workout' | 'progress' | 'checkin'
  drafts: Record<string, { sets: DraftSet[]; completed: boolean }>
  sessionStatus: 'idle' | 'active' | 'paused'
  expandedWorkoutId?: string
  expandedRoundKey?: string
  activeStepIndex: number
  workoutView: 'overview' | 'focus'
  editingWorkoutId?: string
  editingWorkoutDate?: string
  planEditorOpen: boolean
  workoutNote: string
  progressFilterPlanId?: string
  progressFilterExerciseId?: string
  progressMetricModeByExercise?: Record<string, 'max' | 'avg'>
  progressView: 'trend' | 'compare'
  compareWorkoutIdA?: string
  compareWorkoutIdB?: string
  restTimerEnd?: number
  sessionStartedAt?: number
  exerciseTimer?: {
    end?: number
    remaining: number
    label: string
    exerciseId: string
    setIndex: number
  }
}

const defaultPlans: Plan[] = [
  {
    id: 'squat-day', name: 'Full Body A — Squat Focus', focus: 'Full-body strength & core', duration: '75-90 min',
    blocks: [
      { id: 'squat-strength', name: 'Main Strength', focus: 'Heavy compound work', rounds: 4 },
      { id: 'squat-volume', name: 'Volume', focus: 'Controlled hypertrophy work', rounds: 3 },
      { id: 'squat-accessories', name: 'Accessories & Core', focus: 'Finish strong and stable', rounds: 2 },
    ],
    exercises: [
      { id: 'barbell-squat', blockId: 'squat-strength', name: 'Barbell Squat', sets: 4, reps: '10', cue: 'Brace your core and drive through your whole foot.' },
      { id: 'bench-press', blockId: 'squat-strength', name: 'Bench Press', sets: 4, reps: '10', cue: 'Keep shoulder blades pulled back and control the bar.' },
      { id: 'pull-ups', blockId: 'squat-strength', name: 'Pull-Ups', sets: 4, reps: '10-12', cue: 'Pull your elbows down and avoid swinging.' },
      { id: 'stationary-lunges', blockId: 'squat-volume', name: 'Stationary Lunges', sets: 2, reps: '10 each side', cue: 'Keep your torso upright and push through the front heel.' },
      { id: 'push-ups', blockId: 'squat-volume', name: 'Push-Ups', sets: 3, reps: '25', cue: 'Keep your body in a straight line.' },
      { id: 'bent-over-row', blockId: 'squat-volume', name: 'Bent-Over Dumbbell Row', sets: 3, reps: '10', cue: 'Keep your back flat and pull toward your hips.' },
      { id: 'side-plank', blockId: 'squat-volume', name: 'Side Plank', sets: 2, reps: '45 sec each side', cue: 'Keep your hips elevated and core tight.', timed: true, defaultSeconds: 45 },
      { id: 'farmer-carry', blockId: 'squat-accessories', name: 'Farmer Carry', sets: 2, reps: '2 laps', cue: 'Yellow kettlebell (16kg / 35.2 lb). Stand tall and keep the weight controlled while walking around the gym.' },
      { id: 'incline-curls', blockId: 'squat-accessories', name: 'Incline Dumbbell Curls', sets: 2, reps: '10', cue: 'Keep your elbows still and control the lowering.' },
      { id: 'hanging-knee-raises', blockId: 'squat-accessories', name: 'Hanging Knee Raises', sets: 2, reps: '10-15', cue: 'Curl your pelvis upward; avoid swinging.' },
    ],
  },
  {
    id: 'full-body-b', name: 'Full Body B — Deadlift Focus', focus: 'Full-body strength & power', duration: '60-75 min',
    blocks: [
      { id: 'fbb-strength', name: 'Main Strength', focus: 'Heavy compound work', rounds: 4 },
      { id: 'fbb-power', name: 'Power, Volume & Core', focus: 'Explosive and controlled volume work', rounds: 2 },
      { id: 'fbb-core', name: 'Core & Arms', focus: 'Finish with clean tension', rounds: 2 },
    ],
    exercises: [
      { id: 'trap-bar-deadlift', blockId: 'fbb-strength', name: 'Trap Bar Deadlift', sets: 4, reps: '6-8', cue: 'Brace hard, keep your chest up, and drive through the floor.' },
      { id: 'ohp-barbell', blockId: 'fbb-strength', name: 'Barbell Overhead Press', sets: 3, reps: '8', cue: 'Squeeze your glutes and keep the bar path straight.' },
      { id: 'chin-ups', blockId: 'fbb-strength', name: 'Chin-Ups', sets: 4, reps: '11', cue: 'Pull your chest toward the bar and control the descent.' },
      { id: 'rkc-plank', blockId: 'fbb-power', name: 'RKC Plank', sets: 2, reps: '35-40 sec', cue: 'Squeeze your glutes, abs, and fists hard.', timed: true, defaultSeconds: 35 },
      { id: 'box-jumps', blockId: 'fbb-power', name: 'Box Jumps', sets: 2, reps: '8', cue: '30" box. Jump explosively and land softly with control.' },
      { id: 'kb-overhead-press', blockId: 'fbb-power', name: 'Kettlebell Overhead Press', sets: 2, reps: '10 each side', cue: 'Pink kettlebell (18 lb). Keep your core tight and avoid leaning.' },
      { id: 'seated-row', blockId: 'fbb-power', name: 'Seated Row Machine', sets: 2, reps: '12', cue: 'Pull your elbows back and squeeze your shoulder blades.' },
      { id: 'ab-curl-ups', blockId: 'fbb-core', name: 'Ab Curl-Ups', sets: 2, reps: '20-25 sec each side', cue: 'Keep the movement slow and maintain tension.', timed: true, defaultSeconds: 20 },
      { id: 'hammer-curl', blockId: 'fbb-core', name: 'Hammer Curl', sets: 2, reps: '10', cue: '27.5 lb dumbbells. Keep your elbows fixed and control the lowering.' },
    ],
  },
  {
    id: 'full-body-c', name: 'Full Body C — Hypertrophy Focus', focus: 'Hypertrophy & muscle endurance', duration: '65-80 min',
    blocks: [
      { id: 'fbc-chest-back', name: 'Chest & Back', focus: 'Controlled hypertrophy work', rounds: 3 },
      { id: 'fbc-shoulders', name: 'Shoulders', focus: 'Controlled hypertrophy work', rounds: 3 },
      { id: 'fbc-arms', name: 'Arms', focus: 'Controlled hypertrophy work', rounds: 3 },
      { id: 'fbc-legs-core', name: 'Legs & Core', focus: 'Finish strong and stable', rounds: 3 },
    ],
    exercises: [
      { id: 'fbc-incline-bench', blockId: 'fbc-chest-back', name: 'Incline Dumbbell Bench Press', sets: 3, reps: '10-12', cue: 'Lower slowly and keep your shoulder blades pulled back.' },
      { id: 'fbc-lat-pulldown', blockId: 'fbc-chest-back', name: 'Lat Pulldown', sets: 3, reps: '10-12', cue: 'Pull your elbows down toward your ribs.' },
      { id: 'fbc-chest-row', blockId: 'fbc-chest-back', name: 'Chest-Supported Dumbbell Row', sets: 3, reps: '10-12', cue: 'Keep your chest planted and squeeze your shoulder blades.' },
      { id: 'fbc-lateral-raise', blockId: 'fbc-shoulders', name: 'Dumbbell Lateral Raises', sets: 3, reps: '12-15', cue: "Lead with your elbows and don't swing." },
      { id: 'fbc-rear-delt-fly', blockId: 'fbc-shoulders', name: 'Rear Delt Fly', sets: 3, reps: '12-15', cue: "Keep the movement controlled and don't shrug." },
      { id: 'fbc-face-pull', blockId: 'fbc-shoulders', name: 'Cable Face Pulls', sets: 3, reps: '12-15', cue: 'Pull toward your face and rotate your hands outward.' },
      { id: 'fbc-tricep-pushdown', blockId: 'fbc-arms', name: 'Cable Tricep Pushdowns', sets: 3, reps: '10-15', cue: 'Keep your elbows pinned and fully extend.' },
      { id: 'fbc-incline-curl', blockId: 'fbc-arms', name: 'Incline Dumbbell Curls', sets: 3, reps: '10-12', cue: 'Keep your elbows back and control the stretch.' },
      { id: 'fbc-overhead-tricep-ext', blockId: 'fbc-arms', name: 'Overhead Cable Tricep Extensions', sets: 3, reps: '10-15', cue: 'Keep your elbows pointed forward and get a full stretch.' },
      { id: 'fbc-hammer-curl', blockId: 'fbc-arms', name: 'Hammer Curls', sets: 3, reps: '10-12', cue: "Keep your wrists neutral and don't swing." },
      { id: 'fbc-leg-press', blockId: 'fbc-legs-core', name: 'Leg Press', sets: 3, reps: '10-15', cue: "Lower under control and don't lock your knees." },
      { id: 'fbc-leg-curl', blockId: 'fbc-legs-core', name: 'Leg Curl', sets: 3, reps: '10-15', cue: 'Squeeze your hamstrings at the top.' },
      { id: 'fbc-hanging-knee-raises', blockId: 'fbc-legs-core', name: 'Hanging Knee Raises', sets: 3, reps: '10-15', cue: 'Curl your pelvis upward instead of swinging.' },
      { id: 'fbc-cable-crunch', blockId: 'fbc-legs-core', name: 'Cable Crunches', sets: 3, reps: '10-15', cue: 'Bring your ribs toward your pelvis and control the return.' },
    ],
  },
]

let plans = structuredClone(defaultPlans)

const now = new Date()
const dayKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const formatDate = (value: string, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', options ?? { month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00`))

const seedWorkouts: Workout[] = []
const defaults: State = {
  workouts: seedWorkouts,
  checkIns: [],
  selectedPlanId: 'squat-day',
  activeTab: 'workout',
  drafts: {},
  sessionStatus: 'idle',
  workoutNote: '',
  activeStepIndex: 0,
  workoutView: 'focus',
  planEditorOpen: false,
  progressView: 'trend',
}
let state: State = {
  ...defaults,
  workouts: seedWorkouts,
  drafts: {},
  sessionStatus: 'idle',
  workoutNote: '',
  activeStepIndex: 0,
  workoutView: 'focus',
  planEditorOpen: false,
}
const app = document.querySelector<HTMLDivElement>('#app')!
let session: Session | null = null
let settingsSaveTimer: number | undefined
let settingsSaveInFlight: Promise<void> = Promise.resolve()
let pendingPhotoBlob: Blob | undefined

function cloudDraft() {
  return {
    selectedPlanId: state.selectedPlanId,
    drafts: state.drafts,
    sessionStatus: state.sessionStatus,
    workoutNote: state.workoutNote,
    activeStepIndex: state.activeStepIndex,
    workoutView: state.workoutView,
    editingWorkoutId: state.editingWorkoutId,
    editingWorkoutDate: state.editingWorkoutDate,
    sessionStartedAt: state.sessionStartedAt,
  }
}

function save() {
  if (!session) return
  window.clearTimeout(settingsSaveTimer)
  settingsSaveTimer = window.setTimeout(() => {
    settingsSaveInFlight = settingsSaveInFlight
      .catch(() => undefined)
      .then(() => saveCloudSettings(plans, cloudDraft()))
      .catch((error: unknown) => {
        console.error('Unable to save cloud draft.', error)
        toast('Cloud save failed. Check your connection.')
      })
  }, 350)
}

async function flushCloudSave() {
  window.clearTimeout(settingsSaveTimer)
  if (!session) return
  await settingsSaveInFlight.catch(() => undefined)
  await saveCloudSettings(plans, cloudDraft())
}

function savePlans() {
  save()
}
type WorkoutStep = {
  block: WorkoutBlock
  blockIndex: number
  roundIndex: number
  exercise: Exercise
  exerciseIndex: number
}
function workoutSteps(workoutPlan: Plan) {
  return workoutPlan.blocks.flatMap((block, blockIndex) => {
    const exercises = workoutPlan.exercises.filter((exercise) => exercise.blockId === block.id)
    return Array.from({ length: block.rounds }, (_, roundIndex) =>
      exercises.map((exercise, exerciseIndex): WorkoutStep => ({
        block,
        blockIndex,
        roundIndex,
        exercise,
        exerciseIndex,
      }))).flat()
  })
}
function normalizeDrafts(drafts: State['drafts']) {
  return Object.fromEntries(Object.entries(drafts).map(([exerciseId, exerciseDraft]) => [
    exerciseId,
    {
      ...exerciseDraft,
      sets: exerciseDraft.sets.map((set) => ({ ...set, completed: set.completed ?? false })),
    },
  ]))
}
function normalizeWorkout(workout: Workout) {
  return {
    ...workout,
    logs: workout.logs.map((log) => {
      const legacy = log as Log & { weight?: number }
      if (Array.isArray(legacy.sets)) {
        return { ...legacy, sets: legacy.sets.map((set) => ({ ...set, completed: set.completed ?? true })) }
      }
      const exercise = plans.flatMap((item) => item.exercises).find((item) => item.id === log.exerciseId)
      return {
        exerciseId: log.exerciseId,
        completed: log.completed,
        sets: Array.from({ length: exercise?.sets ?? 1 }, () => ({
          weight: legacy.weight ?? 0,
          reps: Number(exercise?.reps.match(/\d+/)?.[0] ?? 0),
          completed: true,
        })),
      }
    }),
  }
}
function plan() { return plans.find((item) => item.id === state.selectedPlanId) ?? plans[0] }
function lastWorkout(planId: string) {
  return state.workouts.filter((item) => item.planId === planId && item.date < dayKey(now)).sort((a, b) => b.date.localeCompare(a.date))[0]
}
function previousSets(exercise: Exercise) {
  return lastWorkout(state.selectedPlanId)?.logs.find((item) => item.exerciseId === exercise.id)?.sets
    ?? Array.from({ length: exercise.sets }, () => ({ weight: 0, reps: 0 }))
}
function draft(exercise: Exercise) {
  const existing = state.drafts[exercise.id]
  const sets = Array.from({ length: exercise.sets }, (_, index) => {
    if (existing?.sets[index]) return existing.sets[index]
    const previous = previousSets(exercise)[index]
    return {
      weight: previous?.weight ? String(previous.weight) : '',
      reps: previous?.reps ? String(previous.reps) : exercise.timed ? String(exercise.defaultSeconds ?? 30) : '',
      completed: false,
    }
  })
  return {
    sets,
    completed: sets.every((set) => set.completed),
  }
}
function updateSetCompletion(exercise: Exercise, setIndex: number, completed: boolean) {
  const current = draft(exercise)
  const sets = current.sets.map((set) => ({ ...set }))
  sets[setIndex].completed = completed
  state.drafts[exercise.id] = { sets, completed: sets.every((set) => set.completed) }

  if (!completed) return
  const activePlan = plan()
  const currentStepIndex = workoutSteps(activePlan).findIndex((step) =>
    step.exercise.id === exercise.id && step.roundIndex === setIndex)
  if (currentStepIndex >= 0) state.activeStepIndex = Math.max(state.activeStepIndex, currentStepIndex + 1)
  const blockIndex = activePlan.blocks.findIndex((block) => block.id === exercise.blockId)
  const block = activePlan.blocks[blockIndex]
  const blockExercises = activePlan.exercises.filter((item) => item.blockId === block.id)
  const roundComplete = blockExercises.every((item) => draft(item).sets[setIndex]?.completed)
  if (!roundComplete) return

  const nextKey = setIndex + 1 < block.rounds
    ? `${block.id}:${setIndex + 1}`
    : activePlan.blocks[blockIndex + 1]
      ? `${activePlan.blocks[blockIndex + 1].id}:0`
      : undefined
  state.expandedRoundKey = nextKey
  state.restTimerEnd = Date.now() + 90_000
}
function weekStart() {
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  return dayKey(monday)
}
function streak() {
  const weeks = new Set(state.workouts.map((workout) => {
    const date = new Date(`${workout.date}T12:00:00`)
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
    return dayKey(date)
  }))
  return weeks.size
}
function bestWeight(exerciseId: string) {
  return Math.max(0, ...state.workouts.flatMap((workout) =>
    workout.logs.filter((log) => log.exerciseId === exerciseId).flatMap((log) => log.sets.map((set) => set.weight))))
}
function exerciseMetric(workout: Workout, exercise: Exercise, mode: 'max' | 'avg' = 'max') {
  const log = workout.logs.find((item) => item.exerciseId === exercise.id)
  const completedSets = log?.sets.filter((set) => set.completed) ?? []
  if (!completedSets.length) return undefined
  const aggregate = (values: number[]) => mode === 'avg'
    ? Math.round(values.reduce((sum, item) => sum + item, 0) / values.length * 10) / 10
    : Math.max(...values)
  const weightValue = aggregate(completedSets.map((set) => set.weight))
  if (weightValue > 0) return { value: weightValue, unit: 'lb' }
  const repsValue = aggregate(completedSets.map((set) => set.reps))
  return { value: repsValue, unit: exercise.timed ? 'sec' : 'reps' }
}
function workoutVolume(workout: Workout) {
  const workoutPlan = plans.find((item) => item.id === workout.planId)
  return workout.logs.reduce((total, log) => {
    const exercise = workoutPlan?.exercises.find((item) => item.id === log.exerciseId)
    if (exercise?.timed) return total
    return total + log.sets.filter((set) => set.completed).reduce((sum, set) => sum + set.weight * set.reps, 0)
  }, 0)
}
function workoutHoldSeconds(workout: Workout) {
  const workoutPlan = plans.find((item) => item.id === workout.planId)
  return workout.logs.reduce((total, log) => {
    const exercise = workoutPlan?.exercises.find((item) => item.id === log.exerciseId)
    if (!exercise?.timed) return total
    return total + log.sets.filter((set) => set.completed).reduce((sum, set) => sum + set.reps, 0)
  }, 0)
}
function restSeconds() {
  return state.restTimerEnd ? Math.max(0, Math.ceil((state.restTimerEnd - Date.now()) / 1000)) : 0
}
function restLabel(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
function sessionElapsedSeconds() {
  return state.sessionStartedAt ? Math.max(0, Math.floor((Date.now() - state.sessionStartedAt) / 1000)) : 0
}
function durationLabel(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`
}
function exerciseTimerSeconds() {
  const timer = state.exerciseTimer
  if (!timer) return 0
  return timer.end ? Math.max(0, Math.ceil((timer.end - Date.now()) / 1000)) : timer.remaining
}
type Icon = 'home' | 'chart' | 'camera' | 'check' | 'calendar' | 'bolt' | 'next' | 'weight' | 'trend'
function icon(name: Icon) {
  const paths: Record<Icon, string> = {
    home: '<path d="M3 11 12 3l9 8M5 10v10h14V10M9 20v-6h6v6"/>',
    chart: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
    camera: '<path d="M14.5 4 16 7h4a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2h4l1.5-3z"/><circle cx="12" cy="13" r="3"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    bolt: '<path d="m13 2-9 12h7l-1 8 9-12h-7z"/>',
    next: '<path d="m9 18 6-6-6-6"/>',
    weight: '<path d="M6.5 6.5h11v11h-11zM3 9v6M21 9v6M1 11v2M23 11v2"/>',
    trend: '<path d="m3 17 6-6 4 4 8-9M15 6h6v6"/>',
  }
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`
}
function timerOverlay() {
  const remaining = restSeconds()
  const exerciseRemaining = exerciseTimerSeconds()
  return state.exerciseTimer
    ? `<aside class="exercise-timer"><div class="timer-pulse"></div><div class="exercise-timer-copy"><small>LIVE EXERCISE TIMER</small><strong>${state.exerciseTimer.label}</strong></div><b data-exercise-clock>${restLabel(exerciseRemaining)}</b><button data-pause-exercise>${state.exerciseTimer.end ? 'Pause' : 'Resume'}</button><button data-add-exercise>+10s</button><button data-stop-exercise>Stop</button></aside>`
    : remaining
      ? `<aside class="rest-timer"><span>${icon('calendar')}</span><div><small>REST TIMER</small><strong data-rest-clock>${restLabel(remaining)}</strong></div><button data-add-rest>+30s</button><button data-skip-rest>Skip</button></aside>`
      : ''
}
function shell(content: string) {
  return `<div class="app-shell">
    <header class="topbar">
      <button class="brand" data-tab="workout"><span class="brand-mark">${icon('bolt')}</span><span>REP<b>TRACK</b></span></button>
      <nav class="desktop-nav"><button class="${state.activeTab === 'workout' ? 'active' : ''}" data-tab="workout">Workout</button><button class="${state.activeTab === 'progress' ? 'active' : ''}" data-tab="progress">Progress</button><button class="${state.activeTab === 'checkin' ? 'active' : ''}" data-tab="checkin">Check-in</button></nav>
      <div class="account-menu"><span>${escapeHtml(session?.user.email ?? '')}</span><button data-sign-out>Sign out</button></div>
    </header>
    <main>${content}</main>
    ${timerOverlay()}
    <nav class="mobile-nav"><button class="${state.activeTab === 'workout' ? 'active' : ''}" data-tab="workout">${icon('home')}<span>Workout</span></button><button class="${state.activeTab === 'progress' ? 'active' : ''}" data-tab="progress">${icon('chart')}<span>Progress</span></button><button class="${state.activeTab === 'checkin' ? 'active' : ''}" data-tab="checkin">${icon('camera')}<span>Check-in</span></button></nav>
  </div>`
}

function renderAuth(message = '') {
  if (!cloudConfigured) {
    app.innerHTML = `<main class="auth-page"><section class="auth-card">
      <span class="brand auth-brand"><span class="brand-mark">${icon('bolt')}</span><span>REP<b>TRACK</b></span></span>
      <p class="eyebrow">CLOUD SETUP REQUIRED</p><h1>Connect Supabase</h1>
      <p>Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to Vercel and .env.local, then run supabase/schema.sql in Supabase.</p>
    </section></main>`
    return
  }
  app.innerHTML = `<main class="auth-page"><section class="auth-card">
    <span class="brand auth-brand"><span class="brand-mark">${icon('bolt')}</span><span>REP<b>TRACK</b></span></span>
    <p class="eyebrow">PRIVATE CLOUD TRACKING</p><h1>Your training, everywhere.</h1>
    <p>Sign in to securely sync workouts, plans, drafts, check-ins, and private progress photos.</p>
    ${message ? `<div class="auth-message">${escapeHtml(message)}</div>` : ''}
    <form id="auth-form">
      <label>Email<input id="auth-email" type="email" autocomplete="email" required></label>
      <label>Password<input id="auth-password" type="password" autocomplete="current-password" minlength="8" required></label>
      <button class="primary" type="submit" data-auth-action="sign-in">Sign in</button>
      <button class="secondary" type="submit" data-auth-action="sign-up">Create account</button>
    </form>
  </section></main>`
}

function renderLoading(message: string) {
  app.innerHTML = `<main class="auth-page"><section class="auth-card loading-card">
    <span class="brand auth-brand"><span class="brand-mark">${icon('bolt')}</span><span>REP<b>TRACK</b></span></span>
    <div class="cloud-spinner" aria-hidden="true"></div>
    <p class="eyebrow">SECURE CLOUD SYNC</p>
    <h1>${escapeHtml(message)}</h1>
  </section></main>`
}

function renderActiveWorkout() {
  const active = plan()
  const steps = workoutSteps(active)
  const step = steps[state.activeStepIndex]
  const completed = steps.filter((item) => draft(item.exercise).sets[item.roundIndex]?.completed).length
  const progress = Math.round(completed / steps.length * 100)

  if (!step) {
    app.innerHTML = `<div class="workout-mode">
      <header class="workout-mode-header"><button data-step-nav="-1">← Review</button><span class="brand"><span class="brand-mark">${icon('bolt')}</span><span>REP<b>TRACK</b></span></span><span class="header-stats"><b data-session-clock>${durationLabel(sessionElapsedSeconds())}</b><small>${steps.length}/${steps.length}</small></span></header>
      <main class="workout-finished">
        <div class="mode-toggle"><button data-workout-view="overview">Normal</button><button class="active" disabled>Workout</button></div>
        <span class="finish-mark">${icon('check')}</span><p class="eyebrow">SESSION COMPLETE</p><h1>Every round is done.</h1><p>Save the workout to add it to your progress history.</p>
        <label class="session-note"><span>SESSION NOTE <small>OPTIONAL</small></span><textarea id="workout-note" maxlength="240" placeholder="Energy, form, pain, or anything worth remembering...">${escapeHtml(state.workoutNote)}</textarea></label>
        <button id="finish-workout" class="primary">${icon('check')} Finish & save workout</button>
        <button class="secondary" data-save-draft>Save without finishing</button>
        <button class="discard-session" data-discard-session>Discard this workout</button>
      </main>${timerOverlay()}
    </div>`
    return
  }

  const current = draft(step.exercise).sets[step.roundIndex]
  const previous = previousSets(step.exercise)[step.roundIndex]
  const nextStep = steps[state.activeStepIndex + 1]
  const blockExercises = active.exercises.filter((exercise) => exercise.blockId === step.block.id)
  const roundCompleted = blockExercises.filter((exercise) => draft(exercise).sets[step.roundIndex]?.completed).length
  const previousResult = previous?.weight
    ? `${previous.weight} lb × ${previous.reps}${step.exercise.timed ? ' sec' : ''}`
    : 'No previous result'

  app.innerHTML = `<div class="workout-mode">
    <header class="workout-mode-header">
      <button data-save-draft>← Save & exit</button>
      <span class="brand"><span class="brand-mark">${icon('bolt')}</span><span>REP<b>TRACK</b></span></span>
      <span class="header-stats"><b data-session-clock>${durationLabel(sessionElapsedSeconds())}</b><small>${completed}/${steps.length}</small></span>
    </header>
    <div class="workout-mode-progress"><span style="width:${progress}%"></span></div>
    <main class="focus-logger">
      <div class="mode-toggle"><button data-workout-view="overview">Normal</button><button class="active" disabled>Workout</button></div>
      <div class="focus-context"><span>BLOCK ${step.blockIndex + 1}</span><span>ROUND ${step.roundIndex + 1}/${step.block.rounds}</span><span>${roundCompleted}/${blockExercises.length} DONE</span><span>AUTO-SAVED</span></div>
      <p class="focus-order">EXERCISE ${step.exerciseIndex + 1} OF ${blockExercises.length}</p>
      <h1>${step.exercise.name}</h1>
      <p class="focus-target">${step.exercise.reps}${step.exercise.timed ? '' : ' reps'} · ${step.block.name}</p>
      <div class="focus-cue">${icon('bolt')}<p><strong>FORM FOCUS</strong>${step.exercise.cue}</p></div>
      <div class="previous-result"><span>LAST TIME, THIS ROUND</span><strong>${previousResult}</strong></div>

      <section class="quick-fields">
        <div class="quick-field">
          <span>WEIGHT</span>
          <div><button aria-label="Decrease weight" data-adjust-exercise="${step.exercise.id}" data-adjust-set="${step.roundIndex}" data-adjust-field="weight" data-adjust-amount="-2.5">−</button><label><input aria-label="Weight" data-exercise="${step.exercise.id}" data-set="${step.roundIndex}" data-field="weight" type="number" min="0" step="2.5" inputmode="decimal" value="${current.weight}"><small>lb</small></label><button aria-label="Increase weight" data-adjust-exercise="${step.exercise.id}" data-adjust-set="${step.roundIndex}" data-adjust-field="weight" data-adjust-amount="2.5">+</button></div>
        </div>
        <div class="quick-field">
          <span>${step.exercise.timed ? 'SECONDS' : 'REPS'}</span>
          <div><button aria-label="Decrease ${step.exercise.timed ? 'seconds' : 'reps'}" data-adjust-exercise="${step.exercise.id}" data-adjust-set="${step.roundIndex}" data-adjust-field="reps" data-adjust-amount="-1">−</button><label><input aria-label="${step.exercise.timed ? 'Seconds' : 'Reps'}" data-exercise="${step.exercise.id}" data-set="${step.roundIndex}" data-field="reps" type="number" min="0" step="1" inputmode="numeric" value="${current.reps}"><small>${step.exercise.timed ? 'sec' : 'reps'}</small></label><button aria-label="Increase ${step.exercise.timed ? 'seconds' : 'reps'}" data-adjust-exercise="${step.exercise.id}" data-adjust-set="${step.roundIndex}" data-adjust-field="reps" data-adjust-amount="1">+</button></div>
        </div>
      </section>

      <div class="focus-actions">
        <button class="focus-timer" data-exercise-timer="${step.exercise.id}" data-timer-set="${step.roundIndex}">${icon('calendar')} Start timer</button>
        <button class="focus-complete" data-complete-step="${step.exercise.id}" data-set="${step.roundIndex}">${icon('check')} ${current.completed ? 'Next exercise' : 'Complete set & next'}</button>
      </div>
      <div class="step-navigation"><button data-step-nav="-1" ${state.activeStepIndex === 0 ? 'disabled' : ''}>← Previous</button><span>${state.activeStepIndex + 1} of ${steps.length}</span><button data-step-nav="1">${nextStep ? 'Next →' : 'Finish →'}</button></div>
      <div class="up-next"><span>UP NEXT</span><strong>${nextStep ? `${nextStep.exercise.name} · Round ${nextStep.roundIndex + 1}` : 'Finish and save workout'}</strong></div>
      <button class="focus-discard" data-discard-session>Discard workout</button>
    </main>${timerOverlay()}
  </div>`
}

function renderPlanEditor() {
  const activePlan = plan()
  const planTabs = plans.map((item) =>
    `<button class="${item.id === activePlan.id ? 'active' : ''}" data-editor-select-plan="${item.id}">${item.name}</button>`).join('')
  const blocks = activePlan.blocks.map((block, blockIndex) => {
    const exercises = activePlan.exercises.filter((exercise) => exercise.blockId === block.id).map((exercise) => `
      <div class="editor-exercise">
        <span>${String.fromCharCode(65 + activePlan.exercises.filter((item) => item.blockId === block.id).indexOf(exercise))}</span>
        <label>Name<input value="${escapeAttribute(exercise.name)}" data-editor-exercise="${exercise.id}" data-editor-prop="name"></label>
        <label>Target<input value="${escapeAttribute(exercise.reps)}" data-editor-exercise="${exercise.id}" data-editor-prop="reps"></label>
        <label class="editor-cue">Form cue<input value="${escapeAttribute(exercise.cue)}" data-editor-exercise="${exercise.id}" data-editor-prop="cue"></label>
        <label class="editor-timed">Timed hold<input type="checkbox" data-editor-exercise="${exercise.id}" data-editor-prop="timed" ${exercise.timed ? 'checked' : ''}></label>
      </div>`).join('')
    return `<section class="editor-block">
      <header><span>BLOCK ${blockIndex + 1}</span><label>Block name<input value="${escapeAttribute(block.name)}" data-editor-block="${block.id}" data-editor-prop="name"></label><label>Rounds<input type="number" min="1" max="10" value="${block.rounds}" data-editor-block="${block.id}" data-editor-prop="rounds"></label></header>
      <label class="editor-focus">Block focus<input value="${escapeAttribute(block.focus)}" data-editor-block="${block.id}" data-editor-prop="focus"></label>
      <div class="editor-exercises">${exercises}</div>
      <button data-add-editor-exercise="${block.id}">+ Add exercise</button>
    </section>`
  }).join('')
  return `<div class="editor-overlay" role="dialog" aria-modal="true" aria-label="Edit workout plans">
    <div class="plan-editor">
      <header><div><p class="eyebrow">PLAN EDITOR</p><h2>Make the split yours</h2></div><button data-close-plan-editor aria-label="Close plan editor">×</button></header>
      <div class="editor-plan-tabs">${planTabs}</div>
      <div class="editor-plan-meta"><label>Plan name<input value="${escapeAttribute(activePlan.name)}" data-editor-plan="${activePlan.id}" data-editor-prop="name"></label><label>Focus<input value="${escapeAttribute(activePlan.focus)}" data-editor-plan="${activePlan.id}" data-editor-prop="focus"></label></div>
      <div class="editor-blocks">${blocks}</div>
      <button class="secondary editor-add-block" data-add-editor-block>+ Add block</button>
      <button class="primary editor-save" data-close-plan-editor>Save plans</button>
    </div>
  </div>`
}

function renderWorkout() {
  if (state.sessionStatus === 'active' && state.workoutView === 'focus') {
    renderActiveWorkout()
    return
  }
  const active = plan()
  const previous = lastWorkout(active.id)
  const totalSets = active.exercises.reduce((sum, exercise) => sum + exercise.sets, 0)
  const completedSets = active.exercises.reduce((sum, exercise) =>
    sum + draft(exercise).sets.filter((set) => set.completed).length, 0)
  const progress = completedSets / totalSets * 100
  const totalRounds = active.blocks.reduce((sum, block) => sum + block.rounds, 0)
  const completedRounds = active.blocks.reduce((sum, block) => {
    const blockExercises = active.exercises.filter((exercise) => exercise.blockId === block.id)
    return sum + Array.from({ length: block.rounds }).filter((_, roundIndex) =>
      blockExercises.every((exercise) => draft(exercise).sets[roundIndex]?.completed)).length
  }, 0)
  const isLogging = state.sessionStatus === 'active'
  const hasSavedDraft = state.sessionStatus === 'paused'
  const sessionLocked = state.sessionStatus !== 'idle'
  const weekly = state.workouts.filter((workout) => workout.date >= weekStart()).length
  const cards = plans.map((item, index) => `<button class="plan-card ${item.id === active.id ? 'selected' : ''}" data-plan="${item.id}" ${sessionLocked && item.id !== active.id ? 'disabled' : ''}><span class="plan-number">0${index + 1}</span><span class="plan-copy"><strong>${item.name}</strong><small>${item.blocks.length} blocks · ${item.focus}</small></span>${item.id === active.id ? '<i></i>' : icon('next')}</button>`).join('')
  const firstIncompleteRound = active.blocks.flatMap((block) => {
    const blockExercises = active.exercises.filter((exercise) => exercise.blockId === block.id)
    return Array.from({ length: block.rounds }, (_, roundIndex) => ({
      key: `${block.id}:${roundIndex}`,
      complete: blockExercises.every((exercise) => draft(exercise).sets[roundIndex]?.completed),
    }))
  }).find((round) => !round.complete)?.key
  const expandedRoundKey = state.expandedRoundKey ?? firstIncompleteRound

  const renderCircuitExercise = (exercise: Exercise, roundIndex: number, order: number) => {
    const current = draft(exercise)
    const oldSets = previousSets(exercise)
    const set = current.sets[roundIndex]
    const old = oldSets[roundIndex]
    const delta = Number(set.weight) && old?.weight ? Number(set.weight) - old.weight : 0
    const isPr = Number(set.weight) > bestWeight(exercise.id)
    return `<article class="circuit-exercise ${set.completed ? 'done' : ''}">
      <span class="circuit-order">${String.fromCharCode(65 + order)}</span>
      <div class="circuit-copy"><h4>${exercise.name}</h4><p>${exercise.reps}${exercise.timed ? '' : ' reps'} · ${exercise.cue}</p></div>
      <div class="circuit-last"><small>LAST TIME</small><strong>${old?.weight ? `${old.weight} lb × ${old.reps}${exercise.timed ? ' sec' : ''}` : '-'}</strong></div>
      <label class="circuit-input"><span>WEIGHT</span><div><input data-exercise="${exercise.id}" data-set="${roundIndex}" data-field="weight" type="number" min="0" step="2.5" inputmode="decimal" value="${set.weight}"><small>lb</small></div></label>
      <label class="circuit-input"><span>${exercise.timed ? 'TIME' : 'REPS'}</span><div><input data-exercise="${exercise.id}" data-set="${roundIndex}" data-field="reps" type="number" min="0" step="1" inputmode="numeric" value="${set.reps}"><small>${exercise.timed ? 'sec' : 'reps'}</small></div></label>
      <span class="circuit-delta ${isPr ? 'pr' : delta > 0 ? 'up' : delta < 0 ? 'down' : ''}">${isPr ? 'PR' : delta ? `${delta > 0 ? '+' : ''}${delta} lb` : ''}</span>
      <button class="circuit-timer" data-exercise-timer="${exercise.id}" data-timer-set="${roundIndex}" aria-label="Start timer for ${exercise.name}">${icon('calendar')}</button>
      <button class="circuit-check" data-toggle-set="${exercise.id}" data-set="${roundIndex}" aria-label="Complete ${exercise.name} in round ${roundIndex + 1}">${icon('check')}</button>
    </article>`
  }
  const blocks = active.blocks.map((block, blockIndex) => {
    const blockExercises = active.exercises.filter((exercise) => exercise.blockId === block.id)
    const rounds = Array.from({ length: block.rounds }, (_, roundIndex) => {
      const roundKey = `${block.id}:${roundIndex}`
      const completeCount = blockExercises.filter((exercise) => draft(exercise).sets[roundIndex]?.completed).length
      const roundComplete = completeCount === blockExercises.length
      const expanded = roundKey === expandedRoundKey
      return `<section class="round-card ${roundComplete ? 'complete' : ''} ${expanded ? 'expanded' : ''}">
        <button class="round-header" data-round="${roundKey}">
          <span>${roundComplete ? icon('check') : roundIndex + 1}</span>
          <div><small>ROUND ${roundIndex + 1} OF ${block.rounds}</small><strong>${blockExercises.map((exercise) => exercise.name).join(' → ')}</strong></div>
          <div><b>${completeCount}/${blockExercises.length}</b><small>done</small>${icon('next')}</div>
        </button>
        ${expanded ? `<div class="round-body">${blockExercises.map((exercise, exerciseIndex) => renderCircuitExercise(exercise, roundIndex, exerciseIndex)).join('')}</div>` : ''}
      </section>`
    }).join('')
    const blockRoundsDone = Array.from({ length: block.rounds }).filter((_, roundIndex) =>
      blockExercises.every((exercise) => draft(exercise).sets[roundIndex]?.completed)).length
    const isComplete = blockRoundsDone === block.rounds
    return `<section class="workout-block ${isComplete ? 'complete' : ''}">
      <header class="block-header">
        <span class="block-number">${isComplete ? icon('check') : String(blockIndex + 1).padStart(2, '0')}</span>
        <div><p>BLOCK ${blockIndex + 1}</p><h3>${block.name}</h3><small>${block.focus}</small></div>
        <div class="block-status"><strong>${blockRoundsDone}/${block.rounds}</strong><small>rounds</small><span>${blockExercises.length} exercises each</span></div>
      </header>
      <div class="block-instruction">Do one set of each exercise in order to complete a round. Repeat ${block.rounds} times.</div>
      <div class="round-list">${rounds}</div>
    </section>`
  }).join('')
  const daysUntilMonday = (8 - now.getDay()) % 7
  const checkinMessage = now.getDay() === 1 ? 'Your weekly photo is due today' : `Next photo in ${daysUntilMonday} day${daysUntilMonday === 1 ? '' : 's'}`

  const sessionContent = isLogging
    ? `<div class="session-progress"><span style="width:${progress}%"></span></div><p class="progress-label">${completedRounds} of ${totalRounds} rounds · ${completedSets} of ${totalSets} sets complete · <b data-session-clock>${durationLabel(sessionElapsedSeconds())}</b> elapsed</p>
       <div class="block-list">${blocks}</div>
       <label class="session-note"><span>SESSION NOTE <small>OPTIONAL</small></span><textarea id="workout-note" maxlength="240" placeholder="Energy, form, pain, or anything worth remembering...">${escapeHtml(state.workoutNote)}</textarea></label>
       <div class="session-actions"><button class="secondary" data-save-draft>${icon('calendar')} Save & finish later</button><button id="finish-workout" class="primary" ${completedSets ? '' : 'disabled'}>${icon('check')} Finish & save workout</button><button class="discard-session" data-discard-session>Discard this workout</button></div>`
    : `<div class="workout-gate ${hasSavedDraft ? 'saved' : ''}">
        <span>${hasSavedDraft ? icon('calendar') : icon('weight')}</span>
        <p class="eyebrow">${hasSavedDraft ? 'SAVED IN-PROGRESS' : 'READY WHEN YOU ARE'}</p>
        <h3>${hasSavedDraft ? `${active.name} is waiting for you` : `Start a new ${active.name} log`}</h3>
        <p>${hasSavedDraft ? 'Your completed blocks, sets, and entries are saved on this device.' : `A fresh session will load ${active.blocks.length} blocks with your previous sets, weights, and reps.`}</p>
        <p class="gate-direction">Use the <strong>Workout</strong> toggle above to ${hasSavedDraft ? 'resume' : 'begin'}.</p>
        ${hasSavedDraft ? '<button class="text-button" data-discard-session>Discard saved workout</button>' : ''}
      </div>`

  app.innerHTML = shell(`<section class="page">
    <div class="hero"><div><p class="eyebrow">${formatDate(dayKey(now), { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</p><h1>Ready to get <em>stronger?</em></h1><p>Pick your plan, then switch to Workout mode when you are ready.</p></div><div class="week-progress"><div class="ring" style="--progress:${Math.min(100, weekly / 3 * 100)}%"><span>${weekly}<small>/ 3</small></span></div><div><strong>THIS WEEK</strong><small>workouts completed</small></div></div></div>
    <div class="mode-toggle page-mode-toggle"><button class="active" disabled>Normal</button><button data-workout-view="focus">Workout${hasSavedDraft ? ' · Saved' : ''}</button></div>
    <div class="workout-layout">
      <aside><div class="section-title"><span>YOUR SPLIT</span><button data-open-plan-editor ${sessionLocked ? 'disabled' : ''}>Edit plans</button></div><div class="plan-list">${cards}</div><button class="tip-card" data-tab="checkin"><span>${icon('camera')}</span><span><strong>Monday check-in</strong><small>${checkinMessage}</small></span>${icon('next')}</button></aside>
      <section>
        <div class="session-header"><div><p class="eyebrow">TODAY'S SESSION</p><h2>${active.name}</h2><p>${active.blocks.length} blocks <span>•</span> ${active.focus} <span>•</span> ${active.duration}</p></div><div class="last-session">${icon('calendar')}<span>Last trained<strong>${previous ? formatDate(previous.date, { month: 'long', day: 'numeric' }) : 'No history yet'}</strong></span></div></div>
        ${sessionContent}
      </section>
    </div>
  </section>${state.planEditorOpen ? renderPlanEditor() : ''}`)
}

function renderCompareSection(filterPlan: Plan | undefined, filteredWorkouts: Workout[]) {
  if (!filterPlan) return `<section class="panel"><p class="empty-chart">Pick a plan above to compare two sessions.</p></section>`
  if (filteredWorkouts.length < 2) return `<section class="panel"><p class="empty-chart">Log at least two sessions for this plan to compare.</p></section>`

  const idA = state.compareWorkoutIdA && filteredWorkouts.some((item) => item.id === state.compareWorkoutIdA)
    ? state.compareWorkoutIdA : filteredWorkouts[1].id
  const idB = state.compareWorkoutIdB && filteredWorkouts.some((item) => item.id === state.compareWorkoutIdB)
    ? state.compareWorkoutIdB : filteredWorkouts[0].id
  const workoutA = filteredWorkouts.find((item) => item.id === idA)!
  const workoutB = filteredWorkouts.find((item) => item.id === idB)!
  const dayLabel = (workout: Workout) => formatDate(workout.date, { month: 'short', day: 'numeric' })
  const pickerA = filteredWorkouts.map((item) =>
    `<button class="filter-chip ${item.id === idA ? 'active' : ''}" data-compare-a="${item.id}">${dayLabel(item)}</button>`).join('')
  const pickerB = filteredWorkouts.map((item) =>
    `<button class="filter-chip ${item.id === idB ? 'active' : ''}" data-compare-b="${item.id}">${dayLabel(item)}</button>`).join('')

  const setsText = (log: Log | undefined, exercise: Exercise) => {
    const completed = log?.sets.filter((set) => set.completed) ?? []
    if (!completed.length) return '—'
    return completed.map((set) => exercise.timed ? `${set.reps} sec` : `${set.weight} lb x ${set.reps}`).join(', ')
  }

  const blocks = filterPlan.blocks.map((block) => {
    const exerciseRows = filterPlan.exercises.filter((item) => item.blockId === block.id).map((exercise) => {
      const logA = workoutA.logs.find((item) => item.exerciseId === exercise.id)
      const logB = workoutB.logs.find((item) => item.exerciseId === exercise.id)
      const mode = state.progressMetricModeByExercise?.[exercise.id] ?? 'max'
      const metricA = exerciseMetric(workoutA, exercise, mode)
      const metricB = exerciseMetric(workoutB, exercise, mode)
      const delta = metricA && metricB
        ? (() => {
            const diff = Math.round((metricB.value - metricA.value) * 10) / 10
            const unit = metricB.unit === 'lb' ? ' lb' : ` ${metricB.unit}`
            return `<span class="${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '+' : ''}${diff}${unit}</span>`
          })()
        : '—'
      return `<div class="compare-row"><strong>${exercise.name}</strong><div class="compare-side" data-label="Day A">${setsText(logA, exercise)}</div><div class="compare-side" data-label="Day B">${setsText(logB, exercise)}</div><div class="compare-delta">${delta}</div></div>`
    }).join('')
    return `<section class="compare-block"><header>${block.name}</header>${exerciseRows}</section>`
  }).join('')

  const totalA = workoutVolume(workoutA)
  const totalB = workoutVolume(workoutB)
  const totalDiff = totalB - totalA

  return `<div class="compare-pickers"><div><small>DAY A</small><div class="filter-row">${pickerA}</div></div><div><small>DAY B</small><div class="filter-row">${pickerB}</div></div></div>
    <section class="panel compare-summary"><div><small>${formatDate(workoutA.date, { weekday: 'short', month: 'short', day: 'numeric' })}</small><strong>${totalA.toLocaleString()} lb</strong></div><div class="compare-vs">VS</div><div><small>${formatDate(workoutB.date, { weekday: 'short', month: 'short', day: 'numeric' })}</small><strong>${totalB.toLocaleString()} lb</strong></div><div class="compare-total-delta ${totalDiff >= 0 ? 'up' : 'down'}">${totalDiff >= 0 ? '+' : ''}${totalDiff.toLocaleString()} lb</div></section>
    <section class="panel compare-table">${blocks}</section>`
}

function renderProgress() {
  const workouts = [...state.workouts].sort((a, b) => b.date.localeCompare(a.date))
  const totalLoad = workouts.reduce((sum, workout) => sum + workoutVolume(workout), 0)
  const totalHoldSeconds = workouts.reduce((sum, workout) => sum + workoutHoldSeconds(workout), 0)
  const weekly = workouts.filter((workout) => workout.date >= weekStart()).length
  const filterId = state.progressFilterPlanId
  const filteredWorkouts = filterId ? workouts.filter((workout) => workout.planId === filterId) : workouts
  const trainedPlanIds = new Set(workouts.map((workout) => workout.planId))
  const filterChips = [`<button class="filter-chip ${!filterId ? 'active' : ''}" data-progress-plan="">All plans</button>`]
    .concat(plans.filter((item) => trainedPlanIds.has(item.id)).map((item) =>
      `<button class="filter-chip ${filterId === item.id ? 'active' : ''}" data-progress-plan="${item.id}">${item.name}</button>`))
    .join('')

  const filterPlan = filterId ? plans.find((item) => item.id === filterId) : undefined
  const trainedExerciseIds = new Set(filteredWorkouts.flatMap((workout) => workout.logs.map((log) => log.exerciseId)))
  const exerciseId = filterPlan ? state.progressFilterExerciseId : undefined
  const exercise = exerciseId ? filterPlan?.exercises.find((item) => item.id === exerciseId) : undefined
  const exerciseChips = filterPlan
    ? `<div class="filter-row">${[`<button class="filter-chip ${!exerciseId ? 'active' : ''}" data-progress-exercise="">Total load</button>`]
        .concat(filterPlan.exercises.filter((item) => trainedExerciseIds.has(item.id)).map((item) =>
          `<button class="filter-chip ${exerciseId === item.id ? 'active' : ''}" data-progress-exercise="${item.id}">${item.name}</button>`))
        .join('')}</div>`
    : ''
  const metricMode = exercise ? state.progressMetricModeByExercise?.[exercise.id] ?? 'max' : 'max'
  const metricToggle = exercise
    ? `<div class="view-switch small"><button class="${metricMode === 'max' ? 'active' : ''}" data-progress-metric="max">Max set</button><button class="${metricMode === 'avg' ? 'active' : ''}" data-progress-metric="avg">Average</button></div>`
    : ''

  const relevantWorkouts = exercise ? filteredWorkouts.filter((workout) => exerciseMetric(workout, exercise, metricMode)) : filteredWorkouts
  const oldestFiltered = relevantWorkouts[relevantWorkouts.length - 1]
  const newestFiltered = relevantWorkouts[0]
  const metric = exercise
    ? (workout: Workout) => exerciseMetric(workout, exercise, metricMode)?.value ?? 0
    : workoutVolume
  const metricUnit = exercise && newestFiltered ? exerciseMetric(newestFiltered, exercise, metricMode)?.unit ?? 'lb' : 'lb'
  const oldestValue = oldestFiltered ? metric(oldestFiltered) : 0
  const newestValue = newestFiltered ? metric(newestFiltered) : 0
  const improvement = relevantWorkouts.length > 1 && oldestValue > 0
    ? Math.round((newestValue - oldestValue) / oldestValue * 100)
    : undefined
  const improvementAbsolute = relevantWorkouts.length > 1 && oldestValue === 0 && newestValue !== oldestValue
    ? newestValue - oldestValue
    : undefined
  const trendLabel = exercise
    ? exercise.name
    : filterId
      ? plans.find((item) => item.id === filterId)?.name ?? 'Selected plan'
      : 'All plans'
  const rows = filteredWorkouts.slice(0, 7).map((workout) => {
    const workoutPlan = plans.find((item) => item.id === workout.planId)!
    const load = workoutVolume(workout)
    const details = workoutPlan.blocks.map((block, blockIndex) => {
      const blockLogs = workout.logs.filter((log) =>
        workoutPlan.exercises.find((exercise) => exercise.id === log.exerciseId)?.blockId === block.id)
      if (!blockLogs.length) return ''
      const exercises = blockLogs.map((log) => {
        const exercise = workoutPlan.exercises.find((item) => item.id === log.exerciseId)
        const setChips = log.sets.map((set, index) => {
          if (!set.completed) return ''
          const result = exercise?.timed
            ? `${set.weight ? `${set.weight} lb · ` : ''}${set.reps} sec`
            : `${set.weight} lb x ${set.reps}`
          return `<span><b>Round ${index + 1}</b>${result}</span>`
        }).join('')
        return `<div class="history-exercise"><strong>${exercise?.name ?? log.exerciseId}</strong><div>${setChips}</div></div>`
      }).join('')
      return `<section class="history-block"><header><span>BLOCK ${blockIndex + 1}</span><strong>${block.name}</strong></header>${exercises}</section>`
    }).join('')
    const expanded = state.expandedWorkoutId === workout.id
    return `<div class="history-item"><button class="history-row ${expanded ? 'expanded' : ''}" data-history="${workout.id}"><span class="history-icon">${icon('weight')}</span><span><strong>${workoutPlan.name}</strong><small>${formatDate(workout.date, { weekday: 'short', month: 'short', day: 'numeric' })}</small></span><span><strong>${workout.logs.length}/${workoutPlan.exercises.length}</strong><small>exercises</small></span><span><strong>${load.toLocaleString()} lb</strong><small>total volume</small></span><span>${workout.durationSeconds ? `<strong>${durationLabel(workout.durationSeconds)}</strong><small>duration</small>` : `<strong>—</strong><small>duration</small>`}</span><span class="history-chevron">${icon('next')}</span></button>${expanded ? `<div class="history-detail"><div class="history-detail-heading"><div><strong>Session breakdown</strong><small>Every completed round</small></div><div class="history-actions"><button data-edit-workout="${workout.id}">Edit</button><button data-delete-workout="${workout.id}">Delete</button></div></div>${details}${workout.note ? `<p class="history-note"><strong>Session note</strong>${escapeHtml(workout.note)}</p>` : ''}</div>` : ''}</div>`
  }).join('')
  const series = relevantWorkouts.slice(0, 8).reverse().map((workout) => ({ date: workout.date, value: metric(workout) }))
  const values = series.map((item) => item.value)
  const max = Math.max(1, ...values)
  const bars = series.length
    ? series.map((item) => {
        const valueLabel = exercise
          ? `${item.value}${metricUnit === 'lb' ? ' lb' : ` ${metricUnit}`}`
          : `${item.value.toLocaleString()} lb`
        return `<div class="chart-column"><span class="chart-value">${valueLabel}</span><div style="height:${Math.max(10, item.value / max * 75)}%"></div><small>${formatDate(item.date, { month: 'short', day: 'numeric' })}</small></div>`
      }).join('')
    : `<p class="empty-chart">${exercise ? 'No logged sets for this exercise yet.' : 'No sessions logged for this plan yet.'}</p>`
  app.innerHTML = shell(`<section class="page">
    <div class="hero compact"><div><p class="eyebrow">YOUR JOURNEY</p><h1>Progress, <em>proven.</em></h1><p>Consistency compounds. Here is the work you've put in.</p></div><div class="view-switch"><button class="${state.progressView === 'trend' ? 'active' : ''}" data-progress-view="trend">Trend</button><button class="${state.progressView === 'compare' ? 'active' : ''}" data-progress-view="compare">Compare days</button></div></div>
    <div class="metrics"><div><span>${icon('calendar')}</span><small>WORKOUTS</small><strong>${workouts.length}</strong><p>all time</p></div><div><span>${icon('trend')}</span><small>TOTAL LOAD</small><strong>${totalLoad.toLocaleString()}</strong><p>${totalHoldSeconds ? `${Math.round(totalHoldSeconds / 60)} min holds tracked separately` : 'weighted reps only'}</p></div><div><span>${icon('bolt')}</span><small>PLANS TRAINED</small><strong>${trainedPlanIds.size}</strong><p>in rotation</p></div><div><span>🔥</span><small>STREAK</small><strong>${streak()}</strong><p>weeks strong</p></div></div>
    <div class="filter-row">${filterChips}</div>
    ${state.progressView === 'compare' ? renderCompareSection(filterPlan, filteredWorkouts) : `${exerciseChips}
    <div class="progress-grid"><section class="panel"><div class="panel-heading"><div><p class="eyebrow">${exercise ? 'EXERCISE TREND' : 'TRAINING LOAD'}</p><h2>${trendLabel}</h2></div><div class="panel-heading-right">${metricToggle}<span>${improvement !== undefined ? `<strong class="${improvement >= 0 ? 'up' : 'down'}">${improvement >= 0 ? '+' : ''}${improvement}%</strong> since ${formatDate(oldestFiltered.date, { month: 'short', day: 'numeric' })}` : improvementAbsolute !== undefined ? `<strong class="${improvementAbsolute >= 0 ? 'up' : 'down'}">${improvementAbsolute >= 0 ? '+' : ''}${improvementAbsolute} ${metricUnit}</strong> since ${formatDate(oldestFiltered.date, { month: 'short', day: 'numeric' })}` : `Last ${values.length} workouts`}</span></div></div><div class="bar-chart">${bars}</div></section><section class="panel goal"><p class="eyebrow">WEEKLY TARGET</p><h2>Build the habit</h2><div><strong>${weekly}</strong><span>/ 3 sessions</span></div><div class="goal-track"><span style="width:${Math.min(100, weekly / 3 * 100)}%"></span></div><p>One strong week at a time. Keep showing up.</p></section></div>
    <section class="panel history"><div class="panel-heading"><div><p class="eyebrow">WORKOUT LOG</p><h2>Recent sessions</h2></div></div><div>${rows || `<p class="empty-chart">No sessions logged for this plan yet.</p>`}</div></section>`}
  </section>`)
}

function escapeHtml(value: string) {
  const element = document.createElement('div')
  element.textContent = value
  return element.innerHTML
}
function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}
function renderCheckIn() {
  const checkIns = [...state.checkIns].sort((a, b) => b.date.localeCompare(a.date))
  const cards = checkIns.map((checkIn) =>
    `<article class="photo-card"><div>${checkIn.photoUrl ? `<img src="${checkIn.photoUrl}" alt="Progress photo from ${formatDate(checkIn.date)}">` : icon('camera')}</div><section><strong>${formatDate(checkIn.date, { month: 'long', day: 'numeric', year: 'numeric' })}</strong><small>${checkIn.bodyWeight ? `${checkIn.bodyWeight} lb` : 'Weight not logged'}</small>${checkIn.note ? `<p>${escapeHtml(checkIn.note)}</p>` : ''}<button data-delete-checkin="${checkIn.id}">Delete check-in</button></section></article>`)
  app.innerHTML = shell(`<section class="page">
    <div class="hero compact"><div><p class="eyebrow">MONDAY RITUAL</p><h1>See the change <em>happen.</em></h1><p>Same place, same lighting, every week. The mirror catches what the scale misses.</p></div></div>
    <div class="checkin-grid">
      <section class="panel upload-panel"><p class="eyebrow">THIS WEEK'S CHECK-IN</p><h2>${now.getDay() === 1 ? "It's check-in day" : 'Log your weekly progress'}</h2><p>Stand relaxed and use consistent lighting and distance.</p>
        <label class="photo-drop" id="photo-drop"><input id="photo-input" type="file" accept="image/*" capture="user"><span>${icon('camera')}</span><strong>Add progress photo</strong><small>Tap to choose or take a photo</small><img id="photo-preview" alt="Selected progress photo"></label>
        <form id="checkin-form"><label class="form-label"><span>BODY WEIGHT <small>OPTIONAL</small></span><div class="input-wrap wide"><input id="body-weight" type="number" min="0" step="0.1" placeholder="e.g. 175"><span>lb</span></div></label><label class="form-label"><span>HOW ARE YOU FEELING?</span><textarea id="checkin-note" maxlength="180" placeholder="Energy, recovery, wins from this week..."></textarea></label><button class="primary" type="submit">${icon('check')} Save weekly check-in</button></form>
      </section>
      <aside class="checkin-aside"><div class="panel reminder"><span>${icon('calendar')}</span><div><p class="eyebrow">CHECK-IN CADENCE</p><h3>Every Monday evening</h3><p>RepTrack shows this reminder when you open the app. Device notifications are not enabled yet.</p></div></div><div class="panel photo-streak"><p class="eyebrow">PHOTO STREAK</p><strong>${checkIns.length}<span> weeks</span></strong><p>${checkIns.length ? 'Your visual timeline is growing.' : 'Your first photo starts the timeline.'}</p></div></aside>
    </div>
    <section class="timeline"><div class="panel-heading"><div><p class="eyebrow">YOUR TIMELINE</p><h2>Week by week</h2></div><span>${checkIns.length} check-ins</span></div><div class="photo-grid">${cards.join('') || `<div class="empty">${icon('camera')}<strong>No photos yet</strong><p>Your progress timeline will appear here after your first check-in.</p></div>`}</div></section>
  </section>`)
}

function render() {
  if (state.activeTab === 'workout') renderWorkout()
  else if (state.activeTab === 'progress') renderProgress()
  else renderCheckIn()
}
function toast(message: string) {
  document.querySelector('.toast')?.remove()
  const element = document.createElement('div')
  element.className = 'toast'
  element.innerHTML = `${icon('check')}<span>${message}</span>`
  document.body.append(element)
  requestAnimationFrame(() => element.classList.add('visible'))
  setTimeout(() => { element.classList.remove('visible'); setTimeout(() => element.remove(), 250) }, 2400)
}

document.addEventListener('click', async (event) => {
  const target = event.target as HTMLElement
  if (target.closest('[data-sign-out]')) {
    try {
      await flushCloudSave()
      await signOut()
      session = null
      state = { ...defaults, workouts: [], checkIns: [], drafts: {} }
      plans = structuredClone(defaultPlans)
      renderAuth()
    } catch (error) {
      console.error('Unable to sign out.', error)
      toast('Sign out paused because cloud save failed.')
    }
    return
  }
  if (target.closest('[data-open-plan-editor]')) {
    state.planEditorOpen = true
    save(); renderWorkout(); return
  }
  if (target.closest('[data-close-plan-editor]')) {
    savePlans()
    state.planEditorOpen = false
    save(); renderWorkout(); toast('Workout plans saved.'); return
  }
  const editorPlanTab = target.closest<HTMLElement>('[data-editor-select-plan]')
  if (editorPlanTab) {
    state.selectedPlanId = editorPlanTab.dataset.editorSelectPlan!
    save(); renderWorkout(); return
  }
  const addEditorExercise = target.closest<HTMLElement>('[data-add-editor-exercise]')
  if (addEditorExercise) {
    const workoutPlan = plan()
    const block = workoutPlan.blocks.find((item) => item.id === addEditorExercise.dataset.addEditorExercise)!
    workoutPlan.exercises.push({
      id: `exercise-${crypto.randomUUID()}`,
      blockId: block.id,
      name: 'New exercise',
      sets: block.rounds,
      reps: '8-12',
      cue: 'Add one short form cue.',
    })
    savePlans(); renderWorkout(); return
  }
  if (target.closest('[data-add-editor-block]')) {
    const workoutPlan = plan()
    const blockId = `block-${crypto.randomUUID()}`
    workoutPlan.blocks.push({ id: blockId, name: 'New block', focus: 'Describe the purpose', rounds: 3 })
    workoutPlan.exercises.push({
      id: `exercise-${crypto.randomUUID()}`,
      blockId,
      name: 'New exercise',
      sets: 3,
      reps: '8-12',
      cue: 'Add one short form cue.',
    })
    savePlans(); renderWorkout(); return
  }
  const viewToggle = target.closest<HTMLElement>('[data-workout-view]')
  if (viewToggle) {
    const previous = {
      drafts: state.drafts,
      sessionStatus: state.sessionStatus,
      workoutNote: state.workoutNote,
      activeStepIndex: state.activeStepIndex,
      workoutView: state.workoutView,
    }
    const nextView = viewToggle.dataset.workoutView as State['workoutView']
    if (nextView === 'focus' && state.sessionStatus !== 'active') {
      if (state.sessionStatus === 'idle') {
        state.drafts = {}
        state.workoutNote = ''
        state.activeStepIndex = 0
        state.sessionStartedAt = Date.now()
      }
      state.sessionStatus = 'active'
    }
    state.workoutView = nextView
    save()
    try {
      await flushCloudSave()
    } catch (error) {
      Object.assign(state, previous)
      console.error('Unable to switch workout mode.', error)
      render()
      toast('Mode change paused because cloud save failed.')
      return
    }
    render()
    toast(`Switched to ${state.workoutView === 'focus' ? 'workout' : 'normal'} mode. Progress saved.`)
    return
  }
  const editWorkoutButton = target.closest<HTMLElement>('[data-edit-workout]')
  if (editWorkoutButton) {
    const workout = state.workouts.find((item) => item.id === editWorkoutButton.dataset.editWorkout)
    const workoutPlan = workout ? plans.find((item) => item.id === workout.planId) : undefined
    if (!workout || !workoutPlan) return
    state.selectedPlanId = workout.planId
    state.drafts = Object.fromEntries(workoutPlan.exercises.map((exercise) => {
      const log = workout.logs.find((item) => item.exerciseId === exercise.id)
      const sets = Array.from({ length: exercise.sets }, (_, index) => {
        const set = log?.sets[index]
        return {
          weight: set?.weight ? String(set.weight) : '',
          reps: set?.reps ? String(set.reps) : exercise.timed ? String(exercise.defaultSeconds ?? 30) : '',
          completed: set?.completed ?? false,
        }
      })
      return [exercise.id, { sets, completed: sets.every((set) => set.completed) }]
    }))
    state.workoutNote = workout.note ?? ''
    state.editingWorkoutId = workout.id
    state.editingWorkoutDate = workout.date
    state.activeStepIndex = 0
    state.sessionStatus = 'active'
    state.workoutView = 'focus'
    state.sessionStartedAt = undefined
    save(); render(); toast('Editing saved workout.'); return
  }
  const deleteWorkoutButton = target.closest<HTMLElement>('[data-delete-workout]')
  if (deleteWorkoutButton) {
    if (!window.confirm('Delete this workout permanently?')) return
    const workoutId = deleteWorkoutButton.dataset.deleteWorkout!
    try {
      await deleteCloudWorkout(workoutId)
      state.workouts = state.workouts.filter((workout) => workout.id !== workoutId)
      state.expandedWorkoutId = undefined
      save(); renderProgress(); toast('Workout deleted.')
    } catch (error) {
      console.error('Unable to delete workout.', error)
      toast('Workout could not be deleted. Check your connection.')
    }
    return
  }
  const deleteCheckInButton = target.closest<HTMLElement>('[data-delete-checkin]')
  if (deleteCheckInButton) {
    if (!window.confirm('Delete this check-in and its photo permanently?')) return
    const checkIn = state.checkIns.find((item) => item.id === deleteCheckInButton.dataset.deleteCheckin)
    if (!checkIn) return
    try {
      const photoDeleted = await deleteCloudCheckIn(checkIn.id, checkIn.photoId)
      state.checkIns = state.checkIns.filter((item) => item.id !== checkIn.id)
      save(); renderCheckIn()
      toast(photoDeleted ? 'Check-in deleted.' : 'Check-in deleted; photo cleanup failed.')
    } catch (error) {
      console.error('Unable to delete check-in.', error)
      toast('Check-in could not be deleted. Check your connection.')
    }
    return
  }
  if (target.closest('[data-start-workout]')) {
    if (state.sessionStatus === 'active') {
      toast('This workout is already in progress.')
      return
    }
    if (state.sessionStatus === 'idle') {
      state.drafts = {}
      state.workoutNote = ''
      state.exerciseTimer = undefined
      state.restTimerEnd = undefined
      state.expandedRoundKey = `${plan().blocks[0].id}:0`
      state.activeStepIndex = 0
      state.workoutView = 'focus'
      state.editingWorkoutId = undefined
      state.editingWorkoutDate = undefined
      state.sessionStartedAt = Date.now()
    }
    state.sessionStatus = 'active'
    save(); render(); return
  }
  const adjustButton = target.closest<HTMLElement>('[data-adjust-exercise]')
  if (adjustButton) {
    const exercise = plan().exercises.find((item) => item.id === adjustButton.dataset.adjustExercise)!
    const current = draft(exercise)
    const sets = current.sets.map((set) => ({ ...set }))
    const setIndex = Number(adjustButton.dataset.adjustSet)
    const field = adjustButton.dataset.adjustField as 'weight' | 'reps'
    const amount = Number(adjustButton.dataset.adjustAmount)
    const value = Math.max(0, (Number(sets[setIndex][field]) || 0) + amount)
    sets[setIndex][field] = Number.isInteger(value) ? String(value) : value.toFixed(1)
    state.drafts[exercise.id] = { ...current, sets }
    save(); renderActiveWorkout(); return
  }
  const completeStep = target.closest<HTMLElement>('[data-complete-step]')
  if (completeStep) {
    const exercise = plan().exercises.find((item) => item.id === completeStep.dataset.completeStep)!
    updateSetCompletion(exercise, Number(completeStep.dataset.set), true)
    save(); render(); return
  }
  const stepNavigation = target.closest<HTMLElement>('[data-step-nav]')
  if (stepNavigation) {
    const steps = workoutSteps(plan())
    state.activeStepIndex = Math.max(0, Math.min(steps.length, state.activeStepIndex + Number(stepNavigation.dataset.stepNav)))
    save(); render(); return
  }
  const exerciseTimerButton = target.closest<HTMLElement>('[data-exercise-timer]')
  if (exerciseTimerButton) {
    const exercise = plan().exercises.find((item) => item.id === exerciseTimerButton.dataset.exerciseTimer)!
    const current = draft(exercise)
    const requestedSet = exerciseTimerButton.dataset.timerSet
    const setIndex = requestedSet === undefined ? Math.max(0, current.sets.findIndex((set) => !set.completed)) : Number(requestedSet)
    const seconds = Number(current.sets[setIndex]?.reps) || exercise.defaultSeconds || 30
    state.exerciseTimer = {
      end: Date.now() + seconds * 1000,
      remaining: seconds,
      label: `${exercise.name} · Set ${setIndex + 1}`,
      exerciseId: exercise.id,
      setIndex,
    }
    state.restTimerEnd = undefined
    save(); render(); return
  }
  const roundButton = target.closest<HTMLElement>('[data-round]')
  if (roundButton) {
    state.expandedRoundKey = roundButton.dataset.round
    save(); renderWorkout(); return
  }
  if (target.closest('[data-pause-exercise]') && state.exerciseTimer) {
    if (state.exerciseTimer.end) {
      state.exerciseTimer.remaining = exerciseTimerSeconds()
      state.exerciseTimer.end = undefined
    } else {
      state.exerciseTimer.end = Date.now() + state.exerciseTimer.remaining * 1000
    }
    save(); render(); return
  }
  if (target.closest('[data-add-exercise]') && state.exerciseTimer) {
    if (state.exerciseTimer.end) state.exerciseTimer.end += 10_000
    state.exerciseTimer.remaining += 10
    save(); render(); return
  }
  if (target.closest('[data-stop-exercise]')) {
    state.exerciseTimer = undefined
    save(); render(); return
  }
  if (target.closest('[data-add-rest]')) {
    state.restTimerEnd = Math.max(Date.now(), state.restTimerEnd ?? Date.now()) + 30_000
    save(); render(); return
  }
  if (target.closest('[data-skip-rest]')) {
    state.restTimerEnd = undefined
    save(); render(); return
  }
  if (target.closest('[data-save-draft]')) {
    state.sessionStatus = 'paused'
    state.exerciseTimer = undefined
    state.restTimerEnd = undefined
    save(); toast('Workout saved. Resume whenever you are ready.'); render(); return
  }
  if (target.closest('[data-discard-session]')) {
    const confirmed = window.confirm('Discard this workout? All unsaved sets, weights, and reps will be removed.')
    if (!confirmed) return
    state.drafts = {}
    state.sessionStatus = 'idle'
    state.workoutNote = ''
    state.restTimerEnd = undefined
    state.exerciseTimer = undefined
    state.expandedRoundKey = undefined
    state.activeStepIndex = 0
    state.workoutView = 'focus'
    state.editingWorkoutId = undefined
    state.editingWorkoutDate = undefined
    state.sessionStartedAt = undefined
    save(); toast('Workout discarded.'); render(); return
  }
  const historyButton = target.closest<HTMLElement>('[data-history]')
  if (historyButton) {
    state.expandedWorkoutId = state.expandedWorkoutId === historyButton.dataset.history ? undefined : historyButton.dataset.history
    save(); renderProgress(); return
  }
  const progressFilter = target.closest<HTMLElement>('[data-progress-plan]')
  if (progressFilter) {
    state.progressFilterPlanId = progressFilter.dataset.progressPlan || undefined
    state.progressFilterExerciseId = undefined
    state.compareWorkoutIdA = undefined
    state.compareWorkoutIdB = undefined
    renderProgress(); return
  }
  const progressViewToggle = target.closest<HTMLElement>('[data-progress-view]')
  if (progressViewToggle) {
    state.progressView = progressViewToggle.dataset.progressView as 'trend' | 'compare'
    renderProgress(); return
  }
  const compareA = target.closest<HTMLElement>('[data-compare-a]')
  if (compareA) {
    state.compareWorkoutIdA = compareA.dataset.compareA
    renderProgress(); return
  }
  const compareB = target.closest<HTMLElement>('[data-compare-b]')
  if (compareB) {
    state.compareWorkoutIdB = compareB.dataset.compareB
    renderProgress(); return
  }
  const progressExerciseFilter = target.closest<HTMLElement>('[data-progress-exercise]')
  if (progressExerciseFilter) {
    state.progressFilterExerciseId = progressExerciseFilter.dataset.progressExercise || undefined
    renderProgress(); return
  }
  const progressMetricToggle = target.closest<HTMLElement>('[data-progress-metric]')
  if (progressMetricToggle && state.progressFilterExerciseId) {
    state.progressMetricModeByExercise = {
      ...state.progressMetricModeByExercise,
      [state.progressFilterExerciseId]: progressMetricToggle.dataset.progressMetric as 'max' | 'avg',
    }
    renderProgress(); return
  }
  const tab = target.closest<HTMLElement>('[data-tab]')
  if (tab) {
    state.activeTab = tab.dataset.tab as State['activeTab']
    save(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return
  }
  const planButton = target.closest<HTMLElement>('[data-plan]')
  if (planButton) {
    if (state.sessionStatus !== 'idle') return
    state.selectedPlanId = planButton.dataset.plan!
    state.drafts = {}
    state.expandedRoundKey = undefined
    state.activeStepIndex = 0
    state.workoutView = 'focus'
    state.editingWorkoutId = undefined
    state.editingWorkoutDate = undefined
    save(); render(); return
  }
  const complete = target.closest<HTMLElement>('[data-complete]')
  if (complete) {
    const exercise = plan().exercises.find((item) => item.id === complete.dataset.complete)!
    const current = draft(exercise)
    const completed = !current.completed
    state.drafts[exercise.id] = {
      completed,
      sets: current.sets.map((set) => ({ ...set, completed })),
    }
    save(); render(); return
  }
  const setButton = target.closest<HTMLElement>('[data-toggle-set]')
  if (setButton) {
    const exercise = plan().exercises.find((item) => item.id === setButton.dataset.toggleSet)!
    const setIndex = Number(setButton.dataset.set)
    const completed = !draft(exercise).sets[setIndex].completed
    if (state.exerciseTimer?.exerciseId === exercise.id && state.exerciseTimer.setIndex === setIndex) {
      state.exerciseTimer = undefined
    }
    updateSetCompletion(exercise, setIndex, completed)
    save(); render(); return
  }
  if (target.closest('#finish-workout')) {
    const active = plan()
    const logs = active.exercises.map((exercise) => {
      const current = draft(exercise)
      return {
        exerciseId: exercise.id,
        sets: current.sets.map((set) => ({
          weight: Number(set.weight) || 0,
          reps: Number(set.reps) || 0,
          completed: set.completed,
        })),
        completed: current.completed,
      }
    }).filter((log) => log.sets.some((set) => set.completed))
    if (!logs.length) return
    const workoutDate = state.editingWorkoutDate ?? dayKey(now)
    const workoutId = state.editingWorkoutId ?? `workout-${workoutDate}-${active.id}-${crypto.randomUUID()}`
    const durationSeconds = state.editingWorkoutId
      ? state.workouts.find((item) => item.id === state.editingWorkoutId)?.durationSeconds
      : state.sessionStartedAt
        ? Math.max(0, Math.round((Date.now() - state.sessionStartedAt) / 1000))
        : undefined
    const workout = {
      id: workoutId,
      planId: active.id,
      date: workoutDate,
      logs,
      note: state.workoutNote.trim() || undefined,
      durationSeconds,
    }
    try {
      await saveCloudWorkout(workout)
    } catch (error) {
      console.error('Unable to save workout.', error)
      toast('Workout was not saved. Your draft is still available.')
      return
    }
    if (state.editingWorkoutId) {
      state.workouts = state.workouts.filter((item) => item.id !== state.editingWorkoutId)
    }
    state.workouts.push(workout)
    state.drafts = {}
    state.sessionStatus = 'idle'
    state.workoutNote = ''
    state.restTimerEnd = undefined
    state.exerciseTimer = undefined
    state.expandedRoundKey = undefined
    state.activeStepIndex = 0
    state.workoutView = 'focus'
    state.editingWorkoutId = undefined
    state.editingWorkoutDate = undefined
    state.sessionStartedAt = undefined
    save(); toast('Workout saved. Strong work.'); render()
  }
})
document.addEventListener('input', (event) => {
  const input = event.target as HTMLInputElement
  const editorProp = input.dataset.editorProp
  if (editorProp) {
    const workoutPlan = plans.find((item) => item.id === input.dataset.editorPlan) ?? plan()
    if (input.dataset.editorPlan) {
      if (editorProp === 'name' || editorProp === 'focus') workoutPlan[editorProp] = input.value
    } else if (input.dataset.editorBlock) {
      const block = workoutPlan.blocks.find((item) => item.id === input.dataset.editorBlock)
      if (!block) return
      if (editorProp === 'rounds') {
        block.rounds = Math.max(1, Math.min(10, Number(input.value) || 1))
        workoutPlan.exercises.filter((exercise) => exercise.blockId === block.id).forEach((exercise) => {
          exercise.sets = block.rounds
        })
      } else if (editorProp === 'name' || editorProp === 'focus') {
        block[editorProp] = input.value
      }
    } else if (input.dataset.editorExercise) {
      const exercise = workoutPlan.exercises.find((item) => item.id === input.dataset.editorExercise)
      if (!exercise) return
      if (editorProp === 'timed') {
        exercise.timed = input.checked
        exercise.defaultSeconds = input.checked ? Number(exercise.reps.match(/\d+/)?.[0] ?? 30) : undefined
      } else if (editorProp === 'name' || editorProp === 'reps' || editorProp === 'cue') {
        exercise[editorProp] = input.value
      }
    }
    savePlans()
    return
  }
  if (input.matches('[data-exercise][data-set][data-field]')) {
    const exercise = plan().exercises.find((item) => item.id === input.dataset.exercise)!
    const current = draft(exercise)
    const sets = current.sets.map((set) => ({ ...set }))
    const setIndex = Number(input.dataset.set)
    const field = input.dataset.field as 'weight' | 'reps'
    sets[setIndex][field] = input.value
    state.drafts[exercise.id] = { ...current, sets }
    save()
  }
  if (input.id === 'workout-note') {
    state.workoutNote = input.value
    save()
  }
  if (input.id === 'photo-input' && input.files?.[0]) {
    void preparePhoto(input.files[0]).then(({ blob, previewUrl }) => {
      pendingPhotoBlob = blob
      const preview = document.querySelector<HTMLImageElement>('#photo-preview')
      if (preview) {
        preview.src = previewUrl
        preview.classList.add('visible')
        document.querySelector('#photo-drop')?.classList.add('has-photo')
      }
    }).catch((error: unknown) => {
      console.error('Unable to prepare progress photo.', error)
      toast('Unable to process that photo.')
    })
  }
})
document.addEventListener('submit', async (event) => {
  const form = event.target as HTMLFormElement
  if (form.id === 'auth-form') {
    event.preventDefault()
    const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null
    const action = submitter?.dataset.authAction ?? 'sign-in'
    const email = document.querySelector<HTMLInputElement>('#auth-email')?.value.trim() ?? ''
    const password = document.querySelector<HTMLInputElement>('#auth-password')?.value ?? ''
    renderLoading(action === 'sign-up' ? 'Creating your account...' : 'Loading your training...')
    try {
      const nextSession = action === 'sign-up' ? await signUp(email, password) : await signIn(email, password)
      if (!nextSession) {
        renderAuth('Check your email to confirm the account, then sign in.')
        return
      }
      session = nextSession
      await loadUserData()
    } catch (error) {
      renderAuth(error instanceof Error ? error.message : 'Authentication failed.')
    }
    return
  }
  if (form.id !== 'checkin-form') return
  event.preventDefault()
  if (!pendingPhotoBlob) { toast('Add a progress photo before saving.'); return }
  const checkInId = crypto.randomUUID()
  const bodyWeight = Number(document.querySelector<HTMLInputElement>('#body-weight')?.value) || undefined
  const note = document.querySelector<HTMLTextAreaElement>('#checkin-note')?.value.trim() ?? ''
  try {
    const photoPath = await saveCloudCheckIn({
      id: checkInId,
      date: dayKey(now),
      bodyWeight,
      note,
      photoId: '',
    }, pendingPhotoBlob)
    pendingPhotoBlob = undefined
    await loadUserData()
    toast('Check-in securely saved to the cloud.')
    if (!photoPath) return
  } catch (error) {
    console.error('Unable to save check-in.', error)
    toast('Check-in upload failed. Nothing was saved.')
  }
})

async function preparePhoto(file: File) {
  const bitmap = await createImageBitmap(file)
  const maxDimension = 1600
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Image compression is not supported by this browser.')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Image compression failed.')), 'image/webp', 0.82)
  })
  return { blob, previewUrl: URL.createObjectURL(blob) }
}

async function loadUserData() {
  const data = await loadCloudData(defaultPlans)
  plans = Array.isArray(data.settings.plans) && data.settings.plans.length
    ? data.settings.plans as Plan[]
    : structuredClone(defaultPlans)
  const draftState = data.settings.draft as Partial<State>
  const selectedPlanId = plans.some((item) => item.id === draftState.selectedPlanId)
    ? draftState.selectedPlanId!
    : plans[0].id
  state = {
    ...defaults,
    ...draftState,
    selectedPlanId,
    workouts: data.workouts.map((workout) => normalizeWorkout(workout as Workout)),
    checkIns: data.checkIns,
    drafts: normalizeDrafts(draftState.drafts ?? {}),
    planEditorOpen: false,
  }
  render()
}

async function initialize() {
  if (!cloudConfigured) {
    renderAuth()
    return
  }
  renderLoading('Loading your training...')
  try {
    session = await currentSession()
    if (!session) {
      renderAuth()
    } else {
      await loadUserData()
    }
    onAuthChange((nextSession) => {
      if (session?.access_token === nextSession?.access_token) return
      const wasSignedIn = Boolean(session)
      session = nextSession
      if (session && !wasSignedIn) {
        window.setTimeout(() => {
          void loadUserData().catch((error: unknown) => {
            console.error('Unable to load cloud data after sign-in.', error)
            renderAuth('Signed in, but cloud data could not be loaded. Check your connection.')
          })
        }, 0)
      }
      else if (!session) renderAuth()
    })
  } catch (error) {
    console.error('Unable to initialize cloud data.', error)
    renderAuth('Unable to connect to the cloud backend. Check your Supabase configuration.')
  }
}

void initialize()

window.setInterval(() => {
  if (state.sessionStatus === 'active' && state.sessionStartedAt) {
    const label = durationLabel(sessionElapsedSeconds())
    document.querySelectorAll<HTMLElement>('[data-session-clock]').forEach((clock) => { clock.textContent = label })
  }
  if (state.exerciseTimer) {
    const remaining = exerciseTimerSeconds()
    const clock = document.querySelector<HTMLElement>('[data-exercise-clock]')
    if (clock) clock.textContent = restLabel(remaining)
    if (state.exerciseTimer.end && remaining === 0) {
      const { exerciseId, setIndex } = state.exerciseTimer
      const exercise = plans.flatMap((item) => item.exercises).find((item) => item.id === exerciseId)
      if (exercise) {
        updateSetCompletion(exercise, setIndex, true)
      }
      state.exerciseTimer = undefined
      save()
      render()
      toast(state.restTimerEnd ? 'Round complete. Rest started.' : 'Timed set complete. Next exercise.')
    }
    return
  }
  if (!state.restTimerEnd) return
  const remaining = restSeconds()
  const clock = document.querySelector<HTMLElement>('[data-rest-clock]')
  if (clock) clock.textContent = restLabel(remaining)
  if (remaining === 0) {
    state.restTimerEnd = undefined
    save()
    render()
    toast('Rest complete. Next set.')
  }
}, 1000)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.error('Unable to register the offline service worker.', error)
    })
  })
}
