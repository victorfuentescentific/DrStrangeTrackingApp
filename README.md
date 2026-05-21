# Dr. Strange Portal

EU LLM Data team portal for workset tracking, time-off management, hour submissions, and Claude-assisted automation.

## Quick Start

```bash
cd DrStrangeTrackingApp
npm install
npm run dev
```

Open http://localhost:3000

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — stats, upcoming ETAs, owner workload |
| `/worksets` | Full workset list with filters |
| `/worksets/new` | Create a new workset |
| `/worksets/[id]` | Detail view with edit + audit trail |
| `/planner` | Kanban board (by status) |
| `/reports` | Daily summary + weekly risk report |
| `/claude` | Claude AI assistant (simulated) |

## Features

- Create, edit, delete, view worksets with full field set
- Kanban board organized by status
- Smart filters: owner, project, locale, status, priority, risk, blocked, escalated
- Auto-detects overdue worksets on load
- In-app notification panel (bell icon → top right)
- Role switcher in header for demo (Admin / PM / Lead / Viewer)
- Claude assistant with 9 command types + JSON output
- Daily summary and weekly risk report generation
- Export worksets as JSON
- All data persisted in browser localStorage

## Claude Commands (MVP Simulation)

```json
{ "command": "daily_summary" }
{ "command": "weekly_report" }
{ "command": "get_overdue" }
{ "command": "get_blocked" }
{ "command": "get_at_risk" }
{ "command": "suggest_actions" }
{ "command": "generate_reminder", "params": { "worksetId": "WS-001" } }
{ "command": "generate_escalation", "params": { "worksetId": "WS-012" } }
{ "command": "create_workset", "params": { "name": "...", "locale": "...", "eta": "YYYY-MM-DD" } }
```

## Phase 2 Additions (Not in MVP)

- Supabase / PostgreSQL database
- Clerk authentication
- Claude API (real `claude-sonnet-4-6` calls)
- Email via Resend/SendGrid
- Microsoft Teams via Graph API
- Real-time updates via Supabase Realtime
- Drag-and-drop Kanban

## Tech Stack

- Next.js 15 · React 19 · TypeScript
- Zustand (localStorage persist)
- Tailwind CSS v3
- Lucide React icons
- date-fns
