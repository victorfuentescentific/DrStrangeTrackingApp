import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'WorksetPM — ETA Tracker',
  description: 'PM Workset ETA tracking, risk management, and Claude-assisted automation',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen">
        {children}
      </body>
    </html>
  )
}
