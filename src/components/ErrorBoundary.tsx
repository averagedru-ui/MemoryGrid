import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center p-8 text-center">
          <div>
            <div className="text-3xl mb-3 opacity-40">⚠</div>
            <div className="text-text-primary font-medium mb-2">Something went wrong</div>
            <div className="text-xs text-text-muted mb-4 font-mono max-w-sm break-all">
              {this.state.error.message}
            </div>
            <button
              className="px-4 py-2 rounded text-sm text-white"
              style={{ background: '#7c6af7' }}
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
