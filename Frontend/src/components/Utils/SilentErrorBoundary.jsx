import React from 'react';

export default class SilentErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Derivar silenciosamente a la consola ocultando el fallo visual
    console.error('[EnviroSense Silent Shield] Error capturado y suprimido:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Renderizar un fallback invisible o mantener la UI previa sin mostrar alerta roja
      return null; 
    }
    return this.props.children;
  }
}
