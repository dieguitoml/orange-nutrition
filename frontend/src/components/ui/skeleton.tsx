import { cn } from '@/lib/utils'

export const Skeleton = ({ className }: { className?: string }) => (
  <div aria-hidden className={cn('animate-shimmer rounded-xl bg-surface-2', className)} />
)
