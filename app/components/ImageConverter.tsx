"use client";

import { useState, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import JSZip from 'jszip';
import { Upload, Image as ImageIcon, Download, Loader2, ArrowRight, Trash2, Settings, Minimize2, Check, Tag } from 'lucide-react';

interface ImageConverterProps {
    ffmpeg: FFmpeg | null;
    loaded: boolean;
}

interface ImageItem {
    file: File;
    id: string;
    preview: string;
    originalWidth: number;
    originalHeight: number;
    targetWidth: number;
    targetHeight: number;
    aspectRatio: number;
    keyword: string;
    status: 'idle' | 'processing' | 'done' | 'error';
    outputUrl?: string;
    outputName?: string;
}

export default function ImageConverter({ ffmpeg, loaded }: ImageConverterProps) {
    const [images, setImages] = useState<ImageItem[]>([]);
    const [outputFormat, setOutputFormat] = useState('webp');
    const [quality, setQuality] = useState(100);
    const [processing, setProcessing] = useState(false);
    const [zipUrl, setZipUrl] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Clean the preview URLs when component unmounts
    useEffect(() => {
        return () => {
            images.forEach(img => URL.revokeObjectURL(img.preview));
        };
    }, []);

    const processFiles = async (files: File[]) => {
        const newImages: ImageItem[] = await Promise.all(files.map(async (file) => {
            const preview = URL.createObjectURL(file);

            // Get dimensions
            const dims = await new Promise<{ w: number, h: number }>((resolve) => {
                const img = new Image();
                img.onload = () => resolve({ w: img.width, h: img.height });
                img.src = preview;
            });

            return {
                file,
                id: Math.random().toString(36).substr(2, 9),
                preview,
                originalWidth: dims.w,
                originalHeight: dims.h,
                targetWidth: dims.w,
                targetHeight: dims.h,
                aspectRatio: dims.w / dims.h,
                keyword: '',
                status: 'idle'
            };
        }));

        setImages(prev => [...prev, ...newImages]);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            await processFiles(Array.from(e.target.files));
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
            if (files.length > 0) {
                await processFiles(files);
            }
        }
    };

    const removeImage = (id: string) => {
        setImages(prev => {
            const img = prev.find(i => i.id === id);
            if (img) URL.revokeObjectURL(img.preview);
            return prev.filter(i => i.id !== id);
        });
    };

    const handleKeywordChange = (id: string, value: string) => {
        setImages(prev => prev.map(img => img.id === id ? { ...img, keyword: value } : img));
    };

    const handleDimensionChange = (id: string, dimension: 'width' | 'height', value: number) => {
        setImages(prev => prev.map(img => {
            if (img.id !== id) return img;

            let newW = img.targetWidth;
            let newH = img.targetHeight;

            if (dimension === 'width') {
                newW = value;
                newH = Math.round(value / img.aspectRatio);
            } else {
                newH = value;
                newW = Math.round(value * img.aspectRatio);
            }

            return { ...img, targetWidth: newW, targetHeight: newH };
        }));
    };

    const convertImages = async () => {
        if (!loaded || !ffmpeg || images.length === 0) return;
        setProcessing(true);
        setZipUrl(null);

        const zip = new JSZip();
        const folder = zip.folder("converted_images");
        let processedCount = 0;

        const updatedImages = [...images];

        try {
            for (let i = 0; i < updatedImages.length; i++) {
                const img = updatedImages[i];
                if (img.status === 'done' && img.outputUrl) {
                    // Re-add to zip if already done? Or skip? Let's re-process to allow re-export with different settings if user wants
                    // Actually, usually user clicks convert after changing settings.
                }

                updatedImages[i].status = 'processing';
                setImages([...updatedImages]);

                const inputName = `input_${img.id}`;
                const outputName = `output_${img.id}.${outputFormat}`;

                await ffmpeg.writeFile(inputName, await fetchFile(img.file));

                const args = ['-i', inputName];

                // Resize
                if (img.targetWidth !== img.originalWidth || img.targetHeight !== img.originalHeight) {
                    args.push('-vf', `scale=${img.targetWidth}:${img.targetHeight}`);
                }

                // Quality
                if (outputFormat === 'jpg' || outputFormat === 'jpeg') {
                    const q = Math.max(2, Math.floor(31 - ((quality - 1) * (29) / 99)));
                    args.push('-q:v', q.toString());
                } else if (outputFormat === 'webp') {
                    args.push('-quality', quality.toString());
                }

                // Metadata & Keyword handling
                if (img.keyword && img.keyword.trim() !== "") {
                    // Standard and extended metadata fields to ensure compatibility
                    const metaTags = ['title', 'description', 'comment', 'author', 'copyright', 'ICRD'];
                    metaTags.forEach(tag => {
                        args.push('-metadata', `${tag}=${img.keyword}`);
                    });
                }

                args.push(outputName);

                await ffmpeg.exec(args);

                const data = await ffmpeg.readFile(outputName);
                const blob = new Blob([data as any], { type: `image/${outputFormat}` }); // data as any for TS
                const url = URL.createObjectURL(blob);

                if (folder) {
                    const originalName = img.file.name.split('.').slice(0, -1).join('.');
                    folder.file(`${originalName}.${outputFormat}`, data);
                }

                updatedImages[i].status = 'done';
                updatedImages[i].outputUrl = url;

                // Determine output filename
                let finalName = img.file.name.split('.')[0];
                if (img.keyword && img.keyword.trim() !== "") {
                    // Use keyword as filename, sanitize it a bit
                    finalName = img.keyword.trim().replace(/[^a-zA-Z0-9-_]/g, '-');
                }

                updatedImages[i].outputName = `${finalName}.${outputFormat}`;

                setImages([...updatedImages]);

                await ffmpeg.deleteFile(inputName);
                await ffmpeg.deleteFile(outputName);

                processedCount++;
            }

            const content = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(content);
            setZipUrl(url);

        } catch (error) {
            console.error(error);
            alert('Error during conversion');
        } finally {
            setProcessing(false);
        }
    };

    const formatOptions = ['jpg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'ico'];

    const activeImages = images.filter(img => img.status !== 'done');
    const completedImages = images.filter(img => img.status === 'done');

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in pb-20">
            {/* Left: Global Settings & Upload */}
            <div className="lg:col-span-4 space-y-6">
                <div className="glass-panel p-6 sticky top-6">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-primary" />
                        Configuración Global
                    </h2>

                    <div className="space-y-6">
                        {/* Upload Button */}
                        <label className="btn btn-primary w-full cursor-pointer shadow-lg shadow-primary/20">
                            <input
                                type="file"
                                multiple
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileUpload}
                                disabled={processing}
                            />
                            {/* @ts-ignore */}
                            <iconify-icon icon="lucide:plus" width="20"></iconify-icon>
                            + Añadir Imágenes
                        </label>

                        <div className="h-px bg-white/10"></div>

                        {/* Output Format */}
                        <div className="space-y-2">
                            <label className="label">Formato de Salida</label>
                            <select
                                value={outputFormat}
                                onChange={(e) => setOutputFormat(e.target.value)}
                                className="input-glass bg-surface/50"
                            >
                                {formatOptions.map(fmt => (
                                    <option key={fmt} value={fmt} className="bg-surface text-base">{fmt.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>

                        {/* Quality */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="label mb-0">Calidad Global</label>
                                <span className="text-xs font-mono bg-primary/20 text-primary px-2 py-0.5 rounded-full">{quality}%</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="100"
                                value={quality}
                                onChange={(e) => setQuality(parseInt(e.target.value))}
                                className="w-full accent-primary h-2 bg-black/40 rounded-lg appearance-none cursor-pointer"
                            />
                            <p className="text-[10px] text-gray-500">Aplica a JPG y WEBP</p>
                        </div>

                        {/* Action Button */}
                        <div className="pt-4">
                            <button
                                onClick={convertImages}
                                disabled={images.length === 0 || processing}
                                className={`btn w-full py-4 text-base font-bold transition-all ${images.length > 0 && !processing
                                    ? 'bg-gradient-to-r from-accent to-purple-600 text-white shadow-lg shadow-accent/25 hover:shadow-accent/40 hover:-translate-y-1'
                                    : 'bg-white/5 text-gray-500 cursor-not-allowed'
                                    }`}
                            >
                                {processing ? (
                                    <> <Loader2 className="w-5 h-5 animate-spin" /> Procesando... </>
                                ) : (
                                    <> <ArrowRight className="w-5 h-5" /> Convertir {images.length} Archivos </>
                                )}
                            </button>
                        </div>

                        {zipUrl && (
                            <a
                                href={zipUrl}
                                download="todas_las_imagenes.zip"
                                className="btn btn-secondary w-full border-green-500/30 text-green-400 bg-green-500/10 hover:bg-green-500/20"
                            >
                                <Download className="w-4 h-4" /> Download All (ZIP)
                            </a>
                        )}

                    </div>
                </div>
            </div>

            {/* Right: Image List */}
            <div
                className={`lg:col-span-8 space-y-4 rounded-xl transition-all ${isDragging ? 'border-2 border-primary border-dashed bg-primary/5' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {images.length === 0 ? (
                    <div className="glass-panel p-6 h-[400px] flex flex-col">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Upload className="w-5 h-5 text-primary" />
                            Importar Imágenes
                        </h2>
                        <div
                            className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${isDragging
                                ? 'border-primary bg-primary/10'
                                : 'border-white/10 bg-black/20 hover:border-white/20'
                                }`}
                        >
                            <div className="w-12 h-12 rounded-lg bg-surface flex items-center justify-center mb-4 border border-white/5 shadow-lg">
                                <ImageIcon className={`w-6 h-6 transition-colors ${isDragging ? 'text-primary' : 'text-blue-400'}`} />
                            </div>
                            <p className="text-lg font-bold text-white mb-1">
                                {isDragging ? '¡Suéltalagon aquí!' : 'Haz clic o arrastra imágenes'}
                            </p>
                            <p className="text-sm text-gray-500">
                                Soporta JPG, PNG, WEBP
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8">

                        {/* Active Images Queue */}
                        {activeImages.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider pl-1">Cola de Procesamiento</h3>
                                <div className="grid grid-cols-1 gap-4">
                                    {activeImages.map((img) => (
                                        <div key={img.id} className="glass-panel p-4 flex flex-col md:flex-row gap-6 relative group border-white/5 hover:border-white/10 transition-colors">
                                            {/* Delete Btn - Improved positioning */}
                                            <button
                                                onClick={() => removeImage(img.id)}
                                                className="absolute -top-2 -right-2 p-2 bg-surface border border-white/10 text-gray-400 hover:text-red-400 hover:border-red-500/30 rounded-full shadow-lg transition-all z-10"
                                                title="Eliminar imagen"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>

                                            {/* Preview */}
                                            <div className="w-full md:w-48 shrink-0 flex flex-col gap-2">
                                                <div className="aspect-video rounded-lg overflow-hidden bg-black/50 border border-white/5 relative">
                                                    <img src={img.preview} className="w-full h-full object-contain" alt="" />
                                                    {img.status === 'processing' && (
                                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                                                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-xs text-center text-gray-500 truncate px-2">{img.file.name}</div>
                                            </div>

                                            {/* Controls */}
                                            <div className="flex-1 min-w-0 flex flex-col justify-center gap-4">
                                                {/* Keyword / Alt Input */}
                                                <div className="space-y-1">
                                                    <label className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider flex items-center gap-1">
                                                        <Tag className="w-3 h-3" /> Keyword / Alt / Título
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder="Nombre del archivo y metadatos..."
                                                        value={img.keyword}
                                                        onChange={(e) => handleKeywordChange(img.id, e.target.value)}
                                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary/50 outline-none transition-colors"
                                                    />
                                                </div>

                                                {/* Dimensions */}
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider flex items-center gap-1">
                                                            <Minimize2 className="w-3 h-3" /> Ancho (px)
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={img.targetWidth}
                                                            onChange={(e) => handleDimensionChange(img.id, 'width', parseInt(e.target.value) || 0)}
                                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:border-primary/50 outline-none transition-colors"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider flex items-center gap-1">
                                                            <Minimize2 className="w-3 h-3 rotate-90" /> Alto (px)
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={img.targetHeight}
                                                            onChange={(e) => handleDimensionChange(img.id, 'height', parseInt(e.target.value) || 0)}
                                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:border-primary/50 outline-none transition-colors"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Completed Images Section */}
                        {completedImages.length > 0 && (
                            <div className="space-y-4 animate-fade-in">
                                <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider pl-1 flex items-center gap-2">
                                    <Check className="w-4 h-4" /> Imágenes Transformadas
                                </h3>
                                <div className="grid grid-cols-1 gap-4">
                                    {completedImages.map((img) => (
                                        <div key={img.id} className="glass-panel p-4 flex flex-col md:flex-row gap-6 relative group border-green-500/20 bg-green-500/5">
                                            {/* Preview */}
                                            <div className="w-full md:w-32 shrink-0 flex flex-col gap-2">
                                                <div className="aspect-video rounded-lg overflow-hidden bg-black/50 border border-white/5 relative">
                                                    <img src={img.outputUrl || img.preview} className="w-full h-full object-contain" alt="" />
                                                </div>
                                            </div>

                                            {/* Info & Download Only */}
                                            <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
                                                <div className="font-medium text-sm text-white truncate">{img.outputName}</div>
                                                <div className="text-xs text-gray-400">
                                                    {img.targetWidth}x{img.targetHeight} • {img.keyword || 'Sin metadatos'}
                                                </div>

                                                <div className="flex gap-3 mt-2">
                                                    <a
                                                        href={img.outputUrl}
                                                        download={img.outputName}
                                                        className="btn btn-sm bg-green-500 text-white shadow-lg shadow-green-500/20 hover:bg-green-600 border-none text-xs px-4"
                                                    >
                                                        <Download className="w-3 h-3 mr-2" /> Descargar
                                                    </a>
                                                    <button
                                                        onClick={() => removeImage(img.id)}
                                                        className="btn btn-sm bg-white/5 hover:bg-red-500/20 hover:text-red-400 border-transparent text-xs"
                                                    >
                                                        Eliminar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
