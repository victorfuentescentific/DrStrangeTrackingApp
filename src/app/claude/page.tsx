'use client'

import { AppLayout } from '@/components/layout/AppLayout'
import { ClaudeAssistant } from '@/components/claude/ClaudeAssistant'

export default function ClaudePage() {
  return (
    <AppLayout
      title="Claude AI Assistant"
      subtitle="Simulate Claude-powered PM automation · Phase 2 connects the real Claude API"
    >
      <ClaudeAssistant />
    </AppLayout>
  )
}
