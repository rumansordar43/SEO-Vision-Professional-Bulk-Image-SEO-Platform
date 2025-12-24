
import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Database, CheckCircle, AlertCircle, Trash2, Download, Zap, Layers,
  FileSpreadsheet, X, Clock, ExternalLink, Edit2, Sliders, Settings,
  Lock, Check, ChevronDown, Sparkles, Copy, RefreshCw, Key, Monitor, BrainCircuit,
  Cpu, Globe, ShieldCheck, ZapOff
} from 'lucide-react';
import { OptimizedImage, StockConstraints, ProcessingStatus, SEOData, ExportPlatform, PLATFORM_FIELDS, AIModel, AppSettings } from './types';
import { analyzeStockImage } from './services/geminiService';

const Switch = ({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) => (
  <button 
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-teal-500' : 'bg-slate-700'}`}
  >
    <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
  </button>
);

const App: React.FC = () => {
  const [images, setImages] = useState<OptimizedImage[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasGoogleKey, setHasGoogleKey] = useState(false);
  
  // App Settings State
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('seo_vision_settings');
    return saved ? JSON.parse(saved) : {
      selectedModel: 'gemini-3-flash-preview',
      keys: { groq: '', openai: '', deepseek: '', openrouter: '' }
    };
  });

  useEffect(() => {
    localStorage.setItem('seo_vision_settings', JSON.stringify(appSettings));
  }, [appSettings]);

  // Check Google Key on mount
  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasGoogleKey(hasKey);
      }
    };
    checkKey();
  }, []);

  // Advanced Metadata Controls State
  const [constraints, setConstraints] = useState<StockConstraints>({
    maxTitleChars: 100,
    maxDescChars: 150,
    keywordCount: 46,
    excludeKeywords: [],
    imageType: 'None',
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

  // Keep constraints in sync with settings model
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

    // Check if the model is Gemini (only Gemini is supported via the provided SDK for vision here)
    if (!constraints.model.startsWith('gemini')) {
      setImages(prev => prev.map(i => i.id === id ? { 
        ...i, 
        status: 'error', 
        error: `Model ${constraints.model} integration is pending. Please use Gemini for visual analysis.` 
      } : i));
      return;
    }

    setImages(prev => prev.map(i => i.id === id ? { ...i, status: 'processing' } : i));
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(img.file);
      });
      
      const result = await analyzeStockImage(base64, img.file.type, constraints);
      setImages(prev => prev.map(i => i.id === id ? { 
        ...i, 
        status: 'completed', 
        seoData: result 
      } : i));
    } catch (err: any) {
      if (err.message?.includes("API_KEY_ERROR")) {
        setHasGoogleKey(false);
      }
      setImages(prev => prev.map(i => i.id === id ? { ...i, status: 'error', error: err.message } : i));
    }
  };

  const processBatch = async () => {
    setStatus(ProcessingStatus.ANALYZING);
    const pending = images.filter(i => i.status === 'pending' || i.status === 'error' || i.status === 'processing');
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
    link.download = `stock_export_${constraints.selectedPlatform}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleOpenGoogleKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasGoogleKey(true);
    }
  };

  const aiBrains: { id: AIModel, name: string, provider: string, icon: any, keyField?: string }[] = [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'Google', icon: BrainCircuit },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', provider: 'Google', icon: BrainCircuit },
    { id: 'groq-llama-3.1-70b', name: 'Llama 3.1 (70B)', provider: 'Groq', icon: Cpu, keyField: 'groq' },
    { id: 'openai-gpt-4o', name: 'GPT-4o', provider: 'OpenAI', icon: Globe, keyField: 'openai' },
    { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'DeepSeek', icon: ShieldCheck, keyField: 'deepseek' },
    { id: 'openrouter-auto', name: 'Auto (Best Price)', provider: 'OpenRouter', icon: Sparkles, keyField: 'openrouter' },
  ];

  const currentBrain = aiBrains.find(b => b.id === appSettings.selectedModel);

  return (
    <div className="flex h-screen bg-[#0d0f12] text-slate-300 font-sans overflow-hidden">
      
      {/* LEFT: ADVANCE METADATA CONTROLS */}
      <aside className="w-[360px] bg-[#16191e] border-r border-[#1e2229] flex flex-col shrink-0 z-20">
        <div className="p-5 border-b border-[#1e2229] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="text-teal-500 w-4 h-4" />
            <h1 className="font-bold text-sm text-slate-200 uppercase tracking-tight">Advance Metadata Controls</h1>
          </div>
          <button className="text-[10px] bg-slate-800 text-slate-400 px-3 py-1 rounded border border-slate-700 font-bold hover:text-white transition-all">Collapse</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-8 scrollbar-hide">
          <section>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-4">Export Platform</label>
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
                  className={`relative h-12 flex items-center justify-center rounded-lg border transition-all cursor-pointer ${
                    constraints.selectedPlatform === plat.id 
                      ? 'border-teal-500 bg-teal-500/5 ring-1 ring-teal-500/30' 
                      : 'border-slate-800 bg-[#1a1e25] hover:border-slate-700'
                  }`}
                >
                  {typeof plat.icon === 'string' ? (
                    <span className={`font-bold ${constraints.selectedPlatform === plat.id ? 'text-teal-400' : 'text-slate-500'}`}>
                      {plat.icon}
                    </span>
                  ) : (
                    <plat.icon className={`w-5 h-5 ${constraints.selectedPlatform === plat.id ? 'text-teal-400' : 'text-slate-500'}`} />
                  )}
                  {constraints.selectedPlatform === plat.id && (
                    <div className="absolute -top-1 -right-1 bg-teal-500 rounded-full p-0.5 shadow-lg">
                      <Check className="w-2 h-2 text-white" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[11px] font-bold text-slate-400">Title Length</label>
                <span className="text-[10px] text-slate-500">{constraints.maxTitleChars} Characters</span>
              </div>
              <input type="range" min="30" max="200" value={constraints.maxTitleChars} onChange={e => setConstraints({...constraints, maxTitleChars: parseInt(e.target.value)})} className="w-full accent-teal-500 h-[3px] bg-slate-800 rounded-lg appearance-none cursor-pointer" />
            </div>
            {PLATFORM_FIELDS[constraints.selectedPlatform].description && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[11px] font-bold text-slate-400">Description Length</label>
                  <span className="text-[10px] text-slate-500">{constraints.maxDescChars} Characters</span>
                </div>
                <input type="range" min="50" max="300" value={constraints.maxDescChars} onChange={e => setConstraints({...constraints, maxDescChars: parseInt(e.target.value)})} className="w-full accent-teal-500 h-[3px] bg-slate-800 rounded-lg appearance-none cursor-pointer" />
              </div>
            )}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[11px] font-bold text-slate-400">Keywords Count</label>
                <span className="text-[10px] text-slate-500">{constraints.keywordCount} Keywords</span>
              </div>
              <input type="range" min="5" max="50" value={constraints.keywordCount} onChange={e => setConstraints({...constraints, keywordCount: parseInt(e.target.value)})} className="w-full accent-teal-500 h-[3px] bg-slate-800 rounded-lg appearance-none cursor-pointer" />
            </div>
          </section>

          <section>
            <label className="text-[11px] font-bold text-slate-400 block mb-2">Image Type</label>
            <div className="relative group">
              <select value={constraints.imageType} onChange={(e) => setConstraints({...constraints, imageType: e.target.value as any})} className="w-full bg-[#1a1e25] border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-slate-400 appearance-none focus:outline-none focus:border-teal-500 transition-all">
                <option value="None">None</option><option value="Photo">Photo</option><option value="Vector">Vector</option><option value="Illustration">Illustration</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
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
                  <input type="text" placeholder={`Enter ${key}...`} value={(constraints as any)[key]} onChange={(e) => setConstraints({...constraints, [key]: e.target.value})} className="w-full bg-[#0d0f12] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:border-teal-500 transition-all" />
                )}
              </div>
            ))}
          </section>
        </div>

        <div className="p-5 border-t border-[#1e2229] space-y-3">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="w-full bg-[#1a1e25] hover:bg-slate-800 text-slate-400 hover:text-white font-bold py-2.5 rounded-xl border border-slate-800 transition-all flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" /> Settings
          </button>
          <button onClick={processBatch} disabled={images.length === 0 || status === ProcessingStatus.ANALYZING} className="w-full bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95">
            <Zap className={`w-4 h-4 ${status === ProcessingStatus.ANALYZING ? 'animate-spin' : ''}`} /> Generate SEO
          </button>
        </div>
      </aside>

      {/* MIDDLE: MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0d0f12] overflow-hidden">
        <div className="p-8 border-b border-[#1e2229] bg-[#16191e]/30 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white">Upload Files</h2>
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">Active Brain: <span className="text-teal-500">{currentBrain?.name}</span></p>
          </div>
          <div className="flex gap-2">
             <div className="px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${hasGoogleKey ? 'bg-teal-500 shadow-[0_0_8px_rgba(45,212,191,0.5)]' : 'bg-red-500 animate-pulse'}`} />
                <span className="text-[10px] font-bold text-slate-400">Gemini {hasGoogleKey ? 'Online' : 'Offline'}</span>
             </div>
          </div>
        </div>

        <div className="px-8 py-4">
          <div onClick={() => fileInputRef.current?.click()} className="group h-44 border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-teal-500/50 transition-all bg-[#16191e]/20">
            <div className="mb-3 p-4 bg-slate-800/20 rounded-full group-hover:scale-110 transition-transform"><Upload className="w-8 h-8 text-slate-600 group-hover:text-teal-500 transition-colors" /></div>
            <p className="text-sm font-bold text-slate-200">Drag & drop images here, or click to browse</p>
            <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleUpload} />
          </div>
        </div>

        <div className="px-8 py-4 flex items-center justify-between border-b border-[#1e2229] bg-[#0d0f12]">
          <div className="flex-1 mr-8">
             <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-teal-500 transition-all duration-1000" style={{ width: images.length > 0 ? `${(images.filter(i=>i.status==='completed').length / images.length) * 100}%` : '0%' }} />
             </div>
             {!hasGoogleKey && appSettings.selectedModel.startsWith('gemini') && (
               <p className="text-[11px] font-medium text-amber-500 animate-pulse">
                 Google API key not connected. Open Settings to link your account.
               </p>
             )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={clearAll} className="flex items-center gap-2 bg-[#ff4d4d]/10 text-[#ff4d4d] hover:bg-[#ff4d4d] hover:text-white border border-[#ff4d4d]/20 px-6 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95"><Trash2 className="w-3.5 h-3.5" /> Clear All</button>
            <button onClick={processBatch} disabled={images.length === 0 || status === ProcessingStatus.ANALYZING} className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 active:scale-95 shadow-lg shadow-teal-900/20"><Sparkles className="w-3.5 h-3.5" /> Optimize All</button>
            <button onClick={exportCSV} disabled={images.filter(i => i.status === 'completed').length === 0} className="flex items-center gap-2 bg-[#1a1e25] hover:bg-slate-800 text-slate-300 border border-slate-700 px-6 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50"><Download className="w-3.5 h-3.5" /> Export CSV</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">
          {images.map(img => (
            <div key={img.id} className={`bg-[#16191e] border rounded-2xl p-6 flex gap-8 transition-all relative ${img.status === 'completed' ? 'border-teal-500/30' : 'border-[#1e2229]'}`}>
              <div className="w-64 shrink-0 flex flex-col">
                <div className="relative group rounded-xl overflow-hidden border border-[#1e2229] aspect-square bg-black">
                  <img src={img.previewUrl} className="w-full h-full object-contain" alt="Preview" />
                  <button onClick={() => setImages(images.filter(i => i.id !== img.id))} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                  {img.status === 'processing' && (<div className="absolute inset-0 bg-black/60 flex items-center justify-center"><RefreshCw className="w-8 h-8 text-teal-500 animate-spin" /></div>)}
                </div>
                <div className="mt-4"><p className="text-[10px] font-mono text-blue-400 truncate mb-1">{img.file.name}</p></div>
                {img.error && <p className="text-[10px] text-red-500 mt-2 bg-red-500/10 p-2 border border-red-500/20 rounded-lg">{img.error}</p>}
              </div>
              <div className="flex-1 flex flex-col gap-6">
                {PLATFORM_FIELDS[constraints.selectedPlatform].title && (
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Title</label>
                    <div className="relative"><textarea className="w-full bg-[#0d0f12] border border-[#1e2229] rounded-xl p-4 text-sm text-slate-300 outline-none min-h-[80px]" value={img.seoData?.title || ''} readOnly />
                    <button onClick={() => copyToClipboard(img.seoData?.title || '')} className="absolute right-4 bottom-4 p-2 bg-[#1a1e25] rounded-lg text-slate-500 hover:text-teal-500 transition-all border border-slate-800"><Copy className="w-3.5 h-3.5" /></button></div>
                  </div>
                )}
                {PLATFORM_FIELDS[constraints.selectedPlatform].description && (
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Description</label>
                    <div className="relative"><textarea className="w-full bg-[#0d0f12] border border-[#1e2229] rounded-xl p-4 text-sm text-slate-400 outline-none min-h-[100px]" value={img.seoData?.description || ''} readOnly />
                    <button onClick={() => copyToClipboard(img.seoData?.description || '')} className="absolute right-4 bottom-4 p-2 bg-[#1a1e25] rounded-lg text-slate-500 hover:text-teal-500 transition-all border border-slate-800"><Copy className="w-3.5 h-3.5" /></button></div>
                  </div>
                )}
                {PLATFORM_FIELDS[constraints.selectedPlatform].keywords && (
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Keywords ({img.seoData?.keywords.length || 0})</label>
                    <div className="relative"><textarea className="w-full bg-[#0d0f12] border border-[#1e2229] rounded-xl p-4 text-sm text-slate-400 outline-none min-h-[100px]" value={img.seoData?.keywords.join(', ') || ''} readOnly />
                    <div className="absolute right-4 bottom-4 flex gap-2"><button onClick={() => copyToClipboard(img.seoData?.keywords.join(', ') || '')} className="p-2 bg-[#1a1e25] rounded-lg text-slate-500 hover:text-teal-500 flex items-center gap-2 border border-slate-800"><Copy className="w-3.5 h-3.5" /> <span className="text-[10px] font-bold">Copy</span></button>
                    <button onClick={() => processSingle(img.id)} className="bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-black px-6 py-2 rounded-xl flex items-center gap-2 transition-all"><RefreshCw className={`w-3.5 h-3.5 ${img.status === 'processing' ? 'animate-spin' : ''}`} /> Regenerate</button></div></div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {images.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center opacity-30 select-none py-20">
               <Layers className="w-32 h-32 mb-6" />
               <p className="text-xl font-black uppercase tracking-widest">Workspace Empty</p>
               <p className="text-xs font-medium text-slate-500 mt-2">Upload images to begin AI optimization</p>
            </div>
          )}
        </div>
      </main>

      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all duration-300">
          <div className="bg-[#16191e] border border-slate-800 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-500/10 rounded-lg"><Settings className="w-5 h-5 text-teal-500" /></div>
                <div>
                   <h2 className="text-xl font-bold text-white">Application Settings</h2>
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Control your AI Brains and API credentials</p>
                </div>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar">
              {/* AI BRAIN CONFIGURATION */}
              <section>
                <div className="flex items-center gap-2 mb-6">
                  <BrainCircuit className="w-4 h-4 text-teal-500" />
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest">1. Select AI Brain</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {aiBrains.map(m => (
                    <div 
                      key={m.id}
                      onClick={() => setAppSettings({ ...appSettings, selectedModel: m.id })}
                      className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col gap-2 ${appSettings.selectedModel === m.id ? 'border-teal-500 bg-teal-500/5 ring-1 ring-teal-500/30' : 'border-slate-800 bg-[#1a1e25] hover:border-slate-700'}`}
                    >
                      <div className="flex justify-between items-center">
                        <m.icon className={`w-5 h-5 ${appSettings.selectedModel === m.id ? 'text-teal-500' : 'text-slate-500'}`} />
                        {appSettings.selectedModel === m.id && <div className="w-4 h-4 bg-teal-500 rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>}
                      </div>
                      <div>
                        <p className="text-[12px] font-bold text-slate-100">{m.name}</p>
                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-tighter">{m.provider}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* DYNAMIC API KEY MANAGEMENT */}
              <section className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="w-4 h-4 text-teal-500" />
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest">2. API Credentials</h3>
                </div>
                
                {/* Always show the Google/Gemini handler if a Gemini model is active */}
                {appSettings.selectedModel.startsWith('gemini') ? (
                  <div className="bg-[#1a1e25] p-6 rounded-2xl border-2 border-teal-500/30 shadow-lg shadow-teal-500/5 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-teal-500/10 rounded-2xl flex items-center justify-center font-bold text-teal-500 text-xl">G</div>
                        <div>
                          <p className="text-sm font-bold text-slate-100">Google Gemini API (Active)</p>
                          <p className={`text-[10px] font-bold uppercase ${hasGoogleKey ? 'text-teal-500' : 'text-amber-500 animate-pulse'}`}>
                            {hasGoogleKey ? 'Connected: Securely Authenticated' : 'Action Required: Link Paid Account'}
                          </p>
                        </div>
                      </div>
                      <button onClick={handleOpenGoogleKey} className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-black uppercase px-6 py-2.5 rounded-xl transition-all shadow-lg active:scale-95">
                        {hasGoogleKey ? 'Change API Key' : 'Connect Account'}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed italic">
                      Note: Vision capabilities are natively optimized for Gemini. Ensure you select a API key from a paid GCP project.
                    </p>
                  </div>
                ) : (
                  /* Show selected provider's specific key input */
                  <div className="bg-[#1a1e25] p-6 rounded-2xl border-2 border-slate-700 space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center font-bold text-slate-400 text-xl">
                        {currentBrain?.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-100">{currentBrain?.provider} Configuration</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Input your individual secret key below</p>
                      </div>
                    </div>
                    <div className="relative">
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                      <input 
                        type="password"
                        placeholder={`Enter your ${currentBrain?.provider} API Key...`}
                        value={currentBrain?.keyField ? (appSettings.keys as any)[currentBrain.keyField] : ''}
                        onChange={(e) => {
                          if (currentBrain?.keyField) {
                            setAppSettings({ ...appSettings, keys: { ...appSettings.keys, [currentBrain.keyField]: e.target.value } });
                          }
                        }}
                        className="w-full bg-[#0d0f12] border border-slate-800 rounded-xl pl-11 pr-4 py-3.5 text-sm text-slate-300 focus:border-teal-500 outline-none transition-all placeholder:text-slate-700"
                      />
                    </div>
                  </div>
                )}

                {/* Optional: Collapse other keys toggle */}
                <div className="pt-4 border-t border-slate-800/50">
                   <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-4">Other Stored Credentials</p>
                   <div className="grid grid-cols-2 gap-4">
                      {aiBrains.filter(b => b.keyField && b.keyField !== currentBrain?.keyField).map(b => (
                        <div key={b.id} className="bg-[#0d0f12] border border-slate-800/50 p-3 rounded-xl flex items-center justify-between">
                           <div className="flex items-center gap-2">
                              <b.icon className="w-3.5 h-3.5 text-slate-600" />
                              <span className="text-[10px] font-bold text-slate-500">{b.provider} Key</span>
                           </div>
                           <div className={`w-1.5 h-1.5 rounded-full ${(appSettings.keys as any)[b.keyField!] ? 'bg-teal-900' : 'bg-slate-900'}`} />
                        </div>
                      ))}
                   </div>
                </div>
              </section>
            </div>

            <div className="p-6 border-t border-slate-800 bg-[#1a1e25]/50 flex justify-end gap-3">
              <button onClick={() => setIsSettingsOpen(false)} className="px-6 py-3 text-sm font-bold text-slate-400 hover:text-white transition-all">Cancel</button>
              <button onClick={() => setIsSettingsOpen(false)} className="bg-teal-600 hover:bg-teal-500 text-white font-bold px-10 py-3 rounded-xl transition-all shadow-lg active:scale-95 flex items-center gap-2">
                 <CheckCircle className="w-4 h-4" /> Apply & Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e2229; border-radius: 10px; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #2dd4bf;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(45, 212, 191, 0.3);
        }
      `}</style>
    </div>
  );
};

export default App;
