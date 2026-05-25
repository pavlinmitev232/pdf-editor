"use client";

import { ChangeEvent, DragEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
  Copy,
  Download,
  Eye,
  EyeOff,
  FileUp,
  List,
  Maximize,
  MousePointer2,
  Palette,
  Redo2,
  Square,
  Move,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { siteConfig } from "@/lib/site";

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
  mode: "move" | ResizeMode;
  startX: number;
  startY: number;
  original: Overlay;
};

type ResizeMode = "resize-n" | "resize-e" | "resize-s" | "resize-w" | "resize-ne" | "resize-se" | "resize-sw" | "resize-nw";

type DrawingState = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

type HistoryState = {
  past: Overlay[][];
  future: Overlay[][];
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

const resizeHandles: Array<{
  mode: ResizeMode;
  className: string;
  cursor: string;
}> = [
  { mode: "resize-nw", className: "-top-1.5 -left-1.5", cursor: "cursor-nwse-resize" },
  { mode: "resize-n", className: "-top-1.5 left-1/2 -translate-x-1/2", cursor: "cursor-ns-resize" },
  { mode: "resize-ne", className: "-top-1.5 -right-1.5", cursor: "cursor-nesw-resize" },
  { mode: "resize-e", className: "top-1/2 -right-1.5 -translate-y-1/2", cursor: "cursor-ew-resize" },
  { mode: "resize-se", className: "-bottom-1.5 -right-1.5", cursor: "cursor-nwse-resize" },
  { mode: "resize-s", className: "-bottom-1.5 left-1/2 -translate-x-1/2", cursor: "cursor-ns-resize" },
  { mode: "resize-sw", className: "-bottom-1.5 -left-1.5", cursor: "cursor-nesw-resize" },
  { mode: "resize-w", className: "top-1/2 -left-1.5 -translate-y-1/2", cursor: "cursor-ew-resize" },
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

function rgbToHex(red: number, green: number, blue: number) {
  return `#${componentToHex(red)}${componentToHex(green)}${componentToHex(blue)}`;
}

function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function getBoxFromPoints(startX: number, startY: number, currentX: number, currentY: number) {
  return {
    x: Math.min(startX, currentX),
    y: Math.min(startY, currentY),
    width: Math.abs(currentX - startX),
    height: Math.abs(currentY - startY),
  };
}

export function PdfEditor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [pdfDocProxy, setPdfDocProxy] = useState<PdfDocumentProxy | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("edited-document.pdf");
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [tool, setTool] = useState<Tool>("box");
  const [pickedColor, setPickedColor] = useState("#ffffff");
  const [textColor, setTextColor] = useState("#111111");
  const [textValue, setTextValue] = useState("");
  const [fontSize, setFontSize] = useState(18);
  const [zoom, setZoom] = useState(1);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [history, setHistory] = useState<HistoryState>({ past: [], future: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [drawingState, setDrawingState] = useState<DrawingState | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [fitAfterRender, setFitAfterRender] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [status, setStatus] = useState("Upload a PDF to start editing in your browser.");

  const currentOverlays = useMemo(
    () => overlays.filter((overlay) => overlay.page === pageNumber),
    [overlays, pageNumber],
  );
  const activeTool = toolOptions.find((option) => option.id === tool);
  const selectedOverlay = useMemo(
    () => overlays.find((overlay) => overlay.id === selectedId) || null,
    [overlays, selectedId],
  );
  const isPlacing = tool === "box" || tool === "text";
  const showBoxControls = tool === "box" || tool === "pick" || selectedOverlay?.type === "box";
  const showTextControls = tool === "text" || selectedOverlay?.type === "text";

  const commitOverlays = useCallback(
    (nextOverlays: Overlay[]) => {
      setHistory((items) => ({
        past: [...items.past.slice(-24), overlays],
        future: [],
      }));
      setOverlays(nextOverlays);
    },
    [overlays],
  );

  const recordHistory = useCallback(() => {
    setHistory((items) => ({
      past: [...items.past.slice(-24), overlays],
      future: [],
    }));
  }, [overlays]);

  const undo = useCallback(() => {
    setHistory((items) => {
      const previous = items.past.at(-1);
      if (!previous) return items;
      setOverlays(previous);
      setSelectedId(null);
      setEditingTextId(null);
      return {
        past: items.past.slice(0, -1),
        future: [overlays, ...items.future],
      };
    });
    setStatus("Undid the last edit.");
  }, [overlays]);

  const redo = useCallback(() => {
    setHistory((items) => {
      const next = items.future[0];
      if (!next) return items;
      setOverlays(next);
      setSelectedId(null);
      setEditingTextId(null);
      return {
        past: [...items.past, overlays],
        future: items.future.slice(1),
      };
    });
    setStatus("Redid the edit.");
  }, [overlays]);

  const loadPdfFile = async (file: File) => {
    if (!file) return;

    const bytes = await file.arrayBuffer();
    const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();

    const proxy = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
    const exportName = file.name
      .replace(/\.pdf$/i, "")
      .replace(/(?:-edited)+$/i, "");
    setPdfDocProxy(proxy);
    setPdfBytes(bytes);
    setFileName(`${exportName}-edited.pdf`);
    if (exportUrl) {
      URL.revokeObjectURL(exportUrl);
      setExportUrl(null);
    }
    setPageCount(proxy.numPages);
    setPageNumber(1);
    setOverlays([]);
    setHistory({ past: [], future: [] });
    setSelectedId(null);
    setEditingTextId(null);
    setPreviewMode(false);
    setFitAfterRender(true);
    setStatus(`${file.name} loaded. Pick a tool and click on the page.`);
  };

  const loadPdf = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await loadPdfFile(file);
    event.target.value = "";
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

  useEffect(() => {
    return () => {
      if (exportUrl) {
        URL.revokeObjectURL(exportUrl);
      }
    };
  }, [exportUrl]);

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
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) return;

    const [red, green, blue] = context.getImageData(x, y, 1, 1).data;
    const color = rgbToHex(red, green, blue);
    setPickedColor(color);
    if (selectedOverlay?.type === "box") {
      updateOverlay(selectedOverlay.id, { color });
      setStatus(`Picked exact pixel ${color} and applied it to the selected box.`);
      return;
    }
    setStatus(`Picked exact pixel ${color}. Choose Box when you are ready to place it.`);
  };

  const addTextOverlay = (event: PointerEvent<HTMLElement>) => {
    if (!pageInfo) return;

    const point = getPagePoint(event);
    const width = Math.max(140, Math.max(textValue.length, 9) * fontSize * 0.55);
    const height = fontSize * 1.35;
    const overlay: Overlay = {
      id: crypto.randomUUID(),
      page: pageNumber,
      type: "text",
      x: Math.min(point.x, pageInfo.width - width),
      y: Math.min(point.y, pageInfo.height - height),
      width,
      height,
      color: textColor,
      text: "",
      fontSize,
    };

    commitOverlays([...overlays, overlay]);
    setSelectedId(overlay.id);
    setEditingTextId(overlay.id);
    setTool("select");
    setTextValue("");
    setStatus("Text added. Edit it directly on the page, or drag the handle to move it.");
  };

  const handlePagePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!pdfDocProxy) return;
    setEditingTextId(null);
    if (tool === "pick") {
      pickCanvasColor(event);
      return;
    }
    if (tool === "box") {
      const point = getPagePoint(event);
      setDrawingState({
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y,
      });
      setStatus("Drag to draw a cover box.");
      return;
    }
    if (tool === "text") {
      addTextOverlay(event);
      return;
    }
    setSelectedId(null);
  };

  const handlePagePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!drawingState || !pageInfo) return;
    const point = getPagePoint(event);
    setDrawingState({
      ...drawingState,
      currentX: Math.max(0, Math.min(pageInfo.width, point.x)),
      currentY: Math.max(0, Math.min(pageInfo.height, point.y)),
    });
  };

  const finishDrawing = () => {
    if (!drawingState || !pageInfo) return;
    const box = getBoxFromPoints(
      drawingState.startX,
      drawingState.startY,
      drawingState.currentX,
      drawingState.currentY,
    );

    setDrawingState(null);

    if (box.width < 6 || box.height < 6) {
      setStatus("Drag on the page to draw a cover box.");
      return;
    }

    const overlay: Overlay = {
      id: crypto.randomUUID(),
      page: pageNumber,
      type: "box",
      x: Math.max(0, Math.min(pageInfo.width - box.width, box.x)),
      y: Math.max(0, Math.min(pageInfo.height - box.height, box.y)),
      width: box.width,
      height: box.height,
      color: pickedColor,
    };

    commitOverlays([...overlays, overlay]);
    setSelectedId(overlay.id);
    setTool("select");
    setStatus("Box added. The dashed outline is only visible in the editor.");
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>, overlay: Overlay, mode: DragState["mode"]) => {
    event.stopPropagation();
    recordHistory();
    setEditingTextId(null);
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

        if (dragState.mode !== "move") {
          const minWidth = 24;
          const minHeight = 18;
          const originalRight = dragState.original.x + dragState.original.width;
          const originalBottom = dragState.original.y + dragState.original.height;
          let nextX = dragState.original.x;
          let nextY = dragState.original.y;
          let nextWidth = dragState.original.width;
          let nextHeight = dragState.original.height;

          if (dragState.mode.includes("e")) {
            nextWidth = Math.max(minWidth, Math.min(pageInfo.width - nextX, dragState.original.width + dx));
          }

          if (dragState.mode.includes("s")) {
            nextHeight = Math.max(minHeight, Math.min(pageInfo.height - nextY, dragState.original.height + dy));
          }

          if (dragState.mode.includes("w")) {
            nextX = Math.max(0, Math.min(originalRight - minWidth, dragState.original.x + dx));
            nextWidth = originalRight - nextX;
          }

          if (dragState.mode.includes("n")) {
            nextY = Math.max(0, Math.min(originalBottom - minHeight, dragState.original.y + dy));
            nextHeight = originalBottom - nextY;
          }

          return {
            ...overlay,
            x: nextX,
            y: nextY,
            width: nextWidth,
            height: nextHeight,
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

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    commitOverlays(overlays.filter((overlay) => overlay.id !== selectedId));
    setSelectedId(null);
    setEditingTextId(null);
  }, [commitOverlays, overlays, selectedId]);

  const updateOverlay = (id: string, changes: Partial<Overlay>, recordHistory = false) => {
    const nextOverlays = overlays.map((overlay) => (overlay.id === id ? { ...overlay, ...changes } : overlay));
    if (recordHistory) {
      commitOverlays(nextOverlays);
      return;
    }
    setOverlays(nextOverlays);
  };

  const selectOverlay = (overlay: Overlay) => {
    setSelectedId(overlay.id);
    setEditingTextId(overlay.type === "text" ? overlay.id : null);
    if (overlay.type === "text") {
      setTextValue(overlay.text || "");
      setTextColor(overlay.color);
      setFontSize(overlay.fontSize || 18);
      setStatus("Text selected. Type on the page, or drag the Move handle to reposition it.");
    } else {
      setStatus("Box selected. Drag it, resize it, or delete it.");
    }
  };

  const updateSelectedTextColor = (color: string) => {
    if (!isHexColor(color)) return;
    setTextColor(color);
    if (selectedId) {
      updateOverlay(selectedId, { color });
    }
  };

  const duplicateSelected = useCallback(() => {
    if (!selectedOverlay || !pageInfo) return;
    const offset = 18;
    const duplicate: Overlay = {
      ...selectedOverlay,
      id: crypto.randomUUID(),
      x: Math.min(pageInfo.width - selectedOverlay.width, selectedOverlay.x + offset),
      y: Math.min(pageInfo.height - selectedOverlay.height, selectedOverlay.y + offset),
    };

    commitOverlays([...overlays, duplicate]);
    setSelectedId(duplicate.id);
    setEditingTextId(duplicate.type === "text" ? duplicate.id : null);
    setStatus(`${duplicate.type === "box" ? "Box" : "Text"} duplicated.`);
  }, [commitOverlays, overlays, pageInfo, selectedOverlay]);

  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const file = Array.from(event.dataTransfer.files).find((item) => item.type === "application/pdf" || item.name.toLowerCase().endsWith(".pdf"));
    if (!file) {
      setStatus("Drop a PDF file to upload.");
      return;
    }
    await loadPdfFile(file);
  };

  const fitToWidth = () => {
    if (!stageRef.current || !pageInfo) return;
    const availableWidth = stageRef.current.clientWidth - 48;
    setZoom(Math.max(0.45, Math.min(2.5, Number((availableWidth / pageInfo.width).toFixed(2)))));
  };

  const fitPage = () => {
    if (!stageRef.current || !pageInfo) return;
    const availableWidth = stageRef.current.clientWidth - 48;
    const availableHeight = stageRef.current.clientHeight - 48;
    const nextZoom = Math.min(availableWidth / pageInfo.width, availableHeight / pageInfo.height);
    setZoom(Math.max(0.45, Math.min(2.5, Number(nextZoom.toFixed(2)))));
  };

  useEffect(() => {
    if (!fitAfterRender || !stageRef.current || !pageInfo) return;
    const timeout = window.setTimeout(() => {
      const availableWidth = stageRef.current?.clientWidth ? stageRef.current.clientWidth - 48 : pageInfo.width;
      const availableHeight = stageRef.current?.clientHeight ? stageRef.current.clientHeight - 48 : pageInfo.height;
      const nextZoom = Math.min(availableWidth / pageInfo.width, availableHeight / pageInfo.height);
      setZoom(Math.max(0.55, Math.min(1.75, Number(nextZoom.toFixed(2)))));
      setFitAfterRender(false);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [fitAfterRender, pageInfo]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !isTyping) {
        event.preventDefault();
        undo();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y" && !isTyping) {
        event.preventDefault();
        redo();
        return;
      }

      if (event.key === "Escape") {
        setTool("select");
        setDrawingState(null);
        setEditingTextId(null);
        setPreviewMode(false);
        setStatus("Select tool active.");
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && selectedId && !isTyping) {
        event.preventDefault();
        duplicateSelected();
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && selectedId && !isTyping) {
        event.preventDefault();
        deleteSelected();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelected, duplicateSelected, redo, selectedId, undo]);

  const exportPdf = async () => {
    if (!pdfBytes || !pageInfo || !pdfDocProxy) return;

    setIsExporting(true);
    setStatus("Preparing your edited PDF...");

    try {
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
      if (exportUrl) {
        URL.revokeObjectURL(exportUrl);
      }
      setExportUrl(url);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.rel = "noopener";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();

      window.setTimeout(() => link.remove(), 1_000);

      setStatus(`Export ready: ${fileName}. If it did not download automatically, use the Download ready link.`);
    } catch (error) {
      console.error(error);
      setStatus("Export failed. Try removing the last edit or upload the PDF again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="flex h-screen overflow-hidden flex-col bg-[#f5f3ef] text-[#211f1c]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[#ded8cc] bg-[#fffdfa] px-5 py-3">
        <div>
          <h1 className="text-xl font-semibold">{siteConfig.name}</h1>
          <p className="text-sm text-[#69635b]">Local-first visual editing for quick cleanups and covers.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <nav className="flex flex-wrap items-center gap-1 text-sm text-[#69635b]">
            <a className="rounded-md px-2.5 py-2 hover:bg-[#f5f3ef] hover:text-[#211f1c]" href="/guides">
              Guides
            </a>
            <a className="rounded-md px-2.5 py-2 hover:bg-[#f5f3ef] hover:text-[#211f1c]" href="/edit-pdf-online">
              Tools
            </a>
            <a className="rounded-md px-2.5 py-2 hover:bg-[#f5f3ef] hover:text-[#211f1c]" href="/about">
              About
            </a>
            <a className="rounded-md px-2.5 py-2 hover:bg-[#f5f3ef] hover:text-[#211f1c]" href="/privacy">
              Privacy
            </a>
            <a className="rounded-md px-2.5 py-2 hover:bg-[#f5f3ef] hover:text-[#211f1c]" href="/cookies">
              Cookies
            </a>
            <a className="rounded-md px-2.5 py-2 hover:bg-[#f5f3ef] hover:text-[#211f1c]" href="/contact">
              Contact
            </a>
          </nav>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-[#211f1c] px-4 text-sm font-medium text-white hover:bg-[#3a3630]">
            <FileUp size={18} />
            Upload
            <input className="sr-only" type="file" accept="application/pdf" onChange={loadPdf} />
          </label>
        </div>
      </header>

      <section className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-auto border-r border-[#ded8cc] bg-[#fffdfa] p-3">
          <div className="space-y-5">
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-normal text-[#69635b]">Tools</h2>
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
            </section>

            <div className="rounded-md border border-[#ded8cc] bg-[#f7fbfa] p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">Active tool</span>
                <span className="rounded-full bg-[#146c63] px-2.5 py-1 text-xs font-semibold text-white">
                  {activeTool?.label}
                </span>
              </div>
              <p className="mt-2 text-[#69635b]">
                {tool === "pick"
                  ? "Click the PDF to sample a pixel color."
                  : isPlacing
                    ? `${tool === "box" ? "Drag on the PDF to draw a cover box." : "Click the PDF to place editable text."}`
                    : selectedOverlay
                      ? `${selectedOverlay.type === "box" ? "Box" : "Text"} selected.`
                      : "Click an item to select it."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#ded8cc] bg-white text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
                disabled={history.past.length === 0}
                type="button"
                onClick={undo}
                title="Undo"
              >
                <Undo2 size={17} />
                Undo
              </button>
              <button
                className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#ded8cc] bg-white text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
                disabled={history.future.length === 0}
                type="button"
                onClick={redo}
                title="Redo"
              >
                <Redo2 size={17} />
                Redo
              </button>
            </div>

            <button
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#ded8cc] bg-white text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!selectedOverlay}
              type="button"
              onClick={duplicateSelected}
              title="Duplicate selected"
            >
              <Copy size={17} />
              Duplicate selected
            </button>

            {(showBoxControls || showTextControls) ? (
              <section className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-normal text-[#69635b]">Style</h2>
                {showBoxControls ? (
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
                        onFocus={recordHistory}
                        onChange={(event) => {
                          if (isHexColor(event.target.value)) {
                            setPickedColor(event.target.value);
                          }
                        }}
                      />
                    </div>
                  </label>
                ) : null}

                {showTextControls ? (
                  <>
                    <label className="block text-sm font-medium">
                      Text color
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          className="h-10 w-14 rounded-md border border-[#ded8cc] bg-white p-1"
                          type="color"
                          value={textColor}
                          onFocus={recordHistory}
                          onChange={(event) => updateSelectedTextColor(event.target.value)}
                        />
                        <input
                          className="h-10 min-w-0 flex-1 rounded-md border border-[#ded8cc] bg-white px-3 font-mono text-sm"
                          value={textColor}
                          onFocus={recordHistory}
                          onChange={(event) => updateSelectedTextColor(event.target.value)}
                        />
                      </div>
                    </label>

                    <label className="block text-sm font-medium">
                      Text content
                      <input
                        className="mt-2 h-10 w-full rounded-md border border-[#ded8cc] bg-white px-3 text-sm"
                        placeholder="Type on the page or here"
                        value={textValue}
                        onFocus={recordHistory}
                        onChange={(event) => {
                          setTextValue(event.target.value);
                          if (selectedOverlay?.type === "text") {
                            updateOverlay(selectedOverlay.id, { text: event.target.value });
                          }
                        }}
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
                        onFocus={recordHistory}
                        onChange={(event) => {
                          const nextSize = Number(event.target.value);
                          setFontSize(nextSize);
                          if (selectedOverlay?.type === "text") {
                            updateOverlay(selectedOverlay.id, {
                              fontSize: nextSize,
                              height: Math.max(18, nextSize * 1.35),
                            });
                          }
                        }}
                      />
                    </label>
                  </>
                ) : null}
              </section>
            ) : null}

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

            <div className="grid grid-cols-2 gap-2">
              <button
                className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#ded8cc] bg-white text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!pageInfo}
                type="button"
                onClick={fitToWidth}
                title="Fit width"
              >
                <Maximize size={16} />
                Fit width
              </button>
              <button
                className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#ded8cc] bg-white text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!pageInfo}
                type="button"
                onClick={fitPage}
                title="Fit page"
              >
                <Maximize size={16} />
                Fit page
              </button>
            </div>

            <section className="rounded-md border border-[#ded8cc] bg-white">
              <div className="flex h-10 items-center gap-2 border-b border-[#ded8cc] px-3 text-sm font-medium">
                <List size={16} />
                Layers
              </div>
              {overlays.length ? (
                <div className="max-h-44 overflow-auto p-2">
                  {overlays
                    .slice()
                    .reverse()
                    .map((overlay, index) => (
                      <button
                        key={overlay.id}
                        className={`flex h-9 w-full items-center justify-between gap-2 rounded px-2 text-left text-sm ${
                          selectedId === overlay.id ? "bg-[#e5f3ef] text-[#0f5e56]" : "hover:bg-[#f5f3ef]"
                        }`}
                        type="button"
                        onClick={() => {
                          setPageNumber(overlay.page);
                          selectOverlay(overlay);
                        }}
                      >
                        <span className="truncate">
                          {overlay.type === "box" ? "Box" : overlay.text?.trim() || "Text"}
                        </span>
                        <span className="shrink-0 text-xs text-[#69635b]">
                          p{overlay.page} - {overlays.length - index}
                        </span>
                      </button>
                    ))}
                </div>
              ) : (
                <div className="px-3 py-4 text-sm text-[#69635b]">No layers yet.</div>
              )}
            </section>

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

        <section className="flex min-h-0 min-w-0 flex-col">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#ded8cc] bg-[#fffdfa] px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm text-[#69635b]">{status}</div>
              {overlays.length ? (
                <div className="truncate text-xs text-[#8a8277]">
                  Editor outlines and handles are not exported. Visual covers do not securely remove hidden PDF text yet.
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium ${
                  previewMode
                    ? "border-[#211f1c] bg-[#211f1c] text-white"
                    : "border-[#ded8cc] bg-white text-[#211f1c] hover:bg-[#f5f3ef]"
                }`}
                disabled={!pdfBytes}
                type="button"
                onClick={() => {
                  setPreviewMode((value) => !value);
                  setEditingTextId(null);
                  setStatus(previewMode ? "Editor mode active." : "Preview mode active. Editor outlines and handles are hidden.");
                }}
              >
                {previewMode ? <EyeOff size={16} /> : <Eye size={16} />}
                {previewMode ? "Exit preview" : "Preview"}
              </button>
              <button
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-[#146c63] px-3 text-sm font-medium text-white hover:bg-[#0f5e56] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#146c63]"
                disabled={!pdfBytes || overlays.length === 0 || isExporting}
                type="button"
                onClick={exportPdf}
              >
                <Download size={16} />
                {isExporting ? "Exporting" : "Export"}
              </button>
              {exportUrl ? (
                <a
                  className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-[#146c63] bg-white px-3 text-sm font-medium text-[#146c63] hover:bg-[#e5f3ef]"
                  href={exportUrl}
                  download={fileName}
                >
                  <Download size={16} />
                  Download ready
                </a>
              ) : null}
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

          <div
            ref={stageRef}
            className="flex flex-1 overflow-auto p-5"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            {pdfDocProxy ? (
              <div
                className={`relative m-auto shadow-xl shadow-black/15 ${
                  !previewMode && (tool === "pick" || isPlacing) ? "cursor-crosshair" : ""
                }`}
                style={{
                  width: pageInfo ? pageInfo.width * zoom : undefined,
                  height: pageInfo ? pageInfo.height * zoom : undefined,
                }}
                onPointerDown={previewMode ? undefined : handlePagePointerDown}
                onPointerMove={previewMode ? undefined : handlePagePointerMove}
                onPointerUp={previewMode ? undefined : finishDrawing}
                onPointerLeave={previewMode ? undefined : finishDrawing}
              >
                <canvas ref={canvasRef} className="absolute inset-0 bg-white" />
                {!previewMode && isPlacing ? (
                  <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-md border border-[#146c63] bg-white/95 px-3 py-2 text-xs font-semibold text-[#146c63] shadow-sm">
                    {tool === "box" ? "Drag to draw box" : "Click to place text"}
                  </div>
                ) : null}
                {!previewMode && drawingState ? (
                  <div
                    className="pointer-events-none absolute z-10 border-2 border-dashed border-[#146c63] bg-[#146c63]/15"
                    style={{
                      left: getBoxFromPoints(
                        drawingState.startX,
                        drawingState.startY,
                        drawingState.currentX,
                        drawingState.currentY,
                      ).x * zoom,
                      top: getBoxFromPoints(
                        drawingState.startX,
                        drawingState.startY,
                        drawingState.currentX,
                        drawingState.currentY,
                      ).y * zoom,
                      width:
                        getBoxFromPoints(
                          drawingState.startX,
                          drawingState.startY,
                          drawingState.currentX,
                          drawingState.currentY,
                        ).width * zoom,
                      height:
                        getBoxFromPoints(
                          drawingState.startX,
                          drawingState.startY,
                          drawingState.currentX,
                          drawingState.currentY,
                        ).height * zoom,
                    }}
                  />
                ) : null}
                {currentOverlays.map((overlay) => (
                  <div
                    key={overlay.id}
                    className={`absolute touch-none ${
                      previewMode
                        ? "outline outline-1 outline-transparent"
                        : selectedId === overlay.id
                        ? "outline outline-2 outline-[#146c63]"
                        : overlay.type === "box"
                          ? "outline outline-1 outline-transparent hover:outline-[#146c63]/35"
                          : "outline outline-1 outline-transparent"
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
                      cursor: tool === "select" ? "pointer" : "default",
                    }}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      if (previewMode) return;
                      if (tool === "select" && selectedId === overlay.id && overlay.type === "box") {
                        startDrag(event, overlay, "move");
                        return;
                      }
                      selectOverlay(overlay);
                    }}
                    onPointerMove={continueDrag}
                    onPointerUp={() => setDragState(null)}
                  >
                    {overlay.type === "text" ? (
                      editingTextId === overlay.id ? (
                        <textarea
                          autoFocus
                          className="h-full w-full resize-none overflow-hidden border-0 bg-transparent p-0 leading-[1.15] outline-none placeholder:text-[#777]"
                          placeholder="Type here"
                          style={{
                            color: overlay.color,
                            fontSize: (overlay.fontSize || 18) * zoom,
                          }}
                          value={overlay.text || ""}
                          onFocus={recordHistory}
                          onChange={(event) => {
                            updateOverlay(overlay.id, { text: event.target.value });
                            setTextValue(event.target.value);
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                        />
                      ) : (
                        <span>{overlay.text}</span>
                      )
                    ) : null}
                    {!previewMode && selectedId === overlay.id ? (
                      <>
                        <div
                          className="absolute -top-8 left-1/2 z-30 flex h-7 -translate-x-1/2 cursor-move items-center gap-1 rounded-md border border-white bg-[#146c63] px-2 text-xs font-semibold text-white shadow-sm"
                          title="Drag to move"
                          onPointerDown={(event) => startDrag(event, overlay, "move")}
                          onPointerMove={continueDrag}
                          onPointerUp={() => setDragState(null)}
                        >
                          <Move size={13} />
                          Move
                        </div>
                        {resizeHandles.map((handle) => (
                          <div
                            key={handle.mode}
                            className={`absolute z-30 h-3.5 w-3.5 rounded-sm border border-white bg-[#146c63] shadow-sm ${handle.className} ${handle.cursor}`}
                            onPointerDown={(event) => startDrag(event, overlay, handle.mode)}
                            onPointerMove={continueDrag}
                            onPointerUp={() => setDragState(null)}
                          />
                        ))}
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <label
                className="m-auto flex min-h-80 w-full max-w-xl cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-[#bdb5a7] bg-[#fffdfa] p-10 text-center hover:bg-white"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
              >
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
