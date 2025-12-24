
import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Trash2, Download, Zap, Layers,
  X, Copy, RefreshCw, Settings, Sliders, 
  Check, ChevronDown, Sparkles, BrainCircuit,
  Cpu, Globe, ShieldCheck, AlertCircle, CheckCircle
} from 'lucide-react';
import { OptimizedImage, StockConstraints, ProcessingStatus, SEOData, ExportPlatform, PLATFORM_FIELDS, AIModel, AppSettings } from './types';
import { analyzeImageWithAI } from './services/aiService';

const Switch = ({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) => (
  <button 
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-orange-500' : 'bg-slate-700'}`}
  >
    <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
  </button>
);

const App: React.FC = () => {
  const [images, setImages] = useState<OptimizedImage[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // App Settings State - Defaulted to Groq Llama 3.2 Vision
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('seo_vision_settings_v2');
    return saved ? JSON.parse(saved) : {
      selectedModel: 'llama-3.2-11b-vision-preview',
      keys: { groq: '', openai: '', deepseek: '', openrouter: '' }
    };
  });

  useEffect(() => {
    localStorage.setItem('seo_vision_settings_v2', JSON.stringify(appSettings));
  }, [appSettings]);

  const [constraints, setConstraints] = useState<StockConstraints>({
    maxTitleChars: 100,
    maxDescChars: 150,
    keywordCount: 46,
    excludeKeywords: [],
    imageType: 'Photo',
    prefix: '',
    suffix: '',
    prefixEnabled: false,
    suffixEnabled: false,
    negWordsTitleEnabled: false,
    negKeywordsEnabled: false,
    negWordsTitle: '',
    negKeywords: '',
    selectedPlatform: 'Generic',
    model: appSettings.selectedModel
  });

  useEffect(() => {
    setConstraints(prev => ({ ...prev, model: appSettings.selectedModel }));
  }, [appSettings.selectedModel]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const fileList = Array.from(e.target.files) as File[];
    const newImages: OptimizedImage[] = fileList.map((file: File) => ({
      id: Math.random().toString(36).substring(2, 11),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending'
    }));
    setImages(prev => [...prev, ...newImages]);
  };

  const processSingle = async (id: string) => {
    const img = images.find(i => i.id === id);
    if (!img) return;

    setImages(prev => prev.map(i => i.id === id ? { ...i, status: 'processing' } : i));
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(img.file);
      });
      
      const result = await analyzeImageWithAI(base64, img.file.type, constraints, appSettings);
      setImages(prev => prev.map(i => i.id === id ? { 
        ...i, 
        status: 'completed', 
        seoData: result 
      } : i));
    } catch (err: any) {
      let errorMsg = err.message;
      if (errorMsg.includes("MISSING_KEY")) {
        errorMsg = "API Key missing. Go to Settings.";
      }
      setImages(prev => prev.map(i => i.id === id ? { ...i, status: 'error', error: errorMsg } : i));
    }
  };

  const processBatch = async () => {
    setStatus(ProcessingStatus.ANALYZING);
    const pending = images.filter(i => i.status === 'pending' || i.status === 'error');
    for (const img of pending) {
      await processSingle(img.id);
    }
    setStatus(ProcessingStatus.COMPLETED);
  };

  const clearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const exportCSV = () => {
    const fields = PLATFORM_FIELDS[constraints.selectedPlatform];
    const headerCols = ["Filename"];
    if (fields.title) headerCols.push("Title");
    if (fields.description) headerCols.push("Description");
    if (fields.keywords) headerCols.push("Keywords");
    const header = headerCols.join(",") + "\n";
    const rows = images.filter(i => i.seoData).map(i => {
      const d = i.seoData!;
      const rowData = [`"${i.file.name}"`];
      if (fields.title) rowData.push(`"${d.title.replace(/"/g, '""')}"`);
      if (fields.description) rowData.push(`"${(d.description || "").replace(/"/g, '""')}"`);
      if (fields.keywords) rowData.push(`"${d.keywords.join(',')}"`);
      return rowData.join(",");
    }).join("\n");
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `seo_export_${constraints.selectedPlatform}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const aiBrains: { id: AIModel, name: string, provider: string, icon: any, keyField: keyof AppSettings['keys'] }[] = [
    { id: 'llama-3.2-11b-vision-preview', name: 'Llama 3.2 (11B)', provider: 'Groq', icon: Cpu, keyField: 'groq' },
    { id: 'llama-3.2-90b-vision-preview', name: 'Llama 3.2 (90B)', provider: 'Groq', icon: Cpu, keyField: 'groq' },
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', icon: Globe, keyField: 'openai' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', icon: Globe, keyField: 'openai' },
    { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'DeepSeek', icon: ShieldCheck, keyField: 'deepseek' },
    { id: 'openrouter-auto', name: 'Auto Best', provider: 'OpenRouter', icon: Sparkles, keyField: 'openrouter' },
  ];

  const currentBrain = aiBrains.find(b => b.id === appSettings.selectedModel);
  const hasSelectedKey = currentBrain ? !!appSettings.keys[currentBrain.keyField] : false;

  return (
    <div className="flex h-screen bg-[#0a0c0f] text-slate-300 font-sans overflow-hidden">
      
      {/* LEFT: CONTROLS */}
      <aside className="w-[360px] bg-[#12151a] border-r border-[#1e2229] flex flex-col shrink-0 z-20 shadow-xl">
        <div className="p-5 border-b border-[#1e2229] flex items-center justify-between bg-[#16191e]">
          <div className="flex items-center gap-2">
            <Sliders className="text-orange-500 w-4 h-4" />
            <h1 className="font-bold text-xs text-slate-200 uppercase tracking-widest">Metadata Engine</h1>
          </div>
          <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <Settings className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">
          <section>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-4">Stock Platform</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'Generic', icon: Sparkles },
                { id: 'Shutterstock', icon: 'St' },
                { id: 'Adobe Stock', icon: Layers },
                { id: 'Freepik', icon: 'F' },
                { id: 'Vecteezy', icon: 'V' },
                { id: 'Pond5', icon: 'P' },
              ].map((plat) => (
                <div 
                  key={plat.id} 
                  onClick={() => setConstraints({ ...constraints, selectedPlatform: plat.id as ExportPlatform })}
                  className={`relative h-12 flex items-center justify-center rounded-xl border-2 transition-all cursor-pointer ${
                    constraints.selectedPlatform === plat.id 
                      ? 'border-orange-500 bg-orange-500/10' 
                      : 'border-slate-800 bg-[#1a1e25] hover:border-slate-700'
                  }`}
                >
                  {typeof plat.icon === 'string' ? (
                    <span className={`font-black text-sm ${constraints.selectedPlatform === plat.id ? 'text-orange-400' : 'text-slate-500'}`}>
                      {plat.icon}
                    </span>
                  ) : (
                    <plat.icon className={`w-5 h-5 ${constraints.selectedPlatform === plat.id ? 'text-orange-400' : 'text-slate-500'}`} />
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[11px] font-bold text-slate-400">Title Limit</label>
                <span className="text-[10px] text-orange-500 font-bold">{constraints.maxTitleChars}</span>
              </div>
              <input type="range" min="30" max="200" value={constraints.maxTitleChars} onChange={e => setConstraints({...constraints, maxTitleChars: parseInt(e.target.value)})} className="w-full accent-orange-500 h-[3px] bg-slate-800 rounded-lg appearance-none cursor-pointer" />
            </div>
            {PLATFORM_FIELDS[constraints.selectedPlatform].description && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[11px] font-bold text-slate-400">Description Limit</label>
                  <span className="text-[10px] text-orange-500 font-bold">{constraints.maxDescChars}</span>
                </div>
                <input type="range" min="50" max="300" value={constraints.maxDescChars} onChange={e => setConstraints({...constraints, maxDescChars: parseInt(e.target.value)})} className="w-full accent-orange-500 h-[3px] bg-slate-800 rounded-lg appearance-none cursor-pointer" />
              </div>
            )}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[11px] font-bold text-slate-400">Keywords Goal</label>
                <span className="text-[10px] text-orange-500 font-bold">{constraints.keywordCount}</span>
              </div>
              <input type="range" min="5" max="50" value={constraints.keywordCount} onChange={e => setConstraints({...constraints, keywordCount: parseInt(e.target.value)})} className="w-full accent-orange-500 h-[3px] bg-slate-800 rounded-lg appearance-none cursor-pointer" />
            </div>
          </section>

          <section className="space-y-4 pt-4 border-t border-slate-800/50">
            {['prefix', 'suffix', 'negWordsTitle', 'negKeywords'].map((key) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                  <Switch checked={(constraints as any)[key + 'Enabled']} onChange={(v) => setConstraints({...constraints, [key + 'Enabled']: v})} />
                </div>
                {(constraints as any)[key + 'Enabled'] && (
                  <input type="text" placeholder={`Enter text...`} value={(constraints as any)[key]} onChange={(e) => setConstraints({...constraints, [key]: e.target.value})} className="w-full bg-[#0d0f12] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:border-orange-500 transition-all" />
                )}
              </div>
            ))}
          </section>
        </div>

        <div className="p-5 border-t border-[#1e2229] bg-[#16191e]">
          <button onClick={processBatch} disabled={images.length === 0 || status === ProcessingStatus.ANALYZING || !hasSelectedKey} className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 group">
            <Zap className={`w-4 h-4 ${status === ProcessingStatus.ANALYZING ? 'animate-pulse' : 'group-hover:animate-bounce'}`} /> 
            {!hasSelectedKey ? 'Configure API First' : 'Generate Metadata'}
          </button>
        </div>
      </aside>

      {/* MIDDLE: WORKSPACE */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0a0c0f]">
        <header className="px-8 py-6 border-b border-[#1e2229] bg-[#12151a]/50 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-3">
              Groq Vision <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded border border-orange-500/30">Llama 3.2</span>
            </h2>
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">
              Active Provider: <span className="text-orange-500">{currentBrain?.provider}</span>
            </p>
          </div>
          <div className="flex gap-4">
             <div className="px-4 py-2 bg-slate-800/40 rounded-xl border border-slate-700/50 flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${hasSelectedKey ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-red-500 animate-pulse'}`} />
                <span className="text-[10px] font-bold text-slate-300 uppercase">{currentBrain?.provider} {hasSelectedKey ? 'READY' : 'KEY MISSING'}</span>
             </div>
          </div>
        </header>

        <div className="px-8 py-6">
          <div onClick={() => fileInputRef.current?.click()} className="group h-40 border-2 border-dashed border-slate-800 hover:border-orange-500/50 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all bg-[#12151a]/30">
            <Upload className="w-10 h-10 text-slate-700 group-hover:text-orange-500 transition-colors mb-2" />
            <p className="text-xs font-bold text-slate-400">DRAG & DROP IMAGES OR CLICK TO UPLOAD</p>
            <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleUpload} />
          </div>
        </div>

        <div className="px-8 py-4 flex items-center justify-between border-b border-[#1e2229]">
          <div className="flex gap-2">
            <button onClick={clearAll} className="flex items-center gap-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all"><Trash2 className="w-3.5 h-3.5" /> Clear</button>
            <button onClick={exportCSV} disabled={images.filter(i => i.status === 'completed').length === 0} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-30"><Download className="w-3.5 h-3.5" /> Export</button>
          </div>
          <div className="flex-1 max-w-xs mx-8">
             <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 transition-all duration-700 shadow-[0_0_8px_rgba(249,115,22,0.4)]" style={{ width: images.length > 0 ? `${(images.filter(i=>i.status==='completed').length / images.length) * 100}%` : '0%' }} />
             </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">
          {images.map(img => (
            <div key={img.id} className={`bg-[#12151a] border-2 rounded-2xl p-6 flex gap-8 transition-all relative ${img.status === 'completed' ? 'border-orange-500/20' : 'border-slate-800'}`}>
              <div className="w-60 shrink-0 flex flex-col">
                <div className="relative rounded-xl overflow-hidden border border-slate-800 aspect-square bg-black shadow-2xl">
                  <img src={img.previewUrl} className="w-full h-full object-contain" alt="Preview" />
                  {img.status === 'processing' && (<div className="absolute inset-0 bg-black/70 flex items-center justify-center"><RefreshCw className="w-10 h-10 text-orange-500 animate-spin" /></div>)}
                </div>
                <p className="mt-3 text-[10px] font-mono text-slate-600 truncate">{img.file.name}</p>
                {img.error && <p className="text-[10px] text-red-500 mt-2 bg-red-500/10 p-2 rounded-lg border border-red-500/20">{img.error}</p>}
              </div>
              
              <div className="flex-1 grid grid-cols-1 gap-4">
                {PLATFORM_FIELDS[constraints.selectedPlatform].title && (
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-[9px] font-black text-slate-600 uppercase">Optimized Title</label>
                      <button onClick={() => copyToClipboard(img.seoData?.title || '')} className="text-orange-500 hover:text-orange-400 transition-colors"><Copy className="w-3 h-3" /></button>
                    </div>
                    <div className="bg-[#0a0c0f] border border-slate-800 rounded-xl p-3 text-sm text-slate-300 min-h-[50px]">
                      {img.seoData?.title || (img.status === 'processing' ? 'Thinking...' : '')}
                    </div>
                  </div>
                )}
                
                {PLATFORM_FIELDS[constraints.selectedPlatform].keywords && (
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-[9px] font-black text-slate-600 uppercase">Keywords ({img.seoData?.keywords.length || 0})</label>
                      <button onClick={() => copyToClipboard(img.seoData?.keywords.join(', ') || '')} className="text-orange-500 hover:text-orange-400 transition-colors"><Copy className="w-3 h-3" /></button>
                    </div>
                    <div className="bg-[#0a0c0f] border border-slate-800 rounded-xl p-3 text-xs text-slate-400 min-h-[80px] leading-relaxed">
                      {img.seoData?.keywords.join(', ') || (img.status === 'processing' ? 'Analyzing visual elements...' : '')}
                    </div>
                    {img.status === 'completed' && (
                      <button onClick={() => processSingle(img.id)} className="mt-2 text-[10px] font-bold text-slate-500 hover:text-orange-500 flex items-center gap-1.5 transition-colors">
                        <RefreshCw className="w-3 h-3" /> RE-GENERATE
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {images.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center py-20 grayscale opacity-20 select-none">
               <Layers className="w-32 h-32 mb-4" />
               <p className="text-2xl font-black italic tracking-tighter">STOCK SEO VISION</p>
               <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">Powered by Groq Llama 3.2</p>
            </div>
          )}
        </div>
      </main>

      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-[#12151a] border border-slate-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BrainCircuit className="w-6 h-6 text-orange-500" />
                <h2 className="text-lg font-black text-white uppercase tracking-tight">AI Engine Settings</h2>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><X className="w-6 h-6 text-slate-500" /></button>
            </div>

            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <section>
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Select AI Model</h3>
                <div className="grid grid-cols-2 gap-3">
                  {aiBrains.map(m => (
                    <div 
                      key={m.id}
                      onClick={() => setAppSettings({ ...appSettings, selectedModel: m.id })}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-4 ${appSettings.selectedModel === m.id ? 'border-orange-500 bg-orange-500/5' : 'border-slate-800 bg-[#16191e] hover:border-slate-700'}`}
                    >
                      <m.icon className={`w-5 h-5 ${appSettings.selectedModel === m.id ? 'text-orange-500' : 'text-slate-600'}`} />
                      <div>
                        <p className="text-xs font-bold text-slate-200">{m.name}</p>
                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{m.provider}</p>
                      </div>
                      {appSettings.selectedModel === m.id && <Check className="ml-auto w-4 h-4 text-orange-500" />}
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">API Configuration</h3>
                <div className="bg-[#16191e] p-6 rounded-2xl border-2 border-slate-800 space-y-6">
                  {/* Priority to Groq as requested */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Groq API Key (Recommended)</label>
                      {appSettings.keys.groq && <span className="text-[9px] text-green-500 font-black">ACTIVE</span>}
                    </div>
                    <div className="relative">
                       <Cpu className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700" />
                       <input 
                         type="password"
                         placeholder="Paste Groq API Key..."
                         value={appSettings.keys.groq}
                         onChange={(e) => setAppSettings({ ...appSettings, keys: { ...appSettings.keys, groq: e.target.value } })}
                         className="w-full bg-[#0d0f12] border border-slate-800 rounded-xl pl-12 pr-4 py-3.5 text-sm text-slate-300 focus:border-orange-500 outline-none transition-all"
                       />
                    </div>
                    <p className="text-[9px] text-slate-600 italic">Groq Llama 3.2 is fast, free (for now), and highly capable at visual analysis.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 pt-4 border-t border-slate-800/50">
                    {aiBrains.filter(b => b.provider !== 'Groq' && b.provider !== 'OpenRouter').map(b => (
                      <div key={b.provider} className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">{b.provider} Key</label>
                        <input 
                           type="password"
                           placeholder={`${b.provider} Secret...`}
                           value={(appSettings.keys as any)[b.keyField]}
                           onChange={(e) => setAppSettings({ ...appSettings, keys: { ...appSettings.keys, [b.keyField]: e.target.value } })}
                           className="w-full bg-[#0d0f12] border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-400 focus:border-orange-500 outline-none"
                         />
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            <div className="p-6 border-t border-slate-800 bg-[#16191e] flex justify-end gap-4">
              <button onClick={() => setIsSettingsOpen(false)} className="bg-orange-600 hover:bg-orange-500 text-white font-black text-xs uppercase tracking-widest px-8 py-4 rounded-xl shadow-lg transition-all active:scale-95">
                 Save & Initialize
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e2229; border-radius: 10px; }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 14px;
          width: 14px;
          border-radius: 50%;
          background: #f97316;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(249, 115, 22, 0.4);
        }
      `}</style>
    </div>
  );
};

export default App;
