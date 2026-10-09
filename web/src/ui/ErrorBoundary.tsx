import { Component, type ReactNode } from "react";

/** Keeps one broken piece from blanking the whole page: shows a short message
 * with a way back instead, and logs the error for debugging. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Eye Lab hit an error:", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-canvas p-6 text-center text-ink">
        <h1 className="display text-[32px]">Something went wrong.</h1>
        <button
          onClick={() => location.reload()}
          className="h-12 rounded-full bg-primary px-6 text-[16px] font-semibold text-card transition-colors duration-200 hover:bg-primary-hover"
        >
          Reload Eye Lab
        </button>
      </main>
    );
  }
}
