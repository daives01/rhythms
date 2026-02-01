export function AuthLoading() {
  return (
    <div
      className="min-h-dvh flex flex-col select-none"
      style={{
        touchAction: "manipulation",
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
      }}
    >
      <main className="flex-1 flex items-center justify-center p-6">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Loading...
        </span>
      </main>
    </div>
  )
}
