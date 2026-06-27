export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      <div className="bg-grid absolute inset-0" aria-hidden="true" />
      <div className="hero-glow" aria-hidden="true" />
      <main className="relative z-10 w-full max-w-sm">
        {children}
      </main>
    </div>
  );
}
