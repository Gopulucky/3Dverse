"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { reportBug } from "@/lib/bug-detector";

interface Props {
  children: ReactNode;
  /** Shown in the fallback and in the recorded bug so you know which widget broke. */
  name: string;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Wrap a risky, isolated widget (3D viewer, checkout form, chart) with this so
 * a render crash there doesn't take down the whole page — it reports the bug
 * and shows a small inline fallback instead of falling through to error.tsx.
 *
 * Usage: <ErrorBoundary name="product-viewer"><ThreeViewer .../></ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportBug({
      kind: "react-error",
      message: `${this.props.name}: ${error.message}`,
      stack: error.stack ?? info.componentStack ?? undefined,
    });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
            <AlertTriangle className="text-destructive" size={28} />
            <p className="text-sm text-muted-foreground">
              The &ldquo;{this.props.name}&rdquo; section failed to load.
            </p>
            <button
              onClick={this.reset}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <RefreshCcw size={14} /> Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
