import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-ink">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Card({
  className,
  children,
  onClick,
}: {
  className?: string
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={cn(
        'rounded-2xl border border-cream-200 bg-white p-4 shadow-sm',
        onClick &&
          'cursor-pointer transition hover:border-forest-600/30 hover:shadow-md active:scale-[0.99]',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 disabled:opacity-50',
        size === 'sm' && 'px-3 py-1.5 text-xs',
        size === 'md' && 'px-4 py-2 text-sm',
        variant === 'primary' &&
          'bg-forest-900 text-cream-50 hover:bg-forest-800',
        variant === 'secondary' &&
          'border border-cream-300 bg-white text-ink hover:bg-cream-100',
        variant === 'ghost' && 'text-forest-800 hover:bg-forest-50',
        variant === 'danger' &&
          'bg-red-600 text-white hover:bg-red-700',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'min-w-0 w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-base text-ink placeholder:text-stone-400 focus:border-forest-600 focus:ring-2 focus:ring-forest-600/20 focus:outline-none',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-w-0 w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-base text-ink placeholder:text-stone-400 focus:border-forest-600 focus:ring-2 focus:ring-forest-600/20 focus:outline-none',
        className,
      )}
      {...props}
    />
  )
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'min-w-0 w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-base text-ink focus:border-forest-600 focus:ring-2 focus:ring-forest-600/20 focus:outline-none',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode
  htmlFor?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-xs font-semibold tracking-wide text-muted uppercase"
    >
      {children}
    </label>
  )
}

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'default' | 'warn' | 'good' | 'alert'
}) {
  return (
    <Card
      className={cn(
        'py-3',
        tone === 'warn' && 'border-amber-200 bg-amber-50/50',
        tone === 'good' && 'border-forest-100 bg-forest-50/60',
        tone === 'alert' && 'border-red-200 bg-red-50/50',
      )}
    >
      <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </Card>
  )
}
