import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[transform,background-color,opacity] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 select-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white dark:text-background hover:opacity-95',
        sage: 'bg-primary text-primary-foreground hover:opacity-95',
        soft: 'bg-soft text-accent hover:bg-soft/80',
        outline: 'border border-border bg-surface text-foreground hover:bg-surface-2',
        ghost: 'text-foreground hover:bg-surface-2',
        danger: 'bg-danger/10 text-danger hover:bg-danger/15',
      },
      size: {
        sm: 'h-9 min-w-9 rounded-full px-3.5 text-[13px]',
        md: 'h-11 min-w-11 rounded-full px-5 text-[15px]',
        lg: 'h-13 min-w-13 rounded-2xl px-6 text-base',
        icon: 'h-11 w-11 rounded-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
