export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8" role="status" aria-label="Loading">
      <div className="flex gap-2">
        <div className="size-2 rounded-full bg-muted-foreground animate-pulse" />
        <div className="size-2 rounded-full bg-muted-foreground animate-pulse [animation-delay:0.2s]" />
        <div className="size-2 rounded-full bg-muted-foreground animate-pulse [animation-delay:0.4s]" />
      </div>
    </div>
  );
}
