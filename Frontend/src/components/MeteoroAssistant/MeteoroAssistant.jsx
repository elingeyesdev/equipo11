import React, { useState, useEffect, useRef } from 'react';
import httpClient from '../../config/httpClient';
import { useToast } from '../Toast/Toast';
import './MeteoroAssistant.css';
import Draggable from '../Draggable/Draggable';

export default function MeteoroAssistant({ 
  cityContext = 'Bolivia', 
  dataContext = [], 
  onSimulatedData = null, 
  globalMode = false 
}) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [meteoroMessage, setMeteoroMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(!globalMode);
  const { addToast } = useToast();
  
  const recognitionRef = useRef(null);
  const synthRef = window.speechSynthesis;

  useEffect(() => {
    // Setup Web Speech API (SpeechRecognition)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'es-ES'; // Español universal para mejor soporte STT
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognitionRef.current.onerror = (event) => {
        if (event.error !== 'no-speech' && event.error !== 'network') {
          console.error('Speech recognition error', event.error);
        }
        setIsListening(false);
        if(event.error === 'network') {
          addToast('Reconocimiento de voz bloqueado por tu navegador. Usa el teclado.', 'error');
        } else if (event.error !== 'no-speech') {
          addToast('Error al capturar audio', 'error');
        }
      };

      recognitionRef.current.onend = () => {
        // Stop listening. Si hay transcripción, enviarla.
        setIsListening(false);
      };
    } else {
      addToast('Tu navegador no soporta reconocimiento de voz', 'error');
    }
    
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      synthRef.cancel();
    };
  }, []);

  // Use an effect to automatically process when listening stops and transcript is not empty
  useEffect(() => {
    if (!isListening && transcript.trim().length > 5 && !isProcessing) {
      procesarComandoVoz(transcript);
    }
  }, [isListening]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      synthRef.cancel(); // Detener cualquier voz anterior
      setTranscript('');
      setMeteoroMessage('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const hablar = (texto) => {
    if (!synthRef) return;
    synthRef.cancel();
    const utterance = new SpeechSynthesisUtterance(texto);
    
    // Configurar voz femenina y natural si está disponible
    const voices = synthRef.getVoices();
    const spanishVoice = voices.find(v => v.lang.includes('es') && (v.name.includes('Google') || v.name.includes('Microsoft Sabina')));
    if (spanishVoice) utterance.voice = spanishVoice;
    
    utterance.rate = 1.05;
    utterance.pitch = 1.1; // Un poco más agudo/amigable
    
    synthRef.speak(utterance);
  };

  const procesarComandoVoz = async (prompt) => {
    setIsProcessing(true);
    setMeteoroMessage('Pensando...');
    setIsExpanded(true); // Auto expand to show status
    
    try {
      const payload = {
        ciudad: cityContext,
        prompt: prompt,
        datosContexto: dataContext
      };
      
      const response = await httpClient.post('/reportes/meteoro', payload);
      const { mensaje_voz, datos_simulados, acciones_ui } = response.data.data; // El response utils devuelve data.data

      setMeteoroMessage(mensaje_voz);
      hablar(mensaje_voz);
      
      // Control de Interfaz (Agencia)
      if (acciones_ui && Array.isArray(acciones_ui) && acciones_ui.length > 0) {
        // Enrutamiento si pide ir al mapa
        const pideMapa = acciones_ui.some(a => a.comando === 'ir_a_mapa');
        if (pideMapa && window.location.pathname !== '/mapa') {
          // Si tuviéramos useNavigate, lo haríamos, pero como este componente
          // a veces está fuera del enrutador o no lo pasamos, lo forzamos limpiamente:
          window.location.href = '/mapa'; 
          // Guardar comandos en localStorage temporalmente si cambiamos de página
          localStorage.setItem('pending_meteoro_actions', JSON.stringify(acciones_ui));
        } else {
          // Despachar evento global inmediatamente si ya estamos en la página
          window.dispatchEvent(new CustomEvent('meteoro_action', { detail: acciones_ui }));
        }
      }
      if (datos_simulados && onSimulatedData) {
        onSimulatedData(datos_simulados);
      }
      
    } catch (err) {
      console.error(err);
      setMeteoroMessage('Hubo un error al procesar la solicitud.');
      hablar('Lo siento, tuve un problema de conexión. ¿Puedes repetir?');
    } finally {
      setIsProcessing(false);
      setTranscript('');
    }
  };

  if (!isExpanded && globalMode) {
    return (
      <div 
        className="meteoro-assistant-collapsed global-mode"
        onClick={() => setIsExpanded(true)}
        title="Abrir Asistente Meteoro"
      >
        <div className="meteoro-avatar">🌦️</div>
        <span className="meteoro-tooltip-badge">Meteoro IA</span>
      </div>
    );
  }

  const assistantContent = (
    <>
      {/* Header label (global mode only) */}
      {globalMode && (
        <div style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
          width: '100%', marginBottom: '8px', paddingBottom: '8px', 
          borderBottom: '1px solid var(--border-color)' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '16px' }}>🌦️</span>
            <span style={{ 
              fontFamily: 'var(--font-sans)', fontWeight: 700, 
              fontSize: '13px', color: 'var(--text-primary)', letterSpacing: '0.01em'
            }}>Meteoro <span style={{ color: 'var(--accent)', fontWeight: 600 }}>IA</span></span>
            <span style={{
              background: 'var(--primary-extra-light)', color: 'var(--accent)',
              border: '1px solid rgba(91, 192, 190, 0.3)', borderRadius: '4px',
              fontSize: '9px', fontWeight: 700, padding: '1px 5px', letterSpacing: '0.06em',
              textTransform: 'uppercase'
            }}>Asistente</span>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }} 
            className="meteoro-close-btn"
            style={{ position: 'static', fontSize: '11px', padding: '2px 5px' }}
            title="Colapsar"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main content row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
        {!globalMode && (
          <div className="meteoro-avatar">
            🌦️
          </div>
        )}
        <div className="meteoro-dialogue">
          {isListening ? (
            <p className="listening-text">🎙 Escuchando... {transcript}</p>
          ) : isProcessing ? (
            <p className="processing-text">⏳ Analizando escenario...</p>
          ) : meteoroMessage ? (
            <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
               <p className="response-text">{meteoroMessage}</p>
               <button onClick={() => setMeteoroMessage('')} style={{background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '11px', textAlign: 'left', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-sans)'}}>Descartar ×</button>
            </div>
          ) : (
            <form onSubmit={(e) => {
              e.preventDefault();
              if (transcript.trim().length > 0) {
                procesarComandoVoz(transcript);
              }
            }}>
              <input 
                type="text" 
                className="prompt-input" 
                placeholder="Pregunta sobre el clima, zonas, alertas..." 
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                disabled={isProcessing}
              />
            </form>
          )}
        </div>
        
        {!isListening && !isProcessing && transcript.length > 0 && !meteoroMessage && (
          <button 
            className="send-button"
            onClick={() => procesarComandoVoz(transcript)}
            title="Enviar"
          >
            ➤
          </button>
        )}

        <button 
          className={`mic-button ${isListening ? 'listening' : ''}`} 
          onClick={toggleListening}
          disabled={isProcessing}
          title={isListening ? 'Detener' : 'Usar micrófono'}
        >
          {isListening ? '⏹' : '🎤'}
        </button>
      </div>
    </>
  );

  if (globalMode) {
    return (
      <Draggable className="meteoro-assistant global-mode" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
        {assistantContent}
      </Draggable>
    );
  }

  return (
    <div className="meteoro-assistant embedded-mode">
      {assistantContent}
    </div>
  );
}
