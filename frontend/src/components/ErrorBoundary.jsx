import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <section className="crear-caso" style={{ padding: '2rem' }}>
          <p className="kicker">Error</p>
          <h2>Algo falló en la interfaz</h2>
          <p className="muted-light">{this.state.error.message || String(this.state.error)}</p>
          <button
            type="button"
            className="btn-play"
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
          >
            Recargar
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
