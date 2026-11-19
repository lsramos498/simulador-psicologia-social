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
        <main className="login-splash">
          <div className="login-splash-bg" aria-hidden="true" />
          <div className="login-splash-vignette" aria-hidden="true" />
          <div className="login-splash-center">
            <h1 className="login-title-3d" style={{ fontSize: '2.8rem' }}>
              LUMINA
            </h1>
            <div className="login-splash-form">
              <h2>Algo falló</h2>
              <p className="login-form-lead">
                {this.state.error.message || String(this.state.error)}
              </p>
              <button
                type="button"
                className="login-btn-game blue"
                onClick={() => {
                  this.setState({ error: null });
                  window.location.reload();
                }}
              >
                Recargar
              </button>
            </div>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
