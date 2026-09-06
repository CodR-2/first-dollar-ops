import { BookOpen, Cookie, FileText, Send, Globe } from 'lucide-react'
import { CHAIN } from '../lib/chain'

/** Sticky footer — pushed to the bottom via mt-auto on the page flex column. */
export function Footer() {
  const links = [
    { href: CHAIN.docs, label: 'Docs', icon: BookOpen },
    { href: CHAIN.explorer, label: 'Explorer', icon: Globe },
    { href: CHAIN.bridge, label: 'Bridge', icon: Send },
    { href: CHAIN.telegram, label: 'Telegram', icon: FileText },
  ]
  return (
    <footer className="mt-auto border-t border-white/[0.06] bg-cocoa-950/60 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row">
        <p className="flex items-center gap-2 text-center text-xs text-cream-500 sm:text-left">
          <Cookie className="size-3.5 text-amber-glow/70" aria-hidden />
          CookieLens — built for the Cookie Chain community ·{' '}
          <a
            href={CHAIN.docs}
            target="_blank"
            rel="noreferrer"
            className="text-cream-300 underline decoration-cream-700 underline-offset-2 transition hover:text-amber-glow"
          >
            docs.cookiechain.wtf
          </a>
        </p>
        <nav aria-label="Cookie Chain links" className="flex flex-wrap items-center justify-center gap-2">
          {links.map(({ href, label, icon: Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-cream-400 transition hover:bg-amber-glow/10 hover:text-amber-glow"
            >
              <Icon className="size-3.5" aria-hidden />
              {label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}
