
import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Trash2, Download, Zap, 
  X, Copy, RefreshCw, Settings, Sliders, 
  Sparkles, BrainCircuit,
  Cpu, Globe, ShieldCheck, AlertCircle, Key, ZapOff, Server, Link
} from 'lucide-react';
import { OptimizedImage, StockConstraints, ProcessingStatus, SEOData, ExportPlatform, PLATFORM_FIELDS, AppSettings } from './types';
import { analyzeImageWithAI } from './services/aiService';

const Switch = ({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) => (
  <button 
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none ${checked ? 'bg-orange-500' : 'bg-slate-700'}`}
  >
    <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
  </button>
);

const App: React.FC = () => {
  const [images, setImages] = useState<OptimizedImage[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('seo_vision_settings_v6');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { 
        ...parsed, 
        useProxy: parsed.useProxy ?? true,
        customBackendUrl: parsed.customBackendUrl ?? 'http://localhost:5000/proxy'
      };
    }
    return {
      useProxy: true,
      customBackendUrl: 'http://localhost:5000/proxy',
      keys: { groq: [], openai: [], gemini: [], deepseek: [], openrouter: [] }
    };
  });

  useEffect(() => {
    localStorage.setItem('seo_vision_settings_v6', JSON.stringify(appSettings));
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
    selectedPlatform: 'Generic'
  });

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

    setImages(prev => prev.map(i => i.id === id ? { ...i, status: 'processing', error: undefined } : i));
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(img.file);
      });
      
      const result = await analyzeImageWithAI(base64, img.file.type, constraints, appSettings);
      setImages(prev => prev.map(i => i.id === id ? { ...i, status: 'completed', seoData: result } : i));
    } catch (err: any) {
      setImages(prev => prev.map(i => i.id === id ? { ...i, status: 'error', error: err.message } : i));
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

  const exportCSV = () => {
    const fields = PLATFORM_FIELDS[constraints.selectedPlatform];
    const headerCols = ["Filename", "Title", "Keywords"];
    if (fields.description) headerCols.push("Description");
    const header = headerCols.join(",") + "\n";
    const rows = images.filter(i => i.seoData).map(i => {
      const d = i.seoData!;
      const rowData = [`"${i.file.name}"`, `"${d.title}"`, `"${d.keywords.join(',')}"`];
      if (fields.description) rowData.push(`"${d.description || ""}"`);
      return rowData.join(",");
    }).join("\n");
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `seo_export_${constraints.selectedPlatform}.csv`;
    link.click();
  };

  const totalKeys = Object.values(appSettings.keys).flat().length;

  return (
    <div className="flex h-screen bg-[#0a0c0f] text-slate-300 font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-[340px] bg-[#12151a] border-r border-[#1e2229] flex flex-col shrink-0 z-20 shadow-2xl">
        <div className="p-6 border-b border-[#1e2229] flex items-center justify-between bg-[#16191e]">
          <div className="flex items-center gap-2">
            <Sparkles className="text-orange-500 w-5 h-5 animate-pulse" />
            <h1 className="font-black text-xs text-white uppercase tracking-widest">SEO Auto-Pilot V6</h1>
          </div>
          <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-slate-700 rounded-xl transition-all relative">
            <Settings className="w-4 h-4 text-slate-400" />
            {totalKeys === 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          <section>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">Stock Platform</label>
            <div className="grid grid-cols-3 gap-2">
              {['Generic', 'Shutterstock', 'Adobe Stock', 'Freepik', 'Vecteezy', 'Pond5'].map((id) => (
                <div 
                  key={id} 
                  onClick={() => setConstraints({ ...constraints, selectedPlatform: id as ExportPlatform })}
                  className={`h-12 flex items-center justify-center rounded-xl border-2 transition-all cursor-pointer text-[10px] font-bold ${
                    constraints.selectedPlatform === id 
                      ? 'border-orange-500 bg-orange-500/10 text-orange-400' 
                      : 'border-slate-800 bg-[#1a1e25] text-slate-500 hover:border-slate-700'
                  }`}
                >
                  {id.split(' ')[0]}
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6 pt-4 border-t border-slate-800/50">
             <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Title Limit</label>
                <span className="text-[10px] text-orange-500 font-bold">{constraints.maxTitleChars}</span>
              </div>
              <input type="range" min="30" max="200" value={constraints.maxTitleChars} onChange={e => setConstraints({...constraints, maxTitleChars: parseInt(e.target.value)})} className="w-full accent-orange-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Tags Limit</label>
                <span className="text-[10px] text-orange-500 font-bold">{constraints.keywordCount}</span>
              </div>
              <input type="range" min="10" max="50" value={constraints.keywordCount} onChange={e => setConstraints({...constraints, keywordCount: parseInt(e.target.value)})} className="w-full accent-orange-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
            </div>
          </section>

          <section className="space-y-4 pt-4 border-t border-slate-800/50">
            {['prefix', 'suffix', 'negWordsTitle', 'negKeywords'].map((key) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{key.replace(/([A-Z])/g, ' $1')}</span>
                  <Switch checked={(constraints as any)[key + 'Enabled']} onChange={(v) => setConstraints({...constraints, [key + 'Enabled']: v})} />
                </div>
                {(constraints as any)[key + 'Enabled'] && (
                  <input type="text" value={(constraints as any)[key]} onChange={(e) => setConstraints({...constraints, [key]: e.target.value})} className="w-full bg-[#0d0f12] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:border-orange-500" />
                )}
              </div>
            ))}
          </section>
        </div>

        <div className="p-6 border-t border-[#1e2229] bg-[#16191e]">
          <button 
            onClick={processBatch} 
            disabled={images.length === 0 || status === ProcessingStatus.ANALYZING || totalKeys === 0} 
            className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black py-4 rounded-xl shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 group"
          >
            <Zap className={`w-5 h-5 ${status === ProcessingStatus.ANALYZING ? 'animate-pulse' : 'group-hover:animate-bounce'}`} /> 
            {totalKeys === 0 ? 'CONFIGURE KEYS' : 'GENERATE SEO DATA'}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0a0c0f]">
        <header className="px-10 py-8 border-b border-[#1e2229] bg-[#12151a]/30 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-4">
              Visual AI Console <span className="text-[10px] bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full border border-orange-500/30 font-bold uppercase tracking-widest">Server-Link Mode</span>
            </h2>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                Ready with <span className="text-white">{totalKeys}</span> active keys
              </p>
              {appSettings.useProxy && (
                <span className="flex items-center gap-1.5 text-[10px] text-green-500 font-bold uppercase tracking-widest">
                  <Server className="w-3 h-3" /> Private Proxy: Active
                </span>
              )}
            </div>
          </div>
        </header>

        <div className="px-10 py-6">
          <div onClick={() => fileInputRef.current?.click()} className="group h-32 border-2 border-dashed border-slate-800 hover:border-orange-500/40 rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-all bg-[#12151a]/20">
            <Upload className="w-8 h-8 text-slate-700 group-hover:text-orange-500 transition-colors mb-2" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select Stock Images</p>
            <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleUpload} />
          </div>
        </div>

        <div className="px-10 py-4 flex items-center justify-between border-y border-[#1e2229]">
          <div className="flex gap-3">
            <button onClick={clearAll} className="bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2"><Trash2 className="w-4 h-4" /> Clear</button>
            <button onClick={exportCSV} disabled={images.filter(i => i.status === 'completed').length === 0} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 disabled:opacity-20"><Download className="w-4 h-4" /> Download CSV</button>
          </div>
          <div className="flex-1 max-w-sm mx-10">
             <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div className="h-full bg-orange-500 transition-all duration-700" style={{ width: images.length > 0 ? `${(images.filter(i=>i.status==='completed').length / images.length) * 100}%` : '0%' }} />
             </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-6">
          {images.map(img => (
            <div key={img.id} className={`bg-[#12151a] border-2 rounded-3xl p-6 flex gap-10 transition-all ${img.status === 'completed' ? 'border-orange-500/10' : 'border-slate-800'} ${img.status === 'error' ? 'border-red-900/30' : ''}`}>
              <div className="w-44 shrink-0">
                <div className="relative rounded-2xl overflow-hidden border border-slate-800 aspect-square bg-black">
                  <img src={img.previewUrl} className="w-full h-full object-contain" alt="Preview" />
                  {img.status === 'processing' && (<div className="absolute inset-0 bg-black/80 flex items-center justify-center"><RefreshCw className="w-8 h-8 text-orange-500 animate-spin" /></div>)}
                </div>
                {img.error && (
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
                    <ZapOff className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <p className="text-[9px] text-red-400 font-bold leading-tight">{img.error}</p>
                  </div>
                )}
              </div>
              
              <div className="flex-1 flex flex-col gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Optimized Title</label>
                    <button onClick={() => navigator.clipboard.writeText(img.seoData?.title || '')} className="text-orange-500 hover:text-orange-400"><Copy className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="bg-[#0a0c0f] border border-slate-800 rounded-xl p-4 text-sm text-slate-300 min-h-[50px]">
                    {img.seoData?.title || (img.status === 'processing' ? 'Thinking...' : '')}
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Stock Keywords ({img.seoData?.keywords.length || 0})</label>
                    <button onClick={() => navigator.clipboard.writeText(img.seoData?.keywords.join(', ') || '')} className="text-orange-500 hover:text-orange-400"><Copy className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="bg-[#0a0c0f] border border-slate-800 rounded-xl p-4 text-xs text-slate-400 min-h-[60px] leading-relaxed">
                    {img.seoData?.keywords.join(', ') || (img.status === 'processing' ? 'Extracting tags...' : '')}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {images.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center py-32 opacity-10 select-none">
               <BrainCircuit className="w-40 h-40 mb-6" />
               <p className="text-3xl font-black italic">DRAG IMAGES TO BEGIN</p>
            </div>
          )}
        </div>
      </main>

      {/* SETTINGS */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl">
          <div className="bg-[#12151a] border border-slate-800 w-full max-w-3xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-[#16191e]">
              <div className="flex items-center gap-4">
                <Key className="w-6 h-6 text-orange-500" />
                <h2 className="text-xl font-black text-white uppercase tracking-tight">AI Key Manager (Auto-Rotation)</h2>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-slate-800 rounded-full transition-all text-slate-500 hover:text-white"><X className="w-7 h-7" /></button>
            </div>

            <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* PROXY SETTING */}
              <div className="p-6 bg-orange-500/5 border border-orange-500/20 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Server className="w-6 h-6 text-orange-500" />
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">Server-Side Proxy (Fix CORS)</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Directly bypass browser restrictions by routing through a private server</p>
                    </div>
                  </div>
                  <Switch 
                    checked={appSettings.useProxy} 
                    onChange={(v) => setAppSettings({ ...appSettings, useProxy: v })} 
                  />
                </div>
                
                {appSettings.useProxy && (
                  <div className="pt-4 border-t border-orange-500/10">
                    <div className="flex items-center gap-2 mb-2">
                       <Link className="w-3 h-3 text-orange-500" />
                       <label className="text-[10px] font-black text-slate-400 uppercase">Your Backend Proxy URL</label>
                    </div>
                    <input 
                      type="text"
                      value={appSettings.customBackendUrl}
                      onChange={(e) => setAppSettings({ ...appSettings, customBackendUrl: e.target.value })}
                      placeholder="http://localhost:5000/proxy"
                      className="w-full bg-[#0d0f12] border border-slate-800 rounded-xl px-4 py-3 text-xs text-orange-400 outline-none focus:border-orange-500 font-mono"
                    />
                    <p className="text-[9px] text-slate-600 mt-2 font-medium">Tip: Use `http://localhost:5000/proxy` if running your own local Node.js script.</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-8">
                {[
                  { id: 'groq', name: 'Groq (Llama)', icon: Cpu, color: 'text-orange-500' },
                  { id: 'gemini', name: 'Google Gemini', icon: Sparkles, color: 'text-blue-400' },
                  { id: 'openai', name: 'OpenAI (GPT)', icon: Globe, color: 'text-green-400' },
                  { id: 'deepseek', name: 'DeepSeek', icon: ShieldCheck, color: 'text-purple-400' },
                  { id: 'openrouter', name: 'OpenRouter (Omni)', icon: Zap, color: 'text-yellow-400' },
                ].map(prov => (
                  <div key={prov.id} className="space-y-3">
                    <div className="flex items-center gap-2">
                       <prov.icon className={`w-4 h-4 ${prov.color}`} />
                       <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{prov.name}</h3>
                    </div>
                    <textarea 
                      placeholder={`Keys separated by commas...`}
                      value={appSettings.keys[prov.id as keyof AppSettings['keys']].join('\n')}
                      onChange={(e) => setAppSettings({ 
                        ...appSettings, 
                        keys: { ...appSettings.keys, [prov.id]: e.target.value.split(/[\n,]+/).filter(k => k.trim()) } 
                      })}
                      className="w-full bg-[#0d0f12] border border-slate-800 rounded-2xl p-4 text-xs text-slate-500 focus:border-orange-500 outline-none transition-all min-h-[100px] font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 border-t border-slate-800 bg-[#16191e] flex justify-center">
              <button onClick={() => setIsSettingsOpen(false)} className="bg-orange-600 hover:bg-orange-500 text-white font-black text-xs uppercase tracking-[0.2em] px-16 py-5 rounded-2xl shadow-xl transition-all active:scale-95">
                 Save & Re-Connect
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e2229; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #f97316; }
      `}</style>
    </div>
  );
};

export default App;
