"use client";

import { useState } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { Upload, FileVideo, Settings, Download, Loader2, ArrowRight, RefreshCw, X, CheckCircle2 } from 'lucide-react';

interface VideoConverterProps {
    ffmpeg: FFmpeg | null;
    loaded: boolean;
}

export default function VideoConverter({ ffmpeg, loaded }: VideoConverterProps) {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoInfo, setVideoInfo] = useState<any>(null);
    const [analyzing, setAnalyzing] = useState(false);

    const [outputFormat, setOutputFormat] = useState('mp4');
    const [resolution, setResolution] = useState('original');
    const [customWidth, setCustomWidth] = useState<number>(1920);
    const [customHeight, setCustomHeight] = useState<number>(1080);
    const [aspectRatio, setAspectRatio] = useState<number>(16 / 9);
    const [codec, setCodec] = useState('libx264');

    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [outputUrl, setOutputUrl] = useState<string | null>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setVideoFile(file);
            await analyzeVideo(file);
        }
    };

    const analyzeVideo = async (file: File) => {
        if (!loaded || !ffmpeg) return;
        setAnalyzing(true);
        setVideoInfo(null);
        setOutputUrl(null);

        try {
            await ffmpeg.writeFile('input', await fetchFile(file));

            // Capture logs to parse info
            let logOutput = "";
            const logHandler = ({ message }: { message: string }) => {
                logOutput += message + "\n";
            };

            ffmpeg.on('log', logHandler);
            // Running -i input without output will fail but print info
            try {
                await ffmpeg.exec(['-i', 'input']);
            } catch (e) {
                // Expected to fail because no output file
            }
            ffmpeg.off('log', logHandler);

            // Simple parsing logic
            const resolutionMatch = logOutput.match(/(\d{2,5})x(\d{2,5})/);
            const fpsMatch = logOutput.match(/(\d+(?:\.\d+)?) fps/);
            const codecMatch = logOutput.match(/Video: (\w+)/);
            const durationMatch = logOutput.match(/Duration: (\d{2}:\d{2}:\d{2}\.\d{2})/);

            if (resolutionMatch) {
                const w = parseInt(resolutionMatch[1]);
                const h = parseInt(resolutionMatch[2]);
                setAspectRatio(w / h);
                setCustomWidth(w);
                setCustomHeight(h);
            }

            setVideoInfo({
                resolution: resolutionMatch ? `${resolutionMatch[1]}x${resolutionMatch[2]}` : 'Unknown',
                width: resolutionMatch ? parseInt(resolutionMatch[1]) : 0,
                height: resolutionMatch ? parseInt(resolutionMatch[2]) : 0,
                fps: fpsMatch ? fpsMatch[1] : 'Unknown',
                codec: codecMatch ? codecMatch[1] : 'Unknown',
                duration: durationMatch ? durationMatch[1] : 'Unknown',
                size: (file.size / (1024 * 1024)).toFixed(2) + ' MB'
            });

        } catch (err) {
            console.error(err);
        } finally {
            setAnalyzing(false);
        }
    };

    const convert = async () => {
        if (!loaded || !ffmpeg || !videoFile) return;
        setProcessing(true);
        setProgress(0);
        setOutputUrl(null);

        // Listen to progress
        const progressHandler = ({ progress }: { progress: number }) => {
            setProgress(Math.round(progress * 100));
        };
        ffmpeg.on('progress', progressHandler);

        const outputFilename = `output.${outputFormat}`;
        const args = ['-i', 'input'];

        // Resolution
        if (resolution === 'custom') {
            const finalW = Math.round(customWidth / 2) * 2;
            const finalH = Math.round(customHeight / 2) * 2;
            args.push('-vf', `scale=${finalW}:${finalH}`);
        } else if (resolution !== 'original') {
            if (resolution === '4k') args.push('-vf', 'scale=-1:2160');
            if (resolution === '1440p') args.push('-vf', 'scale=-1:1440');
            if (resolution === '1080p') args.push('-vf', 'scale=-1:1080');
            if (resolution === '720p') args.push('-vf', 'scale=-1:720');
            if (resolution === '480p') args.push('-vf', 'scale=-1:480');
            if (resolution === '360p') args.push('-vf', 'scale=-1:360');
        }

        // Codec
        if (codec !== 'copy') {
            args.push('-c:v', codec);
            if (outputFormat === 'mp4' && codec === 'libx264') {
                args.push('-preset', 'fast');
            }
        } else {
            args.push('-c:v', 'copy');
        }

        args.push(outputFilename);

        try {
            await ffmpeg.exec(args);
            const data = await ffmpeg.readFile(outputFilename);
            const blob = new Blob([data as any], { type: `video/${outputFormat}` });
            const url = URL.createObjectURL(blob);
            setOutputUrl(url);
        } catch (error) {
            console.error(error);
            alert('Conversion failed. Check logs.');
        } finally {
            ffmpeg.off('progress', progressHandler);
            setProcessing(false);
        }
    };

    const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const w = parseInt(e.target.value) || 0;
        setCustomWidth(w);
        if (w > 0) {
            setCustomHeight(Math.round(w / aspectRatio));
        }
    };

    const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const h = parseInt(e.target.value) || 0;
        setCustomHeight(h);
        if (h > 0) {
            setCustomWidth(Math.round(h * aspectRatio));
        }
    };

    const formatOptions = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv', 'wmv'];
    const resolutionOptions = [
        { label: 'Original', value: 'original' },
        { label: '4K (UHD)', value: '4k' },
        { label: '1440p (QHD)', value: '1440p' },
        { label: '1080p (FHD)', value: '1080p' },
        { label: '720p (HD)', value: '720p' },
        { label: '480p (SD)', value: '480p' },
        { label: '360p', value: '360p' },
        { label: 'Custom', value: 'custom' },
    ];
    const codecOptions = [
        { label: 'H.264 (Standard)', value: 'libx264' },
        { label: 'VP9 (Web/Chrome)', value: 'libvpx-vp9' },
        { label: 'H.265 (High Eff)', value: 'libx265' },
        { label: 'Copy (No Re-encode)', value: 'copy' },
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
            <div className="lg:col-span-5 space-y-6">
                <div className="glass-panel p-6">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Upload className="w-5 h-5 text-primary" />
                        Importar Video
                    </h2>

                    {!videoFile ? (
                        <label className="dropzone block relative group">
                            <input
                                type="file"
                                className="hidden"
                                accept="video/*"
                                onChange={handleFileUpload}
                                disabled={!loaded}
                            />
                            <div className="flex flex-col items-center justify-center gap-3">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${!loaded ? 'bg-gray-800' : 'bg-primary/20 group-hover:bg-primary/30'}`}>
                                    {loaded ? <FileVideo className="w-6 h-6 text-primary" /> : <Loader2 className="w-6 h-6 animate-spin text-gray-500" />}
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium">{loaded ? 'Haz clic o arrastra un video' : 'Esperando a FFmpeg...'}</p>
                                    <p className="text-xs text-gray-500">Soporta todos los formatos comunes</p>
                                </div>
                            </div>
                        </label>
                    ) : (
                        <div className="relative overflow-hidden rounded-xl border border-border bg-surface p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-black/50 flex items-center justify-center">
                                <FileVideo className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate">{videoFile.name}</p>
                                <p className="text-xs text-gray-400">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                            </div>
                            <button
                                onClick={() => {
                                    setVideoFile(null);
                                    setVideoInfo(null);
                                    setOutputUrl(null);
                                }}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                disabled={processing}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                {videoInfo && (
                    <div className="glass-panel p-6 animate-fade-in">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Settings className="w-5 h-5 text-accent" />
                            Propiedades Detectadas
                        </h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 rounded-lg bg-surface border border-border">
                                <span className="label">Resolución</span>
                                <div className="font-mono text-lg">{videoInfo.resolution}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-surface border border-border">
                                <span className="label">Codec</span>
                                <div className="font-mono text-lg uppercase">{videoInfo.codec}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-surface border border-border">
                                <span className="label">FPS</span>
                                <div className="font-mono text-lg">{videoInfo.fps}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-surface border border-border">
                                <span className="label">Duración</span>
                                <div className="font-mono text-lg">{videoInfo.duration}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="lg:col-span-7 space-y-6">
                <div className="glass-panel p-6 h-full flex flex-col items-start">
                    <div className="w-full flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <RefreshCw className="w-5 h-5 text-primary" />
                            Transformar a
                        </h2>
                        {videoFile && <div className="badge border-primary/50 text-primary bg-primary/10">Listo</div>}
                    </div>

                    <div className="w-full grid-cols-2 mb-8">

                        <div className="space-y-1">
                            <label className="label">Formato de Salida</label>
                            <select
                                value={outputFormat}
                                onChange={(e) => setOutputFormat(e.target.value)}
                                className="input-glass"
                            >
                                {formatOptions.map(fmt => (
                                    <option key={fmt} value={fmt} className="bg-surface">{fmt.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="label">Resolución</label>
                            <select
                                value={resolution}
                                onChange={(e) => setResolution(e.target.value)}
                                className="input-glass"
                            >
                                {resolutionOptions.map(opt => (
                                    <option key={opt.value} value={opt.value} className="bg-surface">{opt.label}</option>
                                ))}
                            </select>

                            {resolution === 'custom' && (
                                <div className="flex gap-2 mt-2">
                                    <div className="flex-1">
                                        <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Ancho</label>
                                        <input
                                            type="number"
                                            value={customWidth}
                                            onChange={handleWidthChange}
                                            className="input-glass text-sm"
                                        />
                                    </div>
                                    <div className="flex items-center pt-5 text-gray-500">x</div>
                                    <div className="flex-1">
                                        <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Alto</label>
                                        <input
                                            type="number"
                                            value={customHeight}
                                            onChange={handleHeightChange}
                                            className="input-glass text-sm"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1">
                            <label className="label">Codec de Video</label>
                            <select
                                value={codec}
                                onChange={(e) => setCodec(e.target.value)}
                                className="input-glass"
                            >
                                {codecOptions.map(opt => (
                                    <option key={opt.value} value={opt.value} className="bg-surface">{opt.label}</option>
                                ))}
                            </select>
                        </div>

                    </div>

                    <div className="w-full mt-auto space-y-4">
                        {processing && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Procesando video...</span>
                                    <span>{progress}%</span>
                                </div>
                                <div className="w-full bg-surface rounded-full h-2 overflow-hidden">
                                    <div
                                        className="bg-primary h-full transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}

                        {!outputUrl ? (
                            <button
                                onClick={convert}
                                disabled={!videoFile || processing}
                                className={`btn btn-primary w-full py-4 text-lg ${(!videoFile || processing) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {processing ? (
                                    <> <Loader2 className="w-5 h-5 animate-spin" /> Convirtiendo... </>
                                ) : (
                                    <> Comenzar Conversión <ArrowRight className="w-5 h-5" /> </>
                                )}
                            </button>
                        ) : (
                            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center space-y-4 animate-fade-in">
                                <div className="flex items-center justify-center gap-2 text-green-400 font-bold text-lg">
                                    <CheckCircle2 className="w-6 h-6" />
                                    ¡Terminado!
                                </div>

                                <div className="flex gap-3 justify-center">
                                    <a href={outputUrl} download={`video-transformado.${outputFormat}`} className="btn btn-primary bg-green-600 hover:bg-green-500 border-none shadow-none">
                                        <Download className="w-5 h-5" /> Descargar
                                    </a>
                                    <button onClick={() => { setOutputUrl(null); setVideoInfo(null); setVideoFile(null); }} className="btn btn-secondary">
                                        Nuevo Video
                                    </button>
                                </div>

                                <video controls src={outputUrl} className="w-full rounded-lg max-h-[300px] bg-black" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
