import { ArrowUp, RotateCcw, Settings2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import type { AssistantReply, ChatTurn, MealType, Recommendation } from '@/core/types'
import { ChatMessage, TypingIndicator } from '@/components/ChatMessage'
import { MealPicker } from '@/components/food/MealPicker'
import { NutritionCard } from '@/components/NutritionCard'
import { PageHeader, IconButton } from '@/components/PageHeader'
import { RecommendationCard } from '@/components/RecommendationCard'
import { ErrorState } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { mealForNow } from '@/lib/dates'
import { MEAL_LABELS } from '@/lib/format'
import { useSelectedDate } from '@/lib/selectedDate'
import { useAiStatus, useAsk, useLogRecommendation, useSuggestedPrompts } from '@/services/queries'

type Msg = { id: string; role: 'user'; text: string } | { id: string; role: 'assistant'; reply: AssistantReply }

const STORE = 'nourish-chat'
const loadChat = (): Msg[] => {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) ?? '[]')
  } catch {
    return []
  }
}

export function AssistantScreen() {
  const { date } = useSelectedDate()
  const [messages, setMessages] = useState<Msg[]>(loadChat)
  const [input, setInput] = useState('')
  const [failed, setFailed] = useState<{ text: string; error: unknown } | null>(null)
  const [openRec, setOpenRec] = useState<Recommendation | null>(null)
  const [addRec, setAddRec] = useState<Recommendation | null>(null)
  const ask = useAsk()
  const prompts = useSuggestedPrompts()
  const ai = useAiStatus()
  const aiOn = !!ai.data?.assistantAvailable
  const navigate = useNavigate()
  const endRef = useRef<HTMLDivElement>(null)
  const [params, setParams] = useSearchParams()

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-40)))
    } catch {
      /* ignore */
    }
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, ask.isPending])

  async function send(text: string) {
    const t = text.trim()
    if (!t || ask.isPending) return
    setInput('')
    setFailed(null)
    const history: ChatTurn[] = messages.slice(-8).map((m) => (m.role === 'user' ? { role: 'user', text: m.text } : { role: 'assistant', text: m.reply.text }))
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'user', text: t }])
    try {
      const reply = await ask.mutateAsync({ message: t, date, history })
      setMessages((m) => [...m, { id: reply.id, role: 'assistant', reply }])
    } catch (error) {
      setFailed({ text: t, error })
    }
  }

  // Deep link from Today's insights: /assistant?q=...
  const q = params.get('q')
  const handledQ = useRef<string | null>(null)
  useEffect(() => {
    if (q && handledQ.current !== q) {
      handledQ.current = q
      setParams({}, { replace: true })
      send(q)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    send(input)
  }

  return (
    <div className="flex min-h-[calc(100dvh-var(--nav-height)-var(--safe-bottom)-var(--safe-top)-40px)] flex-col">
      <PageHeader
        title="Assistant"
        emoji="✨"
        subtitle={aiOn ? 'Chat with Gemini about your food, goals and meals' : "Meal ideas from your goals and today's diary"}
        actions={
          messages.length > 0 && (
            <IconButton label="Clear conversation" onClick={() => setMessages([])}>
              <RotateCcw className="size-[18px]" />
            </IconButton>
          )
        }
      />

      <div className="flex-1 space-y-4 pb-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="animate-fade-up rounded-[var(--radius-card)] bg-soft p-5">
            <div className="flex items-center gap-2 text-accent">
              <span aria-hidden className="emoji">🍊</span>
              <p className="text-[13px] font-semibold uppercase tracking-wide">How this works</p>
            </div>
            {aiOn ? (
              <p className="mt-2 text-[15px] leading-relaxed">
                Ask anything about your eating: what to cook tonight, how your protein is going, ideas with what's in your fridge. Answers come from
                Google Gemini using today's diary and your goals; meal cards are checked against your allergies and their nutrition is always
                calculated from the food database.
              </p>
            ) : (
              <>
                <p className="mt-2 text-[15px] leading-relaxed">
                  Suggestions come from a rule-based engine that looks at your targets, what you've logged today, your diet and allergies. Nutrition is
                  always calculated from the food database. Try one of the prompts below.
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/settings#ai')}>
                  <Settings2 className="size-4" /> Turn on the Gemini AI assistant
                </Button>
              </>
            )}
          </div>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <ChatMessage key={m.id} role="user">
              {m.text}
            </ChatMessage>
          ) : (
            <div key={m.id} className="space-y-3">
              <ChatMessage role="assistant">
                <span className="whitespace-pre-line">{m.reply.text}</span>
                {m.reply.source === 'ai' && <span className="mt-1 block text-[11px] font-medium uppercase tracking-wide text-muted">Gemini</span>}
              </ChatMessage>
              {m.reply.notice && <p className="pl-10 text-[12.5px] text-muted">{m.reply.notice}</p>}
              {m.reply.recommendations.length > 0 && (
                <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
                  {m.reply.recommendations.map((r) => (
                    <RecommendationCard key={r.id} rec={r} onOpen={() => setOpenRec(r)} onAdd={() => setAddRec(r)} />
                  ))}
                </div>
              )}
              {m.reply.followUps && m.reply.followUps.length > 0 && (
                <div className="flex flex-wrap gap-2 pl-10">
                  {m.reply.followUps.map((f) => (
                    <PromptChip key={f} text={f} onClick={() => send(f)} />
                  ))}
                </div>
              )}
            </div>
          ),
        )}
        {ask.isPending && <TypingIndicator />}
        {failed && (
          <ErrorState
            error={failed.error}
            onRetry={() => {
              setMessages((m) => m.slice(0, -1))
              send(failed.text)
            }}
          />
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-[calc(var(--nav-height)+var(--safe-bottom))] -mx-4 bg-background/90 px-4 pb-3 pt-2 backdrop-blur-xl sm:mx-0 sm:px-0">
        {prompts.data && (
          <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Suggested prompts">
            {prompts.data.map((p) => (
              <PromptChip key={p} text={p} onClick={() => send(p)} disabled={ask.isPending} />
            ))}
          </div>
        )}
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Ask for a recommendation
          </label>
          <input
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={aiOn ? 'Ask me anything about your food…' : 'Ask about meals, protein, fiber…'}
            enterKeyHint="send"
            autoComplete="off"
            className="h-12 min-w-0 flex-1 rounded-full border border-border bg-surface px-5 text-base outline-none placeholder:text-muted/80 focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
          <Button type="submit" size="icon" className="size-12" aria-label="Send" disabled={!input.trim() || ask.isPending}>
            <ArrowUp className="size-5" />
          </Button>
        </form>
      </div>

      <RecipeDetailSheet
        rec={openRec}
        onClose={() => setOpenRec(null)}
        onAdd={(r) => {
          setOpenRec(null)
          setTimeout(() => setAddRec(r), 250)
        }}
      />
      <AddRecommendationSheet key={addRec?.id ?? 'none'} rec={addRec} date={date} onClose={() => setAddRec(null)} />
    </div>
  )
}

