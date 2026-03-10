import React, { useState, useCallback, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Table as TableIcon, 
  MapPin, 
  Zap, 
  Download, 
  Copy, 
  Trash2, 
  ChevronRight, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileJson,
  FileSpreadsheet,
  File as FileIcon,
  X,
  History,
  Languages,
  Sparkles,
  HelpCircle,
  ArrowRight,
  Info,
  Settings,
  Github,
  Globe,
  Cpu,
  Eye,
  EyeOff,
  ExternalLink,
  PenTool
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { processImage, type ProcessingMode, type ExtractionResult } from './services/geminiService';
import { processImageLocally } from './services/tesseractService';
import { 
  exportToExcel, 
  exportToCSV, 
  exportToPDF, 
  exportToDocx, 
  exportToJSON,
  exportBulkToZip
} from './services/exportService';
import { optimizeImage } from './services/imageService';

/**
 * Utility for tailwind class merging
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ProcessedFile {
  id: string;
  name: string;
  originalName: string;
  preview: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  result?: ExtractionResult;
  mode: ProcessingMode;
  timestamp: number;
}

export default function App() {
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [recentActivity, setRecentActivity] = useState<ProcessedFile[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [useLocalOcr, setUseLocalOcr] = useState(true);
  const [showKey, setShowKey] = useState(false);

  const activeFile = files.find(f => f.id === activeFileId);

  // Load settings from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('imageToData_apiKey');
    if (savedKey) setApiKey(savedKey);
    
    const savedLocal = localStorage.getItem('imageToData_useLocal');
    if (savedLocal !== null) {
      setUseLocalOcr(savedLocal === 'true');
    } else {
      // Default to Local OCR if no setting exists
      setUseLocalOcr(true);
    }

    const saved = localStorage.getItem('imageToData_recent');
    if (saved) {
      try {
        setRecentActivity(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load recent activity", e);
      }
    }
    
    // Show guide on first visit
    const hasSeenGuide = localStorage.getItem('imageToData_hasSeenGuide');
    if (!hasSeenGuide) {
      setShowGuide(true);
    }
  }, []);

  const saveSettings = () => {
    localStorage.setItem('imageToData_apiKey', apiKey);
    localStorage.setItem('imageToData_useLocal', String(useLocalOcr));
    setShowSettings(false);
  };

  const handleCloseGuide = () => {
    setShowGuide(false);
    localStorage.setItem('imageToData_hasSeenGuide', 'true');
  };

  const startGuide = () => {
    setGuideStep(0);
    setShowGuide(true);
  };

  // Save recent activity
  const saveToRecent = (file: ProcessedFile) => {
    const updated = [file, ...recentActivity.slice(0, 9)];
    setRecentActivity(updated);
    localStorage.setItem('imageToData_recent', JSON.stringify(updated));
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      name: file.name.split('.')[0],
      originalName: file.name,
      preview: URL.createObjectURL(file),
      status: 'idle' as const,
      mode: 'auto' as ProcessingMode,
      timestamp: Date.now()
    }));
    setFiles(prev => [...prev, ...newFiles]);
    if (!activeFileId && newFiles.length > 0) {
      setActiveFileId(newFiles[0].id);
    }
  }, [activeFileId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: true
  });

  const handleOptimize = async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    try {
      const optimized = await optimizeImage(file.preview);
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, preview: optimized } : f));
    } catch (error) {
      console.error("Optimization error:", error);
      alert("Sorry from Kevin..existing feature not working as of now please try again after some time. As an apology you can buy me a cup of tea :)");
    }
  };

  const handleProcess = async (fileId: string, mode?: ProcessingMode) => {
    const file = files.find(f => f.id === fileId);
    if (!file || file.status === 'processing') return;

    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'processing', mode: mode || f.mode } : f));

    try {
      // Convert blob URL to base64
      const response = await fetch(file.preview);
      const blob = await response.blob();
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      let result: ExtractionResult;
      
      // Auto-switch to AI for complex modes
      const needsAi = mode === 'handwriting' || mode === 'table' || mode === 'address' || mode === 'summary';
      const effectiveUseLocal = needsAi ? false : useLocalOcr;

      if (effectiveUseLocal) {
        result = await processImageLocally(base64);
      } else {
        result = await processImage(base64, mode || file.mode, apiKey);
      }
      
      // Auto-generate filename
      let newName = file.name;
      if (result.type === 'Address Label' && result.structuredData?.city) {
        newName = `Address_${result.structuredData.city}_${result.structuredData.country || ''}`;
      } else if (result.type === 'Invoice' && result.structuredData?.company) {
        newName = `Invoice_${result.structuredData.company}_${new Date().toISOString().split('T')[0]}`;
      } else {
        newName = `${result.type.replace(/\s+/g, '_')}_${new Date().getTime()}`;
      }

      const updatedFile: ProcessedFile = { 
        ...file, 
        status: 'completed', 
        result, 
        name: newName,
        mode: mode || file.mode 
      };

      setFiles(prev => prev.map(f => f.id === fileId ? updatedFile : f));
      saveToRecent(updatedFile);
    } catch (error: any) {
      console.error("Processing error:", error);
      const msg = error?.message || "existing feature not working as of now";
      alert(`Sorry from Kevin..${msg} please try again after some time. As an apology you can buy me a cup of tea :)`);
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'error' } : f));
    }
  };

  const handleBulkProcess = async () => {
    setIsBulkProcessing(true);
    const idleFiles = files.filter(f => f.status === 'idle');
    for (const file of idleFiles) {
      await handleProcess(file.id);
    }
    setIsBulkProcessing(false);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    if (activeFileId === id) setActiveFileId(null);
  };

  const handleExport = async (type: string) => {
    if (!activeFile?.result) return;
    const { result, name } = activeFile;
    
    try {
      switch (type) {
        case 'excel':
          await exportToExcel(result.tableData || result.content, name);
          break;
        case 'csv':
          await exportToCSV(result.tableData || result.content, name);
          break;
        case 'pdf':
          await exportToPDF(result.content, name);
          break;
        case 'docx':
          await exportToDocx(result.content, name, result.tableData);
          break;
        case 'json':
          await exportToJSON(result, name);
          break;
        case 'copy':
          await navigator.clipboard.writeText(result.content);
          alert("✓ Content copied to clipboard!");
          break;
      }
    } catch (err) {
      console.error("Export error:", err);
      alert("Export failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen relative">
      <div className="noise-overlay" />
      <div className="bg-glow" />

      {/* Header */}
      <header className="sticky top-0 z-50 glass-panel rounded-none border-x-0 border-t-0 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(191,255,0,0.3)]">
            <Zap className="text-black w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl leading-none">Kevin Parekh - IMAGE TO DATA TOOL</h1>
            <p className="font-mono text-[10px] text-white/40 uppercase tracking-[0.2em] mt-1">Office Assistant v1.0</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowSettings(true)}
            className="text-white/60 hover:text-accent transition-colors flex items-center gap-2 text-xs font-mono uppercase"
          >
            <Settings className="w-5 h-5" />
            Settings
          </button>
          <div className="h-6 w-[1px] bg-white/10" />
          <button 
            onClick={startGuide}
            className="text-white/60 hover:text-accent transition-colors flex items-center gap-2 text-xs font-mono uppercase"
          >
            <HelpCircle className="w-5 h-5" />
            Guide
          </button>
          <div className="h-6 w-[1px] bg-white/10" />
          <button className="text-white/60 hover:text-accent transition-colors">
            <History className="w-5 h-5" />
          </button>
          <div className="h-6 w-[1px] bg-white/10" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Upload & Queue */}
        <div className="lg:col-span-4 space-y-6">
          {/* Upload Panel */}
          <div 
            {...getRootProps()} 
            className={cn(
              "glass-panel p-8 border-dashed border-2 transition-all cursor-pointer group",
              isDragActive ? "border-accent bg-accent/5" : "border-white/10 hover:border-white/30"
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className={cn("w-8 h-8", isDragActive ? "text-accent" : "text-white/40")} />
              </div>
              <div>
                <h3 className="text-lg">Drop images here</h3>
                <p className="text-white/40 text-sm mt-1">or click to browse files</p>
              </div>
              <div className="flex gap-2 mt-2">
                <span className="font-mono text-[9px] px-2 py-1 bg-white/5 rounded border border-white/10 text-white/40">JPG</span>
                <span className="font-mono text-[9px] px-2 py-1 bg-white/5 rounded border border-white/10 text-white/40">PNG</span>
                <span className="font-mono text-[9px] px-2 py-1 bg-white/5 rounded border border-white/10 text-white/40">WEBP</span>
              </div>
            </div>
          </div>

          {/* Queue Panel */}
          <div className="glass-panel overflow-hidden flex flex-col max-h-[600px]">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
              <h3 className="text-sm font-mono tracking-widest uppercase">Processing Queue</h3>
              {files.filter(f => f.status === 'idle').length > 0 && (
                <button 
                  onClick={handleBulkProcess}
                  disabled={isBulkProcessing}
                  className="text-[10px] font-mono bg-accent text-black px-3 py-1 rounded-md font-bold hover:shadow-[0_0_15px_rgba(191,255,0,0.4)] transition-all flex items-center gap-1"
                >
                  {isBulkProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  Process All
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              <AnimatePresence mode="popLayout">
                {files.length === 0 ? (
                  <div className="py-12 text-center text-white/20">
                    <FileIcon className="w-12 h-12 mx-auto mb-3 opacity-10" />
                    <p className="text-xs font-mono">No files in queue</p>
                  </div>
                ) : (
                  files.map((file) => (
                    <motion.div
                      key={file.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={() => setActiveFileId(file.id)}
                      className={cn(
                        "p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 group",
                        activeFileId === file.id 
                          ? "bg-accent/10 border-accent/30" 
                          : "bg-white/5 border-white/5 hover:bg-white/10"
                      )}
                    >
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-black flex-shrink-0">
                        <img src={file.preview} alt="" className="w-full h-full object-cover opacity-60" />
                        {file.status === 'processing' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                            <Loader2 className="w-5 h-5 text-accent animate-spin" />
                          </div>
                        )}
                        {file.status === 'completed' && (
                          <div className="absolute bottom-1 right-1">
                            <CheckCircle2 className="w-4 h-4 text-accent fill-black" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-medium truncate">{file.name}</h4>
                        <p className="text-[10px] text-white/40 font-mono mt-0.5 uppercase">
                          {file.status === 'idle' ? 'Ready' : file.status}
                        </p>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                        className="p-2 text-white/20 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="glass-panel p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-mono tracking-widest uppercase flex items-center gap-2">
                <History className="w-3 h-3" /> Recent Activity
              </h3>
              {recentActivity.length > 0 && (
                <button 
                  onClick={async () => {
                    const filesToZip = await Promise.all(recentActivity.map(async f => {
                      const blob = new Blob([f.result?.content || ''], { type: 'text/plain' });
                      return { name: `${f.name}.txt`, content: blob };
                    }));
                    await exportBulkToZip(filesToZip);
                  }}
                  className="text-[9px] font-mono text-accent hover:underline uppercase tracking-tighter"
                >
                  Download All
                </button>
              )}
            </div>
            <div className="space-y-3">
              {recentActivity.length === 0 ? (
                <p className="text-[10px] text-white/20 font-mono italic">No recent activity</p>
              ) : (
                recentActivity.map((item, i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent/40" />
                      <p className="text-[11px] truncate text-white/60">{item.name}</p>
                    </div>
                    <span className="text-[9px] font-mono bg-accent/10 text-accent px-2 py-0.5 rounded border border-accent/20 group-hover:bg-accent group-hover:text-black transition-all cursor-pointer font-bold">
                      View
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Workspace */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            {!activeFile ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full min-h-[600px] glass-panel flex flex-col items-center justify-center text-center p-12"
              >
                <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 relative">
                  <div className="absolute inset-0 rounded-full border border-accent/20 animate-ping" />
                  <Zap className="w-10 h-10 text-accent/40" />
                </div>
                <h2 className="text-2xl mb-2">Select a document to begin</h2>
                <p className="text-white/40 max-w-md">
                  Upload images or select a file from the queue to start extracting structured data with AI.
                </p>
              </motion.div>
            ) : (
              <motion.div 
                key={activeFile.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-full flex flex-col gap-6"
              >
                    {/* Processing Mode Selector */}
                <div className="glass-panel p-2 flex gap-2 overflow-x-auto no-scrollbar">
                  {[
                    { id: 'auto', label: 'Auto Detect', icon: Zap },
                    { id: 'text', label: 'Text Extraction', icon: FileText },
                    { id: 'handwriting', label: 'Handwriting', icon: PenTool },
                    { id: 'table', label: 'Table to Excel', icon: TableIcon },
                    { id: 'address', label: 'Address Parser', icon: MapPin },
                    { id: 'summary', label: 'AI Summary', icon: Zap },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => handleProcess(activeFile.id, mode.id as ProcessingMode)}
                      disabled={activeFile.status === 'processing'}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-[11px] uppercase tracking-wider transition-all whitespace-nowrap",
                        activeFile.mode === mode.id 
                          ? "bg-accent text-black shadow-[0_0_20px_rgba(191,255,0,0.4)] font-bold" 
                          : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <mode.icon className="w-4 h-4" />
                      {mode.label}
                    </button>
                  ))}
                </div>

                {/* Workspace Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-1">
                  {/* Image Preview */}
                  <div className="glass-panel overflow-hidden flex flex-col">
                    <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/5">
                      <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Source Image</span>
                      <button 
                        onClick={() => handleOptimize(activeFile.id)}
                        className="flex items-center gap-2 px-3 py-1 bg-accent/10 border border-accent/20 rounded text-[9px] font-mono text-accent uppercase hover:bg-accent hover:text-black transition-all font-bold"
                      >
                        <Sparkles className="w-3 h-3" /> Optimize Image
                      </button>
                    </div>
                    <div className="flex-1 bg-black/40 p-4 flex items-center justify-center min-h-[300px]">
                      <div className="relative group perspective-1000">
                        <img 
                          src={activeFile.preview} 
                          alt="Preview" 
                          className="max-w-full max-h-[500px] rounded-lg shadow-2xl transition-transform duration-500 group-hover:rotate-y-6 group-hover:rotate-x-6" 
                        />
                        <div className="absolute inset-0 rounded-lg border border-white/10 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Editor / Result */}
                  <div className="glass-panel flex flex-col">
                    <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/5">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Extracted Data</span>
                        {activeFile.result && (
                          <div className="flex items-center gap-2 px-2 py-0.5 bg-accent/10 rounded border border-accent/20">
                            <Languages className="w-3 h-3 text-accent" />
                            <span className="text-[9px] font-mono text-accent uppercase">{activeFile.result.language}</span>
                          </div>
                        )}
                      </div>
                      {activeFile.result && (
                        <div className="text-[10px] font-mono text-white/40">
                          Confidence: <span className={cn(
                            activeFile.result.confidence > 0.8 ? "text-green-400" : "text-yellow-400"
                          )}>{(activeFile.result.confidence * 100).toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 p-6 overflow-y-auto">
                      {activeFile.status === 'processing' ? (
                        <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                          <Loader2 className="w-12 h-12 text-accent animate-spin" />
                          <div className="space-y-1">
                            <p className="font-mono text-xs uppercase tracking-widest animate-pulse">Analyzing Document...</p>
                            <p className="text-[10px] text-white/40">Gemini AI is processing your request</p>
                          </div>
                        </div>
                      ) : activeFile.result ? (
                        <div className="space-y-6">
                          {/* Structured Fields if Address/Invoice */}
                          {activeFile.result.structuredData && (
                            <div className="grid grid-cols-2 gap-4">
                              {Object.entries(activeFile.result.structuredData).map(([key, value]) => (
                                value && (
                                  <div key={key} className="space-y-1">
                                    <label className="text-[9px] font-mono text-white/30 uppercase tracking-wider">{key.replace(/([A-Z])/g, ' $1')}</label>
                                    <input 
                                      type="text" 
                                      defaultValue={String(value)}
                                      className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm focus:border-accent outline-none transition-colors"
                                    />
                                  </div>
                                )
                              ))}
                            </div>
                          )}

                          {/* Table View */}
                          {activeFile.result.tableData && (
                            <div className="space-y-3">
                              <label className="text-[9px] font-mono text-white/30 uppercase tracking-wider">Table Data</label>
                              <div className="overflow-x-auto border border-white/10 rounded-lg">
                                <table className="w-full text-xs font-mono">
                                  <thead>
                                    <tr className="bg-white/5 border-b border-white/10">
                                      {activeFile.result.tableData[0]?.map((cell, i) => (
                                        <th key={i} className="px-3 py-2 text-left font-medium text-white/40 border-r border-white/10 last:border-0">{cell}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {activeFile.result.tableData.slice(1).map((row, ri) => (
                                      <tr key={ri} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                        {row.map((cell, ci) => (
                                          <td key={ci} className="px-3 py-2 border-r border-white/5 last:border-0">{cell}</td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Summary View */}
                          {activeFile.result.summary && (
                            <div className="space-y-2 p-4 bg-accent/5 border border-accent/20 rounded-xl">
                              <h4 className="text-xs font-mono text-accent uppercase tracking-widest flex items-center gap-2">
                                <Zap className="w-3 h-3" /> AI Summary
                              </h4>
                              <p className="text-sm leading-relaxed text-white/80 italic">
                                "{activeFile.result.summary}"
                              </p>
                            </div>
                          )}

                          {/* Raw Text Editor */}
                          <div className="space-y-2">
                            <label className="text-[9px] font-mono text-white/30 uppercase tracking-wider">Extracted Text</label>
                            <textarea 
                              className="w-full h-64 bg-black/40 border border-white/10 rounded-xl p-4 text-sm font-mono leading-relaxed focus:border-accent outline-none transition-colors resize-none"
                              defaultValue={activeFile.result.content}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center text-white/20">
                          <AlertCircle className="w-12 h-12 mb-4 opacity-10" />
                          <p className="text-xs font-mono">No data extracted yet</p>
                          <button 
                            onClick={() => handleProcess(activeFile.id)}
                            className="mt-4 bg-accent text-black px-6 py-2 rounded-lg font-bold shadow-[0_0_15px_rgba(191,255,0,0.3)] hover:shadow-[0_0_25px_rgba(191,255,0,0.5)] transition-all text-[10px] font-mono uppercase tracking-widest"
                          >
                            Start Processing
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Export Tools */}
                    {activeFile.result && (
                      <div className="p-4 border-t border-white/10 bg-white/5 grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <button 
                          onClick={() => handleExport('copy')}
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-accent text-black font-bold hover:shadow-[0_0_20px_rgba(191,255,0,0.4)] border border-accent/20 rounded-lg text-[10px] font-mono uppercase transition-all"
                        >
                          <Copy className="w-3 h-3" /> Copy
                        </button>
                        <button 
                          onClick={() => handleExport('docx')}
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-accent text-black font-bold hover:shadow-[0_0_20px_rgba(191,255,0,0.4)] border border-accent/20 rounded-lg text-[10px] font-mono uppercase transition-all"
                        >
                          <FileIcon className="w-3 h-3" /> Word
                        </button>
                        <button 
                          onClick={() => handleExport('pdf')}
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-accent text-black font-bold hover:shadow-[0_0_20px_rgba(191,255,0,0.4)] border border-accent/20 rounded-lg text-[10px] font-mono uppercase transition-all"
                        >
                          <FileIcon className="w-3 h-3" /> PDF
                        </button>
                        <button 
                          onClick={() => handleExport('excel')}
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-accent text-black font-bold hover:shadow-[0_0_20px_rgba(191,255,0,0.4)] border border-accent/20 rounded-lg text-[10px] font-mono uppercase transition-all"
                        >
                          <FileSpreadsheet className="w-3 h-3" /> Excel
                        </button>
                        <button 
                          onClick={() => handleExport('csv')}
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-accent text-black font-bold hover:shadow-[0_0_20px_rgba(191,255,0,0.4)] border border-accent/20 rounded-lg text-[10px] font-mono uppercase transition-all"
                        >
                          <FileText className="w-3 h-3" /> CSV
                        </button>
                        <button 
                          onClick={() => handleExport('json')}
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-accent text-black font-bold hover:shadow-[0_0_20px_rgba(191,255,0,0.4)] border border-accent/20 rounded-lg text-[10px] font-mono uppercase transition-all"
                        >
                          <FileJson className="w-3 h-3" /> JSON
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer / Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 glass-panel rounded-none border-x-0 border-b-0 px-6 py-2 flex items-center justify-between z-40">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">System Online</span>
          </div>
          <div className="h-3 w-[1px] bg-white/10" />
          <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Gemini 3.1 Pro Engine</span>
        </div>
        <div className="flex items-center gap-4 text-[9px] font-mono text-white/40 uppercase tracking-widest">
          <span>{files.length} Files in session</span>
          <span>{recentActivity.length} Processed today</span>
        </div>
      </footer>

      {/* Onboarding Guide Overlay */}
      <AnimatePresence>
        {showGuide && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="glass-panel max-w-lg w-full overflow-hidden relative"
            >
              <button 
                onClick={handleCloseGuide}
                className="absolute top-4 right-4 p-2 text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-8">
                <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(191,255,0,0.3)]">
                  <Zap className="text-black w-8 h-8" />
                </div>
                
                <AnimatePresence mode="wait">
                  {guideStep === 0 && (
                    <motion.div 
                      key="step0"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <h2 className="text-2xl">Welcome to Kevin's Tool</h2>
                      <p className="text-white/60 leading-relaxed">
                        This AI-powered assistant helps you convert images of documents, receipts, or tables into structured digital data in seconds.
                      </p>
                    </motion.div>
                  )}

                  {guideStep === 1 && (
                    <motion.div 
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <h2 className="text-2xl">Step 1: Upload</h2>
                      <p className="text-white/60 leading-relaxed">
                        Drag and drop your images or screenshots into the upload panel. You can upload multiple files at once for bulk processing.
                      </p>
                      <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex items-center gap-4">
                        <Upload className="text-accent w-6 h-6" />
                        <span className="text-xs font-mono uppercase tracking-widest">Drag & Drop Area</span>
                      </div>
                    </motion.div>
                  )}

                  {guideStep === 2 && (
                    <motion.div 
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <h2 className="text-2xl">Step 2: Optimize & Extract</h2>
                      <p className="text-white/60 leading-relaxed">
                        Use the <span className="text-accent font-bold">Optimize Image</span> button to clean up blurry text. Then, select a processing mode like "Table to Excel" or "Address Parser".
                      </p>
                      <div className="flex gap-2">
                        <div className="px-3 py-1 bg-accent/10 rounded border border-accent/20 text-[10px] font-mono text-accent uppercase">Optimize</div>
                        <div className="px-3 py-1 bg-accent/10 rounded border border-accent/20 text-[10px] font-mono text-accent uppercase">Extract</div>
                      </div>
                    </motion.div>
                  )}

                  {guideStep === 3 && (
                    <motion.div 
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <h2 className="text-2xl">Step 3: Export</h2>
                      <p className="text-white/60 leading-relaxed">
                        Once processed, review the data in the editor and export it to Word, Excel, PDF, or JSON with a single click.
                      </p>
                      <div className="flex gap-2">
                        <FileSpreadsheet className="text-accent w-6 h-6" />
                        <FileText className="text-accent w-6 h-6" />
                        <FileJson className="text-accent w-6 h-6" />
                      </div>
                    </motion.div>
                  )}

                  {guideStep === 4 && (
                    <motion.div 
                      key="step4"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <h2 className="text-2xl">GitHub Pages Deployment</h2>
                      <p className="text-white/60 leading-relaxed">
                        To host this for free on GitHub Pages:
                      </p>
                      <ul className="text-xs text-white/60 space-y-2 list-decimal pl-4">
                        <li>Download the code as a ZIP and extract it.</li>
                        <li>Open terminal in the folder and run <span className="text-accent">npm install</span>.</li>
                        <li>Run <span className="text-accent">npm run build</span> to create the <span className="text-accent">dist</span> folder.</li>
                        <li>Upload ONLY the contents of the <span className="text-accent">dist</span> folder to your GitHub repository.</li>
                        <li>In GitHub Settings, set Pages to deploy from the <span className="text-accent">main</span> branch.</li>
                      </ul>
                      <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/10">
                        <Globe className="w-4 h-4 text-accent" />
                        <span className="text-[10px] font-mono">Works offline with Local OCR</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mt-12 flex items-center justify-between">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div 
                        key={i} 
                        className={cn(
                          "w-2 h-2 rounded-full transition-all duration-300",
                          guideStep === i ? "w-6 bg-accent" : "bg-white/20"
                        )}
                      />
                    ))}
                  </div>
                  
                  <div className="flex gap-3">
                    {guideStep > 0 && (
                      <button 
                        onClick={() => setGuideStep(prev => prev - 1)}
                        className="px-4 py-2 text-xs font-mono uppercase text-white/40 hover:text-white transition-colors"
                      >
                        Back
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        if (guideStep < 4) setGuideStep(prev => prev + 1);
                        else handleCloseGuide();
                      }}
                      className="neon-button py-2 px-6 text-xs flex items-center gap-2"
                    >
                      {guideStep === 4 ? "Got it!" : "Next"}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="glass-panel max-w-md w-full overflow-hidden"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                <h2 className="text-lg font-mono uppercase tracking-widest flex items-center gap-2">
                  <Settings className="w-5 h-5 text-accent" /> Settings
                </h2>
                <button onClick={() => setShowSettings(false)} className="text-white/40 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Engine Selection */}
                <div className="space-y-3">
                  <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Processing Engine</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setUseLocalOcr(false)}
                      className={cn(
                        "p-3 rounded-xl border flex flex-col gap-2 transition-all",
                        !useLocalOcr ? "bg-accent/10 border-accent/40 text-accent" : "bg-white/5 border-white/10 text-white/40"
                      )}
                    >
                      <Zap className="w-5 h-5" />
                      <div className="text-left">
                        <p className="text-xs font-bold">Advanced AI</p>
                        <p className="text-[9px] opacity-60">Best for Handwriting & Tables</p>
                      </div>
                    </button>
                    <button 
                      onClick={() => setUseLocalOcr(true)}
                      className={cn(
                        "p-3 rounded-xl border flex flex-col gap-2 transition-all",
                        useLocalOcr ? "bg-accent/10 border-accent/40 text-accent" : "bg-white/5 border-white/10 text-white/40"
                      )}
                    >
                      <Cpu className="w-5 h-5" />
                      <div className="text-left">
                        <p className="text-xs font-bold">Basic OCR</p>
                        <p className="text-[9px] opacity-60">Fast, Offline, Printed Text</p>
                      </div>
                    </button>
                  </div>
                  <p className="text-[9px] text-white/30 italic leading-tight mt-3">
                    * Note: Basic OCR (Tesseract) is local but struggles with handwriting. 
                    Advanced AI is required for handwritten documents and complex tables.
                  </p>
                </div>

                {/* API Key Input */}
                {!useLocalOcr && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Gemini API Key</label>
                      <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[9px] text-accent hover:underline flex items-center gap-1"
                      >
                        Get Key <ExternalLink className="w-2 h-2" />
                      </a>
                    </div>
                    <div className="relative">
                      <input 
                        type={showKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your Gemini API Key..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono focus:border-accent outline-none transition-colors pr-12"
                      />
                      <button 
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                      >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[9px] text-white/30 leading-relaxed italic">
                      * Your key is stored locally in your browser and never sent to our servers.
                    </p>
                  </div>
                )}

                <button 
                  onClick={saveSettings}
                  className="w-full neon-button py-3 font-bold uppercase tracking-widest text-xs"
                >
                  Save Configuration
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
