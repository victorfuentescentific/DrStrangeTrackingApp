'use client'

import { useState } from 'react'
import { Bot, Send, Copy, CheckCheck, ChevronDown, Zap, AlertCircle } from 'lucide-react'
import { useStore } from '@/lib/store'
import { ClaudeCommand, ClaudeCommandResult } from '@/lib/types'
import { EXAMPLE_COMMANDS } from '@/lib/claude-simulator'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')
}

export function ClaudeAssistant() {
  const { processClaudeCommand } = useStore()
  const [input, setInput] = useState(JSON.stringify({ command: 'daily_summary' }, null, 2))
  const [result, setResult] = useState<ClaudeCommandResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showExamples, setShowExamples] = useState(true)
  const [tab, setTab] = useState<'json' | 'prompt'>('json')
  const [promptText, setPromptText] = useState('')

  const handleRun = () => {
    setLoading(true)
    setResult(null)
    setTimeout(() => {
      try {
        let cmd: ClaudeCommand
        if (tab === 'json') {
          cmd = JSON.parse(input) as ClaudeCommand
        } else {
          cmd = { command: 'parse_notes', rawPrompt: promptText }
        }
        const res = processClaudeCommand(cmd)
        setResult(res)
      } catch {
        setResult({ success: false, output: 'Invalid JSON command.', error: 'PARSE_ERROR' })
      }
      setLoading(false)
    }, 600)
  }

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result.output)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const loadExample = (cmd: ClaudeCommand) => {
    setInput(JSON.stringify(cmd, null, 2))
    setTab('json')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-full">
      {/* Left: Input */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-5 h-5 text-brand-400" />
            <h2 className="font-semibold">Claude AI Assistant</h2>
            <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-medium ml-auto">
              Simulated
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Send structured commands to generate summaries, reminders, escalations, and insights from your live workset data.
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-400">
            <AlertCircle className="w-3 h-3" />
            MVP mode: responses are simulated. Connect Claude API in Phase 2.
          </div>
        </div>

        {/* Input tabs */}
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col">
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setTab('json')}
              className={cn('px-4 py-2.5 text-sm font-medium transition-colors',
                tab === 'json' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-500 hover:text-slate-700')}
            >
              JSON Command
            </button>
            <button
              onClick={() => setTab('prompt')}
              className={cn('px-4 py-2.5 text-sm font-medium transition-colors',
                tab === 'prompt' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-500 hover:text-slate-700')}
            >
              Free Text
            </button>
          </div>

          <div className="p-4 flex-1">
            {tab === 'json' ? (
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                rows={10}
                spellCheck={false}
                className="w-full text-xs font-mono bg-slate-800 text-green-400 p-3 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            ) : (
              <textarea
                value={promptText}
                onChange={e => setPromptText(e.target.value)}
                rows={10}
                placeholder="Paste meeting notes, project updates, or questions here..."
                className="w-full text-sm border border-slate-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            )}
          </div>

          <div className="px-4 pb-4">
            <Button
              variant="primary"
              className="w-full"
              onClick={handleRun}
              loading={loading}
              icon={<Send className="w-4 h-4" />}
            >
              {loading ? 'Processing...' : 'Run Command'}
            </Button>
          </div>
        </div>

        {/* Examples */}
        <div className="bg-white rounded-xl border border-slate-200">
          <button
            onClick={() => setShowExamples(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-brand-500" />
              <span className="text-sm font-semibold text-slate-700">Example Commands</span>
            </div>
            <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', showExamples ? 'rotate-180' : '')} />
          </button>
          {showExamples && (
            <div className="px-4 pb-4 flex flex-wrap gap-2">
              {EXAMPLE_COMMANDS.map(ex => (
                <button
                  key={ex.label}
                  onClick={() => loadExample(ex.command)}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Output */}
      <div className="lg:col-span-3">
        <div className="bg-white rounded-xl border border-slate-200 h-full flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-2 h-2 rounded-full',
                result ? (result.success ? 'bg-green-500' : 'bg-red-500') : 'bg-slate-300',
              )} />
              <h3 className="font-semibold text-slate-800">Output</h3>
              {result && (
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                  result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
                )}>
                  {result.success ? 'Success' : 'Error'}
                </span>
              )}
            </div>
            {result && result.success && (
              <Button variant="ghost" size="sm" onClick={handleCopy} icon={copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}>
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {!result && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 py-12">
                <Bot className="w-12 h-12 mb-3" />
                <p className="text-sm">Run a command to see output here</p>
                <p className="text-xs mt-1">Try "Daily Summary" from the examples above</p>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center h-full py-12">
                <div className="flex items-center gap-3 text-slate-400">
                  <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Claude is processing…</span>
                </div>
              </div>
            )}

            {result && !loading && (
              <div className="space-y-4">
                {/* Main output */}
                <div className="prose prose-sm max-w-none">
                  <div
                    className="markdown text-sm text-slate-700 whitespace-pre-wrap leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(result.output) }}
                  />
                </div>

                {/* Suggested actions */}
                {result.actions && result.actions.length > 0 && (
                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Suggested Actions</p>
                    <div className="flex flex-wrap gap-2">
                      {result.actions.map(action => (
                        <button
                          key={action}
                          className="text-xs px-3 py-1.5 rounded-lg border border-brand-200 text-brand-600 hover:bg-brand-50 transition-colors"
                          onClick={() => alert(`"${action}" — Connect real integrations in Phase 2 to enable this action.`)}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error */}
                {result.error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-600">
                    <strong>Error:</strong> {result.error}
                  </div>
                )}

                {/* Raw data toggle */}
                {result.data !== undefined && (
                  <details className="text-xs">
                    <summary className="text-slate-400 cursor-pointer hover:text-slate-600">View raw data</summary>
                    <pre className="mt-2 bg-slate-800 text-green-400 p-3 rounded-lg overflow-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
