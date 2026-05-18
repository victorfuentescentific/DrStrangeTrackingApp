import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.SUPABASE_URL
const supabaseKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.\n' +
    'Copy .env.example to .env.local and fill in your Supabase project details.'
  )
}

// Service-role client — server-side only. Never expose to the browser.
export const db = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
})
