
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI } from '@google/genai';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

import { Artifact, Session, ComponentVariation } from './types';
import { INITIAL_PLACEHOLDERS } from './constants';
import { generateId } from './utils';

import DottedGlowBackground from './components/DottedGlowBackground';
import ArtifactCard from './components/ArtifactCard';
import SideDrawer from './components/SideDrawer';
import { 
    ThinkingIcon, 
    CodeIcon, 
    SparklesIcon, 
    ArrowUpIcon, 
    GridIcon,
    ExportIcon,
    MicIcon
} from './components/Icons';

type GenerationMode = 'flash' | 'a2ui';
type GeminiModel = 'gemini-3-flash-preview' | 'gemini-3-pro-preview';

function App() {
  const [sessions, setSessions] = useState<Session[]>(() => {
    try {
        const saved = localStorage.getItem('ngx_sessions');
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
  });
  
  const [currentSessionIndex, setCurrentSessionIndex] = useState<number>(() => {
    try {
        const saved = localStorage.getItem('ngx_sessions');
        const parsed = saved ? JSON.parse(saved) : [];
        return parsed.length > 0 ? parsed.length - 1 : -1;
    } catch (e) {
        return -1;
    }
  });

  const [focusedArtifactIndex, setFocusedArtifactIndex] = useState<number | null>(null);
  const [generationMode, setGenerationMode] = useState<GenerationMode>('flash');
  const [selectedModel, setSelectedModel] = useState<GeminiModel>('gemini-3-flash-preview');
  
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholders] = useState<string[]>(INITIAL_PLACEHOLDERS);
  
  const [selectedImage, setSelectedImage] = useState<{data: string, mimeType: string} | null>(null);
  
  const [drawerState, setDrawerState] = useState<{
      isOpen: boolean;
      mode: 'code' | 'variations' | null;
      title: string;
      data: any; 
  }>({ isOpen: false, mode: null, title: '', data: null });

  const [componentVariations, setComponentVariations] = useState<ComponentVariation[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Sync Persistence
  useEffect(() => {
    localStorage.setItem('ngx_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Handle Speech Recognition Setup
  useEffect(() => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
          recognitionRef.current = new SpeechRecognition();
          recognitionRef.current.continuous = false;
          recognitionRef.current.interimResults = false;
          recognitionRef.current.lang = 'es-ES';
          
          recognitionRef.current.onresult = (event: any) => {
              const transcript = event.results[0][0].transcript;
              setInputValue(prev => (prev ? prev + ' ' : '') + transcript);
              setIsListening(false);
          };
          recognitionRef.current.onerror = () => setIsListening(false);
          recognitionRef.current.onend = () => setIsListening(false);
      }
  }, []);

  // Cycle placeholders
  useEffect(() => {
      const interval = setInterval(() => {
          setPlaceholderIndex(prev => (prev + 1) % placeholders.length);
      }, 4000);
      return () => clearInterval(interval);
  }, [placeholders.length]);

  const toggleListening = () => {
    if (isListening) recognitionRef.current?.stop();
    else { setIsListening(true); recognitionRef.current?.start(); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = (reader.result as string).split(',')[1];
        setSelectedImage({ data: base64Data, mimeType: file.type });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCopyCode = async () => {
    const currentSession = sessions[currentSessionIndex];
    if (!currentSession || focusedArtifactIndex === null) return;
    const html = currentSession.artifacts[focusedArtifactIndex].html;
    try {
        await navigator.clipboard.writeText(html);
        alert('✨ Código copiado al portapapeles');
    } catch (err) {
        console.error('Error al copiar:', err);
    }
  };

  const handleExport = useCallback(() => {
    const currentSession = sessions[currentSessionIndex];
    if (!currentSession || focusedArtifactIndex === null) return;
    const artifact = currentSession.artifacts[focusedArtifactIndex];
    if (!artifact.html) return;

    const blob = new Blob([artifact.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ngx_${artifact.styleName.toLowerCase().replace(/\s+/g, '_')}_${artifact.id}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [sessions, currentSessionIndex, focusedArtifactIndex]);

  const handleSendMessage = useCallback(async (manualPrompt?: string) => {
    const promptToUse = manualPrompt || inputValue;
    const trimmedInput = promptToUse.trim();
    if (!trimmedInput || isLoading) return;
    if (!manualPrompt) setInputValue('');

    setIsLoading(true);
    const sessionId = generateId();

    const placeholderArtifacts: Artifact[] = Array(3).fill(null).map((_, i) => ({
        id: `${sessionId}_${i}`,
        styleName: 'Analizando concepto...',
        html: '',
        status: 'streaming',
    }));

    const newSession: Session = {
        id: sessionId,
        prompt: trimmedInput,
        timestamp: Date.now(),
        artifacts: placeholderArtifacts
    };

    setSessions(prev => [...prev, newSession]);
    setCurrentSessionIndex(sessions.length);
    setFocusedArtifactIndex(null);

    const inspirationImage = selectedImage;
    setSelectedImage(null);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Phase 1: Style Definitions
        const stylePrompt = `Generate 3 distinct visual metaphors for: "${trimmedInput}". Return ONLY a valid JSON array of strings. No backticks.`;
        const styleParts: any[] = [{ text: stylePrompt }];
        if (inspirationImage) {
            styleParts.push({ 
                inlineData: { 
                    data: inspirationImage.data, 
                    mimeType: inspirationImage.mimeType 
                } 
            });
        }

        const styleResponse = await ai.models.generateContent({
            model: selectedModel,
            contents: { role: 'user', parts: styleParts }
        });

        let generatedStyles: string[] = ["Dynamic View", "Smart Layout", "Interactive UI"];
        try {
            const rawText = styleResponse.text || '';
            const jsonMatch = rawText.match(/\[[\s\S]*\]/);
            if (jsonMatch) generatedStyles = JSON.parse(jsonMatch[0]).slice(0, 3);
        } catch (e) {
            console.warn("Style parsing failed, using defaults");
        }

        setSessions(prev => prev.map(s => s.id === sessionId ? {
            ...s,
            artifacts: s.artifacts.map((art, i) => ({ ...art, styleName: generatedStyles[i] || `Estilo ${i+1}` }))
        } : s));

        // Phase 2: Parallel Generation
        const generateArtifact = async (artifact: Artifact, style: string) => {
            const systemPrompt = `Expert A2UI/Frontend Engineer. 
            Goal: Create a ${style} for "${trimmedInput}". 
            Constraints: Single HTML file with CSS/JS. No external images. No Markdown code fences. No "Sure! Here is your code". 
            Mode: ${generationMode}. Model Reasoner: ${selectedModel}.`;
            
            const parts: any[] = [{ text: systemPrompt }];
            if (inspirationImage) {
                parts.push({ 
                    inlineData: { 
                        data: inspirationImage.data, 
                        mimeType: inspirationImage.mimeType 
                    } 
                });
            }

            try {
                const responseStream = await ai.models.generateContentStream({
                    model: selectedModel,
                    contents: [{ parts, role: "user" }],
                });

                let fullHtml = '';
                for await (const chunk of responseStream) {
                    fullHtml += chunk.text || '';
                    // Aggressive cleaning during streaming
                    let cleaned = fullHtml
                        .replace(/^```html\n?/, '')
                        .replace(/\n?```$/, '')
                        .replace(/```/g, '')
                        .trim();

                    setSessions(prev => prev.map(s => s.id === sessionId ? {
                        ...s,
                        artifacts: s.artifacts.map(a => a.id === artifact.id ? { ...a, html: cleaned } : a)
                    } : s));
                }

                setSessions(prev => prev.map(s => s.id === sessionId ? {
                    ...s,
                    artifacts: s.artifacts.map(a => a.id === artifact.id ? { ...a, status: 'complete' } : a)
                } : s));
            } catch (err) {
                console.error("Artifact generation failed", err);
                setSessions(prev => prev.map(s => s.id === sessionId ? {
                    ...s,
                    artifacts: s.artifacts.map(a => a.id === artifact.id ? { ...a, status: 'error' } : a)
                } : s));
            }
        };

        await Promise.all(placeholderArtifacts.map((art, i) => generateArtifact(art, generatedStyles[i])));
    } catch (e) {
        console.error("Critical Send Error:", e);
    } finally {
        setIsLoading(false);
    }
  }, [inputValue, isLoading, sessions.length, generationMode, selectedImage, selectedModel]);

  const hasStarted = sessions.length > 0 || isLoading;

  return (
    <>
        <aside className="history-sidebar">
            <div className="sidebar-header">
                <GridIcon /> <span>Proyectos</span>
            </div>
            <div className="sidebar-list">
                {sessions.length === 0 && <div className="sidebar-empty">Sin historial</div>}
                {sessions.map((s, idx) => (
                    <button 
                        key={s.id} 
                        className={`history-item ${idx === currentSessionIndex ? 'active' : ''}`}
                        onClick={() => {
                            setCurrentSessionIndex(idx);
                            setFocusedArtifactIndex(null);
                        }}
                    >
                        {s.prompt}
                    </button>
                ))}
            </div>
            <div className="sidebar-footer">
                <button onClick={() => { if(confirm('¿Borrar todo el historial?')) setSessions([]); setCurrentSessionIndex(-1); localStorage.clear(); }}>Limpiar todo</button>
            </div>
        </aside>

        <SideDrawer 
            isOpen={drawerState.isOpen} 
            onClose={() => setDrawerState(s => ({...s, isOpen: false}))} 
            title={drawerState.title}
        >
            {drawerState.mode === 'code' && <pre className="code-block"><code>{drawerState.data}</code></pre>}
        </SideDrawer>

        <main className="immersive-app main-content-shift">
            <DottedGlowBackground 
                gap={30} 
                radius={1.5} 
                color="rgba(109, 0, 255, 0.1)" 
                glowColor="rgba(109, 0, 255, 0.5)" 
                speedScale={0.3}
            />

            <div className={`stage-container ${focusedArtifactIndex !== null ? 'mode-focus' : 'mode-split'}`}>
                 <div className={`empty-state ${hasStarted ? 'fade-out' : ''}`}>
                     <div className="empty-content">
                         <h1>NGX Flash UI</h1>
                         <p>Genera interfaces instantáneas con Gemini 3.0</p>
                     </div>
                 </div>

                {sessions[currentSessionIndex] && (
                    <div className="session-group active-session">
                        <div className="artifact-grid">
                            {sessions[currentSessionIndex].artifacts.map((artifact, aIndex) => (
                                <ArtifactCard 
                                    key={artifact.id}
                                    artifact={artifact}
                                    isFocused={focusedArtifactIndex === aIndex}
                                    onClick={() => setFocusedArtifactIndex(aIndex)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className={`action-bar ${focusedArtifactIndex !== null ? 'visible' : ''}`}>
                 <div className="active-prompt-label">{sessions[currentSessionIndex]?.prompt}</div>
                 <div className="action-buttons">
                    <button onClick={() => setFocusedArtifactIndex(null)}><GridIcon /> Volver</button>
                    <button onClick={handleCopyCode}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar
                    </button>
                    <button onClick={() => setDrawerState({isOpen: true, mode: 'code', title: 'Código Fuente', data: sessions[currentSessionIndex]?.artifacts[focusedArtifactIndex!]?.html})}><CodeIcon /> Ver Código</button>
                    <button onClick={handleExport} className="export-btn"><ExportIcon /> Descargar</button>
                 </div>
            </div>

            <div className="floating-input-container">
                {selectedImage && (
                    <div className="image-preview-bubble">
                        <img src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} alt="Ref" />
                        <button className="clear-image" onClick={() => setSelectedImage(null)}>&times;</button>
                        <span className="inspiration-label">Inspiración Activa</span>
                    </div>
                )}
                
                <div className="selector-rows">
                    <div className="mode-tabs">
                        <button className={generationMode === 'flash' ? 'active' : ''} onClick={() => setGenerationMode('flash')}>Flash</button>
                        <button className={generationMode === 'a2ui' ? 'active' : ''} onClick={() => setGenerationMode('a2ui')}>A2UI</button>
                    </div>

                    <div className="model-selector">
                        <button 
                            className={selectedModel === 'gemini-3-flash-preview' ? 'active' : ''} 
                            onClick={() => setSelectedModel('gemini-3-flash-preview')}
                        >⚡ Flash 3.0</button>
                        <button 
                            className={selectedModel === 'gemini-3-pro-preview' ? 'active' : ''} 
                            onClick={() => setSelectedModel('gemini-3-pro-preview')}
                        >💎 Pro 3.0</button>
                    </div>
                </div>

                <div className={`input-wrapper ${isLoading ? 'loading' : ''} ${isListening ? 'listening' : ''}`}>
                    <input type="file" accept="image/*" style={{display: 'none'}} ref={fileInputRef} onChange={handleFileChange} />
                    <button className="attach-button" onClick={() => fileInputRef.current?.click()} disabled={isLoading} title="Adjuntar imagen de inspiración">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><line x1="16" y1="5" x2="22" y2="5"/><line x1="19" y1="2" x2="19" y2="8"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    </button>
                    <button className={`mic-button ${isListening ? 'active' : ''}`} onClick={toggleListening} disabled={isLoading} title="Dictar por voz">
                        <MicIcon />
                    </button>
                    {!isLoading ? (
                        <input 
                            ref={inputRef}
                            type="text" 
                            placeholder={isListening ? "Escuchando..." : placeholders[placeholderIndex]}
                            value={inputValue} 
                            onChange={(e) => setInputValue(e.target.value)} 
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} 
                        />
                    ) : (
                        <div className="input-generating-label"><ThinkingIcon /> Procesando con {selectedModel.includes('pro') ? 'Pro' : 'Flash'}...</div>
                    )}
                    <button className="send-button" onClick={() => handleSendMessage()} disabled={isLoading || !inputValue.trim()}>
                        <ArrowUpIcon />
                    </button>
                </div>
            </div>
        </main>
    </>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) ReactDOM.createRoot(rootElement).render(<App />);
