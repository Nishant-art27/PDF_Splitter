import { Component, type ReactNode } from "react";
import MaintenancePage from "./MaintenancePage";

/**
 * Catches any unexpected crash in the React tree and shows the
 * maintenance screen instead of a blank page.
 */
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { crashed: boolean }
> {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("UI crashed:", error);
  }

  render() {
    return this.state.crashed ? <MaintenancePage /> : this.props.children;
  }
}
