# BuzzMarketing Media Converter

Herramienta profesional de conversión de medios (Video e Imagen) desarrollada para BuzzMarketing.

## Características

- **Conversor de Imágenes**:
  - Soporte para JPG, PNG, WEBP.
  - Conversión masiva.
  - Redimensionado inteligente manteniendo relación de aspecto.
  - Inyección de metadatos (Keyword) en Title, Description, Author, Copyright, etc.
  - Descarga individual o en ZIP.
  
- **Conversor de Video**:
  - Basado en FFmpeg (WASM) en el navegador.
  - Soporte para MP4, WebM, AVI, MOV.
  - Selección de códecs (H.264, VP9).
  - Ajuste de resolución (720p, 1080p, 4K, Custom).

## Tecnologías

- Next.js 14+
- FFmpeg.wasm (Procesamiento local en el navegador)
- Tailwind CSS (Diseño Glassmorphism)
- React
- JSZip

## Despliegue

Esta aplicación requiere headers `Cross-Origin-Opener-Policy` y `Cross-Origin-Embedder-Policy` para funcionar debido a `SharedArrayBuffer` de FFmpeg. Estos ya están configurados en `next.config.ts`.

Se recomienda desplegar en **Vercel**.
