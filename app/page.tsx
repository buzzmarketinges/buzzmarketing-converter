"use client";

import { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import dynamic from 'next/dynamic';
import { Video, Image as ImageIcon, Terminal } from 'lucide-react';
import 'iconify-icon'; // Import web component

const VideoConverter = dynamic(() => import('./components/VideoConverter'), { ssr: false });
const ImageConverter = dynamic(() => import('./components/ImageConverter'), { ssr: false });

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Cargando motor multimedia...');
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image'); // Default to image as requested
  const [logs, setLogs] = useState<string[]>([]);

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const messageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsMounted(true);
    load();
  }, []);

  const load = async () => {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;

    ffmpeg.on('log', ({ message }) => {
      // Filter noisy logs if wanted, but keeping raw is fine for debug
      setLogs((prev) => [...prev.slice(-50), message]);
      if (messageRef.current) {
        requestAnimationFrame(() => {
          if (messageRef.current) messageRef.current.scrollTop = messageRef.current.scrollHeight;
        });
      }
    });

    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      setLoaded(true);
      setLoadingMsg('');
    } catch (error) {
      console.error(error);
      setLoadingMsg('Error crítico: El navegador no soporta SharedArrayBuffer, necesario para FFmpeg.');
    }
  };

  if (!isMounted) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
    </div>;
  }

  return (
    <main className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">

      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              {/* @ts-ignore */}
              <iconify-icon icon="lucide:zap" style={{ color: 'white', fontSize: '20px' }}></iconify-icon>
            </div>
            <span className="font-bold text-lg tracking-tight">BuzzMarketing <span className="text-primary font-light">Media Converter</span></span>
          </div>

          <div className="flex bg-white/5 p-1 rounded-lg border border-white/5">
            <button
              onClick={() => setActiveTab('image')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'image'
                ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/25 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <ImageIcon className="w-4 h-4" /> Imágenes
            </button>
            <button
              onClick={() => setActiveTab('video')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'video'
                ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/25 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <Video className="w-4 h-4" /> Video
            </button>
          </div>

          <div className="w-24"></div> {/* Spacer balance */}
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {!loaded ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-6 text-center animate-fade-in">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                {/* @ts-ignore */}
                <iconify-icon icon="lucide:loader" className="text-primary animate-pulse"></iconify-icon>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xl font-medium">{loadingMsg}</p>
              <p className="text-sm text-gray-500">Esto solo toma unos segundos la primera vez.</p>
            </div>
          </div>
        ) : (
          <div className="animate-fade-in">
            <div className={activeTab === 'video' ? 'block' : 'hidden'}>
              <VideoConverter ffmpeg={ffmpegRef.current} loaded={loaded} />
            </div>
            <div className={activeTab === 'image' ? 'block' : 'hidden'}>
              <ImageConverter ffmpeg={ffmpegRef.current} loaded={loaded} />
            </div>
          </div>
        )}
      </div>

      {/* Footer / Logs */}
      <footer className="fixed bottom-0 left-0 right-0 py-2 bg-black/80 backdrop-blur-md border-t border-white/5 z-50 flex justify-center items-center gap-1 text-[10px] text-gray-500 font-medium">
        <span>App de transformación de imágenes de la agencia de marketing</span>
        <a href="https://BuzzMarketing.es" target="_blank" rel="follow" className="font-black text-xs hover:text-white transition-colors" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          BuzzMarketing
        </a>
      </footer>

    </main>
  );
}
