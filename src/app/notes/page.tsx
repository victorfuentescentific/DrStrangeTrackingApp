'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpenText, ExternalLink, Link as LinkIcon, Plus, Trash2,
  StickyNote, Save, Check, Loader2,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'

// ─────────────────────────────────────────────────────────────────────────────
// Notes & Links — team workspace shortcut page.
//
// Confluence space URL is read from NEXT_PUBLIC_CONFLUENCE_URL at build time;
// fall back to a placeholder so the page still renders during local dev or if
// the env var isn't set yet. Set the real URL in Vercel:
//   Project → Settings → Environment Variables → add NEXT_PUBLIC_CONFLUENCE_URL
//
// Custom links and notes are stored in localStorage (per-browser). Move to
// Supabase later if we need shared/team-wide links.
// ─────────────────────────────────────────────────────────────────────────────

const CONFLUENCE_URL = process.env.NEXT_PUBLIC_CONFLUENCE_URL
  || 'https://centific.atlassian.net/wiki/spaces/EULLMDATA'

const LINKS_KEY = 'drstrange.notes.links'
const NOTES_KEY = 'drstrange.notes.body'

interface SavedLink {
  id: string
  label: string
  url: string
}

export default function NotesPage() {
  const router = useRouter()
  const [authed,  setAuthed]  = useState(false)
  const [links,   setLinks]   = useState<SavedLink[]>([])
  const [notes,   setNotes]   = useState('')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newUrl,   setNewUrl]   = useState('')

  // Auth gate — only require a login, no role restriction
  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (r.status === 401) { router.push('/login'); return null }
      return r.json()
    }).then(me => {
      if (me) setAuthed(true)
    })
  }, [router])

  // Load from localStorage on first render
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(LINKS_KEY)
      if (raw) setLinks(JSON.parse(raw))
      const noteRaw = window.localStorage.getItem(NOTES_KEY)
      if (noteRaw) setNotes(noteRaw)
    } catch {
      // ignore corrupt storage
    }
  }, [])

  // Persist links any time they change
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(LINKS_KEY, JSON.stringify(links))
  }, [links])

  // Debounced notes save (250ms)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const t = setTimeout(() => {
      window.localStorage.setItem(NOTES_KEY, notes)
      setSavedAt(Date.now())
    }, 250)
    return () => clearTimeout(t)
  }, [notes])

  const addLink = useCallback(() => {
    const label = newLabel.trim()
    let url = newUrl.trim()
    if (!label || !url) return
    // Add https:// if user didn't provide a scheme
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    setLinks(ls => [...ls, { id: Date.now().toString(36), label, url }])
    setNewLabel('')
    setNewUrl('')
  }, [newLabel, newUrl])

  const removeLink = useCallback((id: string) => {
    setLinks(ls => ls.filter(l => l.id !== id))
  }, [])

  if (!authed) {
    return (
      <AppLayout title="Notes & Links" subtitle="Team workspace">
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Notes & Links" subtitle="Team knowledge base shortcuts and personal notes">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Confluence card — prominent */}
        <a
          href={CONFLUENCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block group"
        >
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent-900 via-accent-800 to-deep-900 border border-accent-700/50 p-6 shadow-lg hover:shadow-xl transition-all">
            {/* Subtle amber glow on hover */}
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-brand-500/10 blur-3xl group-hover:bg-brand-500/20 transition-colors" />
            <div className="relative flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-brand-500/15 border border-brand-300/30 flex items-center justify-center flex-shrink-0">
                  <BookOpenText className="w-6 h-6 text-brand-200" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-brand-200/70">
                    Internal Knowledge Base
                  </div>
                  <div className="text-xl font-semibold text-brand-100 mt-0.5 tracking-tight">
                    Open Confluence
                  </div>
                  <div className="text-xs text-accent-100/60 mt-1 font-mono truncate max-w-[400px]">
                    {CONFLUENCE_URL}
                  </div>
                </div>
              </div>
              <ExternalLink className="w-5 h-5 text-brand-200/60 group-hover:text-brand-200 group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </a>

        {/* Useful links + Notes side by side on wide screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Useful links */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-brand-600" />
                <h2 className="text-sm font-semibold text-slate-900">Saved Links</h2>
                <span className="ml-auto text-[11px] text-slate-400">{links.length}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Personal shortcuts — stored in your browser.
              </p>
            </div>

            {/* List */}
            <div className="divide-y divide-slate-100">
              {links.length === 0 ? (
                <p className="text-sm text-slate-400 italic px-5 py-6 text-center">
                  No saved links yet. Add one below.
                </p>
              ) : (
                links.map(l => (
                  <div key={l.id} className="group flex items-center gap-2 px-5 py-2.5 hover:bg-slate-50/60 transition-colors">
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-0 flex items-center gap-2 text-sm text-slate-700 hover:text-brand-700"
                    >
                      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-slate-400 group-hover:text-brand-500" />
                      <span className="font-medium truncate">{l.label}</span>
                      <span className="text-xs text-slate-400 truncate">{l.url.replace(/^https?:\/\//, '')}</span>
                    </a>
                    <button
                      onClick={() => removeLink(l.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add form */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/40">
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  placeholder="Label"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addLink() }}
                  className="flex-1 min-w-[100px] px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400"
                />
                <input
                  type="text"
                  placeholder="https://…"
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addLink() }}
                  className="flex-[2] min-w-[180px] px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400"
                />
                <button
                  onClick={addLink}
                  disabled={!newLabel.trim() || !newUrl.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-brand-600 hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400 text-white transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-brand-600" />
                <h2 className="text-sm font-semibold text-slate-900">Quick Notes</h2>
              </div>
              {savedAt && (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <Check className="w-3 h-3 text-green-500" />
                  Saved
                </span>
              )}
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Jot down anything — meeting notes, follow-ups, links to revisit…"
              className="flex-1 w-full px-5 py-4 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none resize-none rounded-b-2xl min-h-[300px] leading-relaxed"
            />
            <div className="px-5 pb-3 -mt-1">
              <p className="text-[10px] text-slate-400 inline-flex items-center gap-1">
                <Save className="w-3 h-3" />
                Auto-saves locally · clears if you sign out from another browser
              </p>
            </div>
          </div>

        </div>

        {/* Footer hint about Confluence URL config */}
        <div className="text-[11px] text-slate-400 text-center pt-2">
          To change the Confluence link, set{' '}
          <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">NEXT_PUBLIC_CONFLUENCE_URL</code>{' '}
          in Vercel → Project Settings → Environment Variables.
        </div>

      </div>
    </AppLayout>
  )
}
