"use client";

import { ChangeEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
  Download,
  FileUp,
  MousePointer2,
  Palette,
  Square,
  Trash2,
  Type,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

type Tool = "select" | "pick" | "box" | "text";

type Overlay = {
  id: string;
  page: number;
  type: "box" | "text";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  text?: string;
  fontSize?: number;
};

type PageInfo = {
  width: number;
  height: number;
};

type DragState = {
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  original: Overlay;
};

type PdfPageProxy = {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void>; cancel: () => void };
};

type PdfDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
};

const toolOptions: Array<{ id: Tool; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "pick", label: "Pick color", icon: Palette },
  { id: "box", label: "Box", icon: Square },
  { id: "text", label: "Text", icon: Type },
];

function hexToRgb(color: string) {
  const clean = color.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  };
}

function componentToHex(value: number) {
  return value.toString(16).padStart(2, "0");
}

export function PdfEditor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [pdfDocProxy, setPdfDocProxy] = useState<PdfDocumentProxy | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("edited-document.pdf");
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [tool, setTool] = useState<Tool>("box");
  const [pickedColor, setPickedColor] = useState("#ffffff");
  const [textValue, setTextValue] = useState("New text");
  const [fontSize, setFontSize] = useState(18);
  const [zoom, setZoom] = useState(1);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [status, setStatus] = useState("Upload a PDF to start editing in your browser.");

  const currentOverlays = useMemo(
    () => overlays.filter((overlay) => overlay.page === pageNumber),
    [overlays, pageNumber],
  );

  const loadPdf = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const bytes = await file.arrayBuffer();
    const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();

    const proxy = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
    setPdfDocProxy(proxy);
    setPdfBytes(bytes);
    setFileName(file.name.replace(/\.pdf$/i, "") + "-edited.pdf");
    setPageCount(proxy.numPages);
    setPageNumber(1);
    setOverlays([]);
    setSelectedId(null);
    setStatus(`${file.name} loaded. Pick a tool and click on the page.`);
  };

  const renderPage = useCallback(async () => {
    if (!pdfDocProxy || !canvasRef.current) return;

    renderTaskRef.current?.cancel();
    const page = await pdfDocProxy.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const deviceScale = window.devicePixelRatio || 1;
    const renderViewport = page.getViewport({ scale: zoom * deviceScale });
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) return;

    setPageInfo({ width: baseViewport.width, height: baseViewport.height });
    canvas.width = Math.floor(renderViewport.width);
    canvas.height = Math.floor(renderViewport.height);
    canvas.style.width = `${baseViewport.width * zoom}px`;
    canvas.style.height = `${baseViewport.height * zoom}px`;

    const renderTask = page.render({
      canvasContext: context,
      viewport: renderViewport,
    });

    renderTaskRef.current = renderTask;

    try {
      await renderTask.promise;
    } catch (error: unknown) {
      if (!(error instanceof Error) || error.name !== "RenderingCancelledException") {
        setStatus("The page could not be rendered.");
      }
    }
  }, [pageNumber, pdfDocProxy, zoom]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void renderPage();
  }, [renderPage]);

  const getPagePoint = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / zoom,
      y: (event.clientY - rect.top) / zoom,
    };
  };

  const pickCanvasColor = (event: PointerEvent<HTMLElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height)));
    const pixel = canvas.getContext("2d", { willReadFrequently: true })?.getImageData(x, y, 1, 1).data;

    if (!pixel) return;

    const color = `#${componentToHex(pixel[0])}${componentToHex(pixel[1])}${componentToHex(pixel[2])}`;
    setPickedColor(color);
    setTool("box");
    setStatus(`Picked ${color}. Click the PDF to place a cover box.`);
  };

  const addOverlay = (event: PointerEvent<HTMLElement>) => {
    if (!pageInfo) return;

    const point = getPagePoint(event);
    const isText = tool === "text";
    const width = isText ? Math.max(120, textValue.length * fontSize * 0.55) : 180;
    const height = isText ? fontSize * 1.35 : 70;
    const overlay: Overlay = {
      id: crypto.randomUUID(),
      page: pageNumber,
      type: isText ? "text" : "box",
      x: Math.min(point.x, pageInfo.width - width),
      y: Math.min(point.y, pageInfo.height - height),
      width,
      height,
      color: pickedColor,
      text: isText ? textValue : undefined,
      fontSize: isText ? fontSize : undefined,
    };

    setOverlays((items) => [...items, overlay]);
    setSelectedId(overlay.id);
    setTool("select");
    setStatus(isText ? "Text added. Drag it into place." : "Box added. Drag or resize it as needed.");
  };

  const handlePagePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!pdfDocProxy) return;
    if (tool === "pick") {
      pickCanvasColor(event);
      return;
    }
    if (tool === "box" || tool === "text") {
      addOverlay(event);
      return;
    }
    setSelectedId(null);
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>, overlay: Overlay, mode: "move" | "resize") => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(overlay.id);
    setDragState({
      id: overlay.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      original: overlay,
    });
  };

  const continueDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState || !pageInfo) return;

    const dx = (event.clientX - dragState.startX) / zoom;
    const dy = (event.clientY - dragState.startY) / zoom;

    setOverlays((items) =>
      items.map((overlay) => {
        if (overlay.id !== dragState.id) return overlay;

        if (dragState.mode === "resize") {
          return {
            ...overlay,
            width: Math.max(24, Math.min(pageInfo.width - overlay.x, dragState.original.width + dx)),
            height: Math.max(18, Math.min(pageInfo.height - overlay.y, dragState.original.height + dy)),
          };
        }

        return {
          ...overlay,
          x: Math.max(0, Math.min(pageInfo.width - overlay.width, dragState.original.x + dx)),
          y: Math.max(0, Math.min(pageInfo.height - overlay.height, dragState.original.y + dy)),
        };
      }),
    );
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setOverlays((items) => items.filter((overlay) => overlay.id !== selectedId));
    setSelectedId(null);
  };

  const exportPdf = async () => {
    if (!pdfBytes || !pageInfo || !pdfDocProxy) return;

    const output = await PDFDocument.load(pdfBytes.slice(0));
    const font = await output.embedFont(StandardFonts.Helvetica);

    for (const overlay of overlays) {
      const page = output.getPage(overlay.page - 1);
      const { width: pdfWidth, height: pdfHeight } = page.getSize();
      const pageProxy = await pdfDocProxy.getPage(overlay.page);
      const viewport = pageProxy.getViewport({ scale: 1 });
      const scaleX = pdfWidth / viewport.width;
      const scaleY = pdfHeight / viewport.height;
      const color = hexToRgb(overlay.color);
      const x = overlay.x * scaleX;
      const y = pdfHeight - (overlay.y + overlay.height) * scaleY;

      if (overlay.type === "box") {
        page.drawRectangle({
          x,
          y,
          width: overlay.width * scaleX,
          height: overlay.height * scaleY,
          color: rgb(color.r, color.g, color.b),
          borderColor: rgb(color.r, color.g, color.b),
          borderWidth: 0,
        });
      } else if (overlay.text) {
        page.drawText(overlay.text, {
          x,
          y: y + overlay.height * scaleY * 0.2,
          size: (overlay.fontSize || 18) * scaleY,
          font,
          color: rgb(color.r, color.g, color.b),
          maxWidth: overlay.width * scaleX,
        });
      }
    }

    const bytes = await output.save();
    const pdfArrayBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(pdfArrayBuffer).set(bytes);
    const blob = new Blob([pdfArrayBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Exported a new PDF with your edits baked in.");
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#f5f3ef] text-[#211f1c]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ded8cc] bg-[#fffdfa] px-5 py-3">
        <div>
          <h1 className="text-xl font-semibold">PDF Editor</h1>
          <p className="text-sm text-[#69635b]">Local-first visual editing for quick cleanups and covers.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-[#211f1c] px-4 text-sm font-medium text-white hover:bg-[#3a3630]">
            <FileUp size={18} />
            Upload
            <input className="sr-only" type="file" accept="application/pdf" onChange={loadPdf} />
          </label>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[#146c63] px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!pdfBytes || overlays.length === 0}
            type="button"
            onClick={exportPdf}
          >
            <Download size={18} />
            Export
          </button>
        </div>
      </header>

      <section className="grid flex-1 grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-[#ded8cc] bg-[#fffdfa] p-4 lg:border-b-0 lg:border-r">
          <div className="grid grid-cols-2 gap-2">
            {toolOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  className={`flex h-11 items-center justify-center gap-2 rounded-md border text-sm font-medium ${
                    tool === option.id
                      ? "border-[#211f1c] bg-[#211f1c] text-white"
                      : "border-[#ded8cc] bg-white text-[#211f1c] hover:bg-[#f5f3ef]"
                  }`}
                  type="button"
                  onClick={() => setTool(option.id)}
                  title={option.label}
                >
                  <Icon size={17} />
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="mt-5 space-y-4">
            <label className="block text-sm font-medium">
              Cover color
              <div className="mt-2 flex items-center gap-2">
                <input
                  className="h-10 w-14 rounded-md border border-[#ded8cc] bg-white p-1"
                  type="color"
                  value={pickedColor}
                  onChange={(event) => setPickedColor(event.target.value)}
                />
                <input
                  className="h-10 min-w-0 flex-1 rounded-md border border-[#ded8cc] bg-white px-3 font-mono text-sm"
                  value={pickedColor}
                  onChange={(event) => setPickedColor(event.target.value)}
                />
              </div>
            </label>

            <label className="block text-sm font-medium">
              Text
              <input
                className="mt-2 h-10 w-full rounded-md border border-[#ded8cc] bg-white px-3 text-sm"
                value={textValue}
                onChange={(event) => setTextValue(event.target.value)}
              />
            </label>

            <label className="block text-sm font-medium">
              Font size
              <input
                className="mt-2 h-10 w-full rounded-md border border-[#ded8cc] bg-white px-3 text-sm"
                min={8}
                max={96}
                type="number"
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value))}
              />
            </label>

            <div className="flex gap-2">
              <button
                className="flex h-10 flex-1 items-center justify-center rounded-md border border-[#ded8cc] bg-white hover:bg-[#f5f3ef]"
                type="button"
                onClick={() => setZoom((value) => Math.max(0.5, Number((value - 0.1).toFixed(1))))}
                title="Zoom out"
              >
                <ZoomOut size={18} />
              </button>
              <div className="flex h-10 w-20 items-center justify-center rounded-md border border-[#ded8cc] bg-white text-sm font-medium">
                {Math.round(zoom * 100)}%
              </div>
              <button
                className="flex h-10 flex-1 items-center justify-center rounded-md border border-[#ded8cc] bg-white hover:bg-[#f5f3ef]"
                type="button"
                onClick={() => setZoom((value) => Math.min(2.5, Number((value + 0.1).toFixed(1))))}
                title="Zoom in"
              >
                <ZoomIn size={18} />
              </button>
            </div>

            <button
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#ded8cc] bg-white text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!selectedId}
              type="button"
              onClick={deleteSelected}
            >
              <Trash2 size={17} />
              Delete selected
            </button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ded8cc] bg-[#fffdfa] px-4 py-3">
            <div className="truncate text-sm text-[#69635b]">{status}</div>
            <div className="flex items-center gap-2">
              <button
                className="h-9 rounded-md border border-[#ded8cc] bg-white px-3 text-sm disabled:opacity-40"
                disabled={pageNumber <= 1}
                type="button"
                onClick={() => setPageNumber((value) => value - 1)}
              >
                Prev
              </button>
              <span className="min-w-24 text-center text-sm font-medium">
                {pageCount ? `${pageNumber} / ${pageCount}` : "No PDF"}
              </span>
              <button
                className="h-9 rounded-md border border-[#ded8cc] bg-white px-3 text-sm disabled:opacity-40"
                disabled={!pageCount || pageNumber >= pageCount}
                type="button"
                onClick={() => setPageNumber((value) => value + 1)}
              >
                Next
              </button>
            </div>
          </div>

          <div className="flex flex-1 overflow-auto p-5">
            {pdfDocProxy ? (
              <div
                className="relative m-auto shadow-xl shadow-black/15"
                style={{
                  width: pageInfo ? pageInfo.width * zoom : undefined,
                  height: pageInfo ? pageInfo.height * zoom : undefined,
                }}
                onPointerDown={handlePagePointerDown}
              >
                <canvas ref={canvasRef} className="absolute inset-0 bg-white" />
                {currentOverlays.map((overlay) => (
                  <div
                    key={overlay.id}
                    className={`absolute touch-none ${
                      selectedId === overlay.id ? "outline outline-2 outline-[#146c63]" : "outline outline-1 outline-transparent"
                    }`}
                    style={{
                      left: overlay.x * zoom,
                      top: overlay.y * zoom,
                      width: overlay.width * zoom,
                      height: overlay.height * zoom,
                      background: overlay.type === "box" ? overlay.color : "transparent",
                      color: overlay.color,
                      fontSize: (overlay.fontSize || 18) * zoom,
                      lineHeight: 1.15,
                      cursor: tool === "select" ? "move" : "default",
                    }}
                    onPointerDown={(event) => startDrag(event, overlay, "move")}
                    onPointerMove={continueDrag}
                    onPointerUp={() => setDragState(null)}
                  >
                    {overlay.type === "text" ? overlay.text : null}
                    {selectedId === overlay.id ? (
                      <div
                        className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border border-white bg-[#146c63]"
                        onPointerDown={(event) => startDrag(event, overlay, "resize")}
                        onPointerMove={continueDrag}
                        onPointerUp={() => setDragState(null)}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <label className="m-auto flex min-h-80 w-full max-w-xl cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-[#bdb5a7] bg-[#fffdfa] p-10 text-center hover:bg-white">
                <FileUp className="mb-4 text-[#146c63]" size={42} />
                <span className="text-lg font-semibold">Upload a PDF</span>
                <span className="mt-2 max-w-sm text-sm text-[#69635b]">
                  Files stay in your browser for this MVP. You can sample colors, cover content, add text, and export a new PDF.
                </span>
                <input className="sr-only" type="file" accept="application/pdf" onChange={loadPdf} />
              </label>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
