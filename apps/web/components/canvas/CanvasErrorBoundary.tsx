"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; onClose: () => void };
type State = { hasError: boolean };

/**
 * Contains render-time crashes inside the Canvas connection modal so a bad
 * Canvas response can't take down the whole planner page.
 */
export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Canvas modal crashed", error, info.componentStack);
  }

  private handleClose = () => {
    this.setState({ hasError: false });
    this.props.onClose();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="canvas-overlay" role="dialog" aria-modal="true" aria-label="Canvas error">
        <div className="canvas-modal">
          <div className="canvas-step canvas-error-step">
            <div className="canvas-error-icon">!</div>
            <h2>Something went wrong</h2>
            <p className="canvas-error-msg">The Canvas connection screen hit an unexpected error. Your plan is safe — close this and try connecting again.</p>
            <div className="canvas-modal-actions"><button className="glow-button" onClick={this.handleClose}>Close</button></div>
          </div>
        </div>
      </div>
    );
  }
}
