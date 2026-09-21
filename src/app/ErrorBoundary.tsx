import { Component, type ReactNode } from 'react'
import { ErrorState } from '@/design-system/states'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown }
  static getDerivedStateFromError(error: unknown) {
    return { error }
  }
  render() {
    return this.state.error ? (
      <ErrorState error={this.state.error} onRetry={() => this.setState({ error: null })} />
    ) : (
      this.props.children
    )
  }
}