const PROMPT_EMOJI: [RegExp, string][] = [
  [/dinner|lunch|breakfast|eat/i, '🍽️'],
  [/protein/i, '💪'],
  [/calorie|kcal/i, '🔥'],
  [/make with|ingredients/i, '🥚'],
  [/fiber|fibre/i, '🌾'],
  [/nutrient|vitamin|week/i, '💊'],
]

function PromptChip({ text, onClick, disabled }: { text: string; onClick: () => void; disabled?: boolean }) {
  const emoji = PROMPT_EMOJI.find(([re]) => re.test(text))?.[1]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-10 shrink-0 rounded-full border border-border bg-surface px-4 text-[13px] font-medium text-foreground transition active:scale-[0.97] disabled:opacity-50"
    >
      {emoji && <span aria-hidden className="emoji mr-1.5">{emoji}</span>}
      {text}
    </button>
  )
}

function RecipeDetailSheet({ rec, onClose, onAdd }: { rec: Recommendation | null; onClose: () => void; onAdd: (r: Recommendation) => void }) {
  return (
    <Sheet
      open={!!rec}
      onOpenChange={(o) => !o && onClose()}
      title={rec?.name ?? ''}
      description={rec ? [rec.prepMinutes !== null ? `~${rec.prepMinutes} min` : null, 'Nutrition calculated from the food database'].filter(Boolean).join(' · ') : undefined}
      footer={
        rec && (
          <Button size="lg" className="w-full" onClick={() => onAdd(rec)}>
            Add to diary
          </Button>
        )
      }
    >
      {rec && (
        <div className="space-y-5 pt-1">
          <NutritionCard nutrition={rec.nutrition} />
          <p className="rounded-2xl bg-sage-soft px-4 py-3 text-sm leading-relaxed text-sage">{rec.explanation}</p>
          <section>
            <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Ingredients</h3>
            <ul className="divide-y divide-border/70">
              {rec.ingredients.map((i) => (
                <li key={i.name} className="flex min-h-11 items-center justify-between gap-3 py-2 text-[15px]">
                  <span>{i.name}</span>
                  <span className="text-muted">{i.amount}</span>
                </li>
              ))}
            </ul>
          </section>
          {rec.steps && rec.steps.length > 0 && (
            <section>
              <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">Steps</h3>
              <ol className="space-y-2.5">
                {rec.steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-[12px] font-semibold">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </Sheet>
  )
}

function AddRecommendationSheet({ rec, date, onClose }: { rec: Recommendation | null; date: string; onClose: () => void }) {
  const [meal, setMeal] = useState<MealType>(rec?.suggestedMeal ?? mealForNow())
  const log = useLogRecommendation()
  return (
    <Sheet
      open={!!rec}
      onOpenChange={(o) => !o && onClose()}
      title="Add to diary"
      description={rec?.name}
      footer={
        <Button
          size="lg"
          className="w-full"
          disabled={log.isPending}
          onClick={async () => {
            if (!rec) return
            try {
              await log.mutateAsync({ date, meal, recommendation: rec })
              toast.success(`${rec.name} added to ${MEAL_LABELS[meal]}`)
              onClose()
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Could not add')
            }
          }}
        >
          Add to {MEAL_LABELS[meal]}
        </Button>
      }
    >
      <div className="pt-1">
        <MealPicker value={meal} onChange={setMeal} />
      </div>
    </Sheet>
  )
}
