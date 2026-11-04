const BAR = "rounded-lg bg-muted animate-pulse motion-reduce:animate-none";

// Shaped like the loaded page so nothing jumps when it arrives.
export default function Loading() {
  return (
    <main
      className="mx-auto flex min-h-screen max-w-sm flex-col px-5 py-10"
      aria-busy="true"
    >
      <span className="sr-only" role="status">
        Loading payment
      </span>
      <section className="space-y-5 px-6 py-5" aria-hidden>
        <div className="space-y-2">
          <div className={`${BAR} mx-auto h-6 w-3/4`} />
          <div className={`${BAR} mx-auto h-4 w-1/2`} />
        </div>
        <div className={`${BAR} mx-auto h-9 w-32`} />
        <div className={`${BAR} mx-auto h-[252px] w-[252px] rounded-2xl`} />
        <div className={`${BAR} h-12 w-full`} />
        <div className={`${BAR} h-12 w-full`} />
      </section>
    </main>
  );
}
