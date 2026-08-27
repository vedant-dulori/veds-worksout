import { createClient, type Session } from '@supabase/supabase-js'

export type CloudWorkout = {
  id: string
  planId: string
  date: string
  logs: unknown[]
  note?: string
  durationSeconds?: number
}

export type CloudCheckIn = {
  id: string
  date: string
  bodyWeight?: number
  note: string
  photoId: string
  photoUrl?: string
}

export type CloudSettings = {
  plans: unknown[]
  draft: Record<string, unknown>
}

const supabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL
  || import.meta.env.NEXT_PUBLIC_SUPABASE_URL
) as string | undefined
const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY
  || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
) as string | undefined

export const cloudConfigured = Boolean(
  supabaseUrl
  && supabaseAnonKey
  && !supabaseUrl.includes('YOUR_PROJECT')
  && !supabaseAnonKey.includes('YOUR_PUBLIC'),
)

export const supabase = cloudConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : undefined

function client() {
  if (!supabase) throw new Error('Supabase environment variables are not configured.')
  return supabase
}

export async function currentSession() {
  const { data, error } = await client().auth.getSession()
  if (error) throw error
  return data.session
}

export async function signIn(email: string, password: string) {
  const { data, error } = await client().auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session
}

export async function signUp(email: string, password: string) {
  const { data, error } = await client().auth.signUp({ email, password })
  if (error) throw error
  return data.session
}

export async function signOut() {
  const { error } = await client().auth.signOut()
  if (error) throw error
}

export function onAuthChange(callback: (session: Session | null) => void) {
  return client().auth.onAuthStateChange((_event, session) => callback(session)).data.subscription
}

export async function loadCloudData(defaultPlans: unknown[]) {
  const [{ data: settings, error: settingsError }, { data: workouts, error: workoutsError }, { data: checkIns, error: checkInsError }] =
    await Promise.all([
      client().from('user_settings').select('plans,draft').maybeSingle(),
      client().from('workouts').select('id,plan_id,performed_on,logs,note,duration_seconds').order('performed_on', { ascending: false }),
      client().from('check_ins').select('id,checked_in_on,body_weight,note,photo_path').order('checked_in_on', { ascending: false }),
    ])

  if (settingsError) throw settingsError
  if (workoutsError) throw workoutsError
  if (checkInsError) throw checkInsError

  const signedCheckIns = await Promise.all((checkIns ?? []).map(async (checkIn) => {
    let photoUrl: string | undefined
    if (checkIn.photo_path) {
      const { data, error } = await client().storage.from('progress-photos').createSignedUrl(checkIn.photo_path, 3600)
      if (error) throw error
      photoUrl = data.signedUrl
    }
    return {
      id: checkIn.id,
      date: checkIn.checked_in_on,
      bodyWeight: checkIn.body_weight ?? undefined,
      note: checkIn.note,
      photoId: checkIn.photo_path,
      photoUrl,
    } satisfies CloudCheckIn
  }))

  return {
    settings: {
      plans: settings?.plans ?? defaultPlans,
      draft: settings?.draft ?? {},
    } satisfies CloudSettings,
    workouts: (workouts ?? []).map((workout) => ({
      id: workout.id,
      planId: workout.plan_id,
      date: workout.performed_on,
      logs: workout.logs,
      note: workout.note ?? undefined,
      durationSeconds: workout.duration_seconds ?? undefined,
    })) satisfies CloudWorkout[],
    checkIns: signedCheckIns,
  }
}

export async function saveCloudSettings(plans: unknown[], draft: Record<string, unknown>) {
  const { error } = await client().from('user_settings').upsert({
    plans,
    draft,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function saveCloudWorkout(workout: CloudWorkout) {
  const { error } = await client().from('workouts').upsert({
    id: workout.id,
    plan_id: workout.planId,
    performed_on: workout.date,
    logs: workout.logs,
    note: workout.note ?? '',
    duration_seconds: workout.durationSeconds ?? null,
  })
  if (error) throw error
}

export async function deleteCloudWorkout(workoutId: string) {
  const { error } = await client().from('workouts').delete().eq('id', workoutId)
  if (error) throw error
}

export async function saveCloudCheckIn(checkIn: Omit<CloudCheckIn, 'photoUrl'>, photo: Blob) {
  const session = await currentSession()
  if (!session) throw new Error('Sign in before uploading a check-in.')
  const extension = photo.type === 'image/webp' ? 'webp' : 'jpg'
  const photoPath = `${session.user.id}/${checkIn.id}.${extension}`
  const { error: uploadError } = await client().storage.from('progress-photos').upload(photoPath, photo, {
    contentType: photo.type,
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { error: insertError } = await client().from('check_ins').insert({
    id: checkIn.id,
    checked_in_on: checkIn.date,
    body_weight: checkIn.bodyWeight ?? null,
    note: checkIn.note,
    photo_path: photoPath,
  })
  if (insertError) {
    await client().storage.from('progress-photos').remove([photoPath])
    throw insertError
  }

  return photoPath
}

export async function deleteCloudCheckIn(checkInId: string, photoPath: string) {
  const { error: deleteError } = await client().from('check_ins').delete().eq('id', checkInId)
  if (deleteError) throw deleteError
  if (photoPath) {
    const { error: storageError } = await client().storage.from('progress-photos').remove([photoPath])
    if (storageError) console.error('Unable to remove the stored progress photo.', storageError)
    return !storageError
  }
  return true
}
