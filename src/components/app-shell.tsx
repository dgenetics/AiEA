/** Every Farm Manager page is cream. The header stays dark. Tabs live in the bottom bar. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100dvh-2.5rem)] bg-cream-100 text-ink">
      <main className="pad-tab-bar min-w-0 max-w-full flex-1 overflow-x-hidden px-4 pt-5 md:px-6 md:pt-6">
        {children}
      </main>
    </div>
  );
}
