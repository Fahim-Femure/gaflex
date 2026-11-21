import { Component, Suspense, type ReactNode } from 'react';

/** WebGL can be missing or lost (old phones, blocked GPU): show the 2D fallback instead. */
class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function SceneBoundary({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return (
    <Boundary fallback={fallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </Boundary>
  );
}
