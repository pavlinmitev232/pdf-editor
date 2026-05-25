"use client";

import { ChangeEvent, DragEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
  ArrowUpRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileUp,
  ImagePlus,
  List,
  Maximize,
  Minus,
  MousePointer2,
  Palette,
  Redo2,
  Square,
  Move,
  PenLine,
  Trash2,
  Type,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { siteConfig } from "@/lib/site";

type Tool = "select" | "pick" | "box" | "highlight" | "line" | "arrow" | "text" | "clone";

type Overlay = {
  id: string;
  page: number;
  type: "box" | "highlight" | "line" | "arrow" | "text" | "image";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  text?: string;
  fontSize?: number;
  imageData?: string;
  imageLabel?: string;
  lineOrientation?: "horizontal" | "vertical" | "down" | "up";
  lineDirection?: "down" | "up";
  strokeWidth?: number;
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
  { id: "highlight", label: "Highlight", icon: PenLine },
  { id: "line", label: "Line", icon: Minus },
  { id: "arrow", label: "Arrow", icon: ArrowUpRight },
  { id: "text", label: "Text", icon: Type },
  { id: "clone", label: "Copy area", icon: Copy },
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

function getLineFromPoints(startX: number, startY: number, currentX: number, currentY: number, thickness: number) {
  const dx = currentX - startX;
  const dy = currentY - startY;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const minThickness = Math.max(2, thickness);

  if (absX >= absY * 2) {
    return {
      x: Math.min(startX, currentX),
      y: startY - minThickness / 2,
      width: Math.max(2, absX),
      height: minThickness,
      orientation: "horizontal" as const,
    };
  }

  if (absY >= absX * 2) {
    return {
      x: startX - minThickness / 2,
      y: Math.min(startY, currentY),
      width: minThickness,
      height: Math.max(2, absY),
      orientation: "vertical" as const,
    };
  }

  const side = Math.max(absX, absY);
  return {
    x: dx >= 0 ? startX : startX - side,
    y: dy >= 0 ? startY : startY - side,
    width: Math.max(2, side),
    height: Math.max(2, side),
    orientation: dy * dx >= 0 ? ("down" as const) : ("up" as const),
  };
}

function loadImageFromDataUrl(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = dataUrl;
  });
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("File could not be read."));
    };
    reader.onerror = () => reject(new Error("File could not be read."));
    reader.readAsDataURL(file);
  });
}

export function PdfEditor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
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
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [zoom, setZoom] = useState(1);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [history, setHistory] = useState<HistoryState>({ past: [], future: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [drawingState, setDrawingState] = useState<DrawingState | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [isDrawingSignature, setIsDrawingSignature] = useState(false);
  const [imageWidthValue, setImageWidthValue] = useState("");
  const [isEditingImageWidth, setIsEditingImageWidth] = useState(false);
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
  const isPlacing =
    tool === "box" ||
    tool === "highlight" ||
    tool === "line" ||
    tool === "arrow" ||
    tool === "text" ||
    tool === "clone";
  const showShapeControls =
    tool === "box" ||
    tool === "highlight" ||
    tool === "line" ||
    tool === "arrow" ||
    tool === "pick" ||
    selectedOverlay?.type === "box" ||
    selectedOverlay?.type === "highlight" ||
    selectedOverlay?.type === "line" ||
    selectedOverlay?.type === "arrow";
  const showTextControls = tool === "text" || selectedOverlay?.type === "text";
  const showImageControls = selectedOverlay?.type === "image";

  const selectTool = (nextTool: Tool) => {
    setTool(nextTool);
    if (nextTool === "line" || nextTool === "arrow") {
      setPickedColor("#111111");
    } else if (nextTool === "highlight") {
      setPickedColor("#ffe66d");
    }
  };

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

  const copyCanvasArea = (box: ReturnType<typeof getBoxFromPoints>) => {
    const canvas = canvasRef.current;
    if (!canvas || !pageInfo) return null;

    const sourceX = Math.round((box.x / pageInfo.width) * canvas.width);
    const sourceY = Math.round((box.y / pageInfo.height) * canvas.height);
    const sourceWidth = Math.max(1, Math.round((box.width / pageInfo.width) * canvas.width));
    const sourceHeight = Math.max(1, Math.round((box.height / pageInfo.height) * canvas.height));
    const copyCanvas = document.createElement("canvas");
    copyCanvas.width = sourceWidth;
    copyCanvas.height = sourceHeight;

    const copyContext = copyCanvas.getContext("2d");
    if (!copyContext) return null;

    copyContext.drawImage(
      canvas,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      sourceWidth,
      sourceHeight,
    );

    return copyCanvas.toDataURL("image/png");
  };

  const prepareSignatureImage = async (file: File) => {
    const dataUrl = await readFileAsDataUrl(file);
    const image = await loadImageFromDataUrl(dataUrl);
    const sourceCanvas = document.createElement("canvas");
    const maxSide = 1200;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    sourceCanvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    sourceCanvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
    if (!sourceContext) throw new Error("Could not scan the signature image.");

    sourceContext.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);
    const imageData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const pixels = imageData.data;
    let minX = sourceCanvas.width;
    let minY = sourceCanvas.height;
    let maxX = 0;
    let maxY = 0;
    let hasInk = false;

    for (let y = 0; y < sourceCanvas.height; y += 1) {
      for (let x = 0; x < sourceCanvas.width; x += 1) {
        const index = (y * sourceCanvas.width + x) * 4;
        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        const darkness = 255 - (red + green + blue) / 3;
        const alpha = Math.max(0, Math.min(255, (darkness - 28) * 4));

        pixels[index] = 17;
        pixels[index + 1] = 17;
        pixels[index + 2] = 17;
        pixels[index + 3] = alpha;

        if (alpha > 18) {
          hasInk = true;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (!hasInk) throw new Error("No signature ink was detected.");

    sourceContext.putImageData(imageData, 0, 0);
    const padding = 8;
    const cropX = Math.max(0, minX - padding);
    const cropY = Math.max(0, minY - padding);
    const cropRight = Math.min(sourceCanvas.width, maxX + padding);
    const cropBottom = Math.min(sourceCanvas.height, maxY + padding);
    const cropWidth = Math.max(1, cropRight - cropX);
    const cropHeight = Math.max(1, cropBottom - cropY);
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = cropWidth;
    outputCanvas.height = cropHeight;

    const outputContext = outputCanvas.getContext("2d");
    if (!outputContext) throw new Error("Could not crop the signature image.");
    outputContext.drawImage(sourceCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    return {
      dataUrl: outputCanvas.toDataURL("image/png"),
      width: cropWidth / scale,
      height: cropHeight / scale,
    };
  };

  const addSignatureOverlay = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !pageInfo) return;

    try {
      setStatus("Scanning signature and removing the paper background...");
      const signature = await prepareSignatureImage(file);
      const maxWidth = pageInfo.width * 0.35;
      const width = Math.max(80, Math.min(maxWidth, signature.width * 0.35));
      const height = Math.max(28, width * (signature.height / signature.width));
      const overlay: Overlay = {
        id: crypto.randomUUID(),
        page: pageNumber,
        type: "image",
        x: Math.max(0, (pageInfo.width - width) / 2),
        y: Math.max(0, (pageInfo.height - height) / 2),
        width,
        height,
        color: "#111111",
        imageData: signature.dataUrl,
        imageLabel: "Signature",
      };

      commitOverlays([...overlays, overlay]);
      setSelectedId(overlay.id);
      setEditingTextId(null);
      setTool("select");
      setStatus("Signature scanned. Drag the Move handle to place it.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not scan that signature image.");
    }
  };

  const getSignaturePoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const beginDrawSignature = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    if (!context) return;

    const point = getSignaturePoint(event);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 4;
    context.strokeStyle = "#111111";
    context.beginPath();
    context.moveTo(point.x, point.y);
    canvas.setPointerCapture(event.pointerId);
    setIsDrawingSignature(true);
  };

  const continueDrawSignature = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingSignature) return;

    const context = event.currentTarget.getContext("2d");
    if (!context) return;

    const point = getSignaturePoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const clearSignaturePad = () => {
    const canvas = signatureCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const addDrawnSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas || !pageInfo) return;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = 0;
    let maxY = 0;
    let hasInk = false;

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const alpha = pixels[(y * canvas.width + x) * 4 + 3];
        if (alpha > 0) {
          hasInk = true;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (!hasInk) {
      setStatus("Draw your signature first.");
      return;
    }

    const padding = 10;
    const cropX = Math.max(0, minX - padding);
    const cropY = Math.max(0, minY - padding);
    const cropRight = Math.min(canvas.width, maxX + padding);
    const cropBottom = Math.min(canvas.height, maxY + padding);
    const cropWidth = Math.max(1, cropRight - cropX);
    const cropHeight = Math.max(1, cropBottom - cropY);
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = cropWidth;
    outputCanvas.height = cropHeight;
    const outputContext = outputCanvas.getContext("2d");
    if (!outputContext) return;
    outputContext.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    const width = Math.min(pageInfo.width * 0.35, Math.max(120, cropWidth * 0.45));
    const height = Math.max(30, width * (cropHeight / cropWidth));
    const overlay: Overlay = {
      id: crypto.randomUUID(),
      page: pageNumber,
      type: "image",
      x: Math.max(0, (pageInfo.width - width) / 2),
      y: Math.max(0, (pageInfo.height - height) / 2),
      width,
      height,
      color: "#111111",
      imageData: outputCanvas.toDataURL("image/png"),
      imageLabel: "Signature",
    };

    commitOverlays([...overlays, overlay]);
    setSelectedId(overlay.id);
    setShowSignaturePad(false);
    setTool("select");
    setStatus("Drawn signature added. Drag the Move handle to place it.");
  };

  const handlePagePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!pdfDocProxy) return;
    setEditingTextId(null);
    if (tool === "pick") {
      pickCanvasColor(event);
      return;
    }
    if (tool === "box" || tool === "highlight" || tool === "line" || tool === "arrow") {
      const point = getPagePoint(event);
      setDrawingState({
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y,
      });
      setStatus(
        tool === "line"
          ? "Drag to draw a line."
          : tool === "arrow"
            ? "Drag to draw an arrow."
            : tool === "highlight"
              ? "Drag to highlight an area."
              : "Drag to draw a cover box.",
      );
      return;
    }
    if (tool === "clone") {
      const point = getPagePoint(event);
      setDrawingState({
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y,
      });
      setStatus("Drag around the area you want to copy.");
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

    const lineLength = Math.hypot(
      drawingState.currentX - drawingState.startX,
      drawingState.currentY - drawingState.startY,
    );
    const isLineShape = tool === "line" || tool === "arrow";
    if (isLineShape ? lineLength < 6 : box.width < 6 || box.height < 6) {
      setStatus(
        isLineShape
          ? `Drag on the page to draw ${tool === "arrow" ? "an arrow" : "a line"}.`
          : tool === "highlight"
            ? "Drag on the page to highlight an area."
            : "Drag on the page to draw a cover box.",
      );
      return;
    }

    const lineBox = getLineFromPoints(
      drawingState.startX,
      drawingState.startY,
      drawingState.currentX,
      drawingState.currentY,
      strokeWidth,
    );
    const activeBox = isLineShape ? lineBox : box;
    const baseOverlay = {
      id: crypto.randomUUID(),
      page: pageNumber,
      x: Math.max(0, Math.min(pageInfo.width - activeBox.width, activeBox.x)),
      y: Math.max(0, Math.min(pageInfo.height - activeBox.height, activeBox.y)),
      width: activeBox.width,
      height: activeBox.height,
    };

    const copiedImage = tool === "clone" ? copyCanvasArea(box) : null;
    if (tool === "clone" && !copiedImage) {
      setStatus("Could not copy that area. Try again after the page finishes rendering.");
      return;
    }

    const overlay: Overlay =
      isLineShape
        ? {
            ...baseOverlay,
            type: tool === "arrow" ? "arrow" : "line",
            color: pickedColor,
            lineDirection: lineBox.orientation === "up" ? "up" : "down",
            lineOrientation: lineBox.orientation,
            strokeWidth,
          }
        : tool === "highlight"
          ? {
              ...baseOverlay,
              type: "highlight",
              color: pickedColor,
            }
        : copiedImage
          ? {
              ...baseOverlay,
              type: "image",
              color: "#000000",
              imageData: copiedImage,
              imageLabel: "Copied area",
            }
          : {
              ...baseOverlay,
              type: "box",
              color: pickedColor,
            };

    commitOverlays([...overlays, overlay]);
    setSelectedId(overlay.id);
    setTool("select");
    setStatus(
      tool === "line"
        ? "Line added. Drag the Move handle or resize endpoints."
        : tool === "arrow"
          ? "Arrow added. Drag the Move handle or resize endpoints."
          : tool === "highlight"
            ? "Highlight added. Move or resize it as needed."
        : copiedImage
          ? "Area copied. Drag the Move handle to place it."
          : "Box added. The dashed outline is only visible in the editor.",
    );
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
      if (overlay.type === "box" || overlay.type === "highlight" || overlay.type === "line" || overlay.type === "arrow") {
        setPickedColor(overlay.color);
      }
      if (overlay.type === "line" || overlay.type === "arrow") {
        setStrokeWidth(overlay.strokeWidth || 3);
      }
      setStatus(`${overlay.type === "image" ? overlay.imageLabel || "Image" : overlay.type === "arrow" ? "Arrow" : overlay.type === "line" ? "Line" : overlay.type === "highlight" ? "Highlight" : "Box"} selected. Drag it, resize it, or delete it.`);
    }
  };

  const updateSelectedTextColor = (color: string) => {
    if (!isHexColor(color)) return;
    setTextColor(color);
    if (selectedId) {
      updateOverlay(selectedId, { color });
    }
  };

  const updateSelectedBoxColor = (color: string) => {
    if (!isHexColor(color)) return;
    setPickedColor(color);
    if (
      selectedOverlay?.type === "box" ||
      selectedOverlay?.type === "highlight" ||
      selectedOverlay?.type === "line" ||
      selectedOverlay?.type === "arrow"
    ) {
      updateOverlay(selectedOverlay.id, { color });
    }
  };

  const updateSelectedStrokeWidth = (value: number) => {
    const nextStrokeWidth = Math.max(1, Math.min(24, value));
    setStrokeWidth(nextStrokeWidth);
    if (selectedOverlay?.type === "line" || selectedOverlay?.type === "arrow") {
      updateOverlay(selectedOverlay.id, { strokeWidth: nextStrokeWidth });
    }
  };

  const updateSelectedImageWidth = (width: number) => {
    if (!selectedOverlay || selectedOverlay.type !== "image" || !pageInfo) return;

    const ratio = selectedOverlay.height / selectedOverlay.width || 0.35;
    const nextWidth = Math.max(24, Math.min(pageInfo.width, width));
    const nextHeight = Math.max(12, Math.min(pageInfo.height, nextWidth * ratio));
    const centerX = selectedOverlay.x + selectedOverlay.width / 2;
    const centerY = selectedOverlay.y + selectedOverlay.height / 2;

    updateOverlay(selectedOverlay.id, {
      width: nextWidth,
      height: nextHeight,
      x: Math.max(0, Math.min(pageInfo.width - nextWidth, centerX - nextWidth / 2)),
      y: Math.max(0, Math.min(pageInfo.height - nextHeight, centerY - nextHeight / 2)),
    });
  };

  const scaleSelectedImage = (scale: number) => {
    if (!selectedOverlay || selectedOverlay.type !== "image") return;
    recordHistory();
    updateSelectedImageWidth(selectedOverlay.width * scale);
  };

  const applyImageWidthInput = () => {
    if (!selectedOverlay || selectedOverlay.type !== "image") return;

    const nextWidth = Number(isEditingImageWidth ? imageWidthValue : Math.round(selectedOverlay.width));
    if (Number.isFinite(nextWidth)) {
      updateSelectedImageWidth(nextWidth);
    }
    setIsEditingImageWidth(false);
    setImageWidthValue("");
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
    setStatus(`${duplicate.type === "box" ? "Box" : duplicate.type === "highlight" ? "Highlight" : duplicate.type === "arrow" ? "Arrow" : duplicate.type === "line" ? "Line" : duplicate.type === "image" ? duplicate.imageLabel || "Image" : "Text"} duplicated.`);
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
        const x = overlay.x * scaleX;
        const y = pdfHeight - (overlay.y + overlay.height) * scaleY;

        if (overlay.type === "box") {
          const color = hexToRgb(overlay.color);
          page.drawRectangle({
            x,
            y,
            width: overlay.width * scaleX,
            height: overlay.height * scaleY,
            color: rgb(color.r, color.g, color.b),
            borderColor: rgb(color.r, color.g, color.b),
            borderWidth: 0,
          });
        } else if (overlay.type === "highlight") {
          const color = hexToRgb(overlay.color);
          page.drawRectangle({
            x,
            y,
            width: overlay.width * scaleX,
            height: overlay.height * scaleY,
            color: rgb(color.r, color.g, color.b),
            opacity: 0.38,
            borderWidth: 0,
          });
        } else if (overlay.type === "line" || overlay.type === "arrow") {
          const color = hexToRgb(overlay.color);
          const orientation = overlay.lineOrientation || overlay.lineDirection || "down";
          const start =
            orientation === "horizontal"
              ? { x, y: y + (overlay.height * scaleY) / 2 }
              : orientation === "vertical"
                ? { x: x + (overlay.width * scaleX) / 2, y }
                : {
                    x,
                    y: orientation === "up" ? y : y + overlay.height * scaleY,
                  };
          const end =
            orientation === "horizontal"
              ? { x: x + overlay.width * scaleX, y: y + (overlay.height * scaleY) / 2 }
              : orientation === "vertical"
                ? { x: x + (overlay.width * scaleX) / 2, y: y + overlay.height * scaleY }
                : {
                    x: x + overlay.width * scaleX,
                    y: orientation === "up" ? y + overlay.height * scaleY : y,
                  };
          const thickness = (overlay.strokeWidth || 3) * scaleY;
          page.drawLine({
            start,
            end,
            thickness,
            color: rgb(color.r, color.g, color.b),
          });
          if (overlay.type === "arrow") {
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            const headLength = Math.max(10, thickness * 5);
            const headAngle = Math.PI / 7;
            const left = {
              x: end.x - headLength * Math.cos(angle - headAngle),
              y: end.y - headLength * Math.sin(angle - headAngle),
            };
            const right = {
              x: end.x - headLength * Math.cos(angle + headAngle),
              y: end.y - headLength * Math.sin(angle + headAngle),
            };
            page.drawLine({ start: end, end: left, thickness, color: rgb(color.r, color.g, color.b) });
            page.drawLine({ start: end, end: right, thickness, color: rgb(color.r, color.g, color.b) });
          }
        } else if (overlay.text) {
          const color = hexToRgb(overlay.color);
          page.drawText(overlay.text, {
            x,
            y: y + overlay.height * scaleY * 0.2,
            size: (overlay.fontSize || 18) * scaleY,
            font,
            color: rgb(color.r, color.g, color.b),
            maxWidth: overlay.width * scaleX,
          });
        } else if (overlay.type === "image" && overlay.imageData) {
          const image = await output.embedPng(overlay.imageData);
          page.drawImage(image, {
            x,
            y,
            width: overlay.width * scaleX,
            height: overlay.height * scaleY,
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
                      onClick={() => selectTool(option.id)}
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
                    ? `${tool === "box" ? "Drag on the PDF to draw a cover box." : tool === "highlight" ? "Drag on the PDF to highlight an area." : tool === "line" ? "Drag on the PDF to draw a line." : tool === "arrow" ? "Drag on the PDF to draw an arrow." : tool === "clone" ? "Drag around an area to copy it." : "Click the PDF to place editable text."}`
                    : selectedOverlay
                      ? `${selectedOverlay.type === "box" ? "Box" : selectedOverlay.type === "highlight" ? "Highlight" : selectedOverlay.type === "arrow" ? "Arrow" : selectedOverlay.type === "line" ? "Line" : selectedOverlay.type === "image" ? selectedOverlay.imageLabel || "Image" : "Text"} selected.`
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

            <label
              className={`flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#ded8cc] bg-white text-sm font-medium ${
                pageInfo ? "cursor-pointer hover:bg-[#f5f3ef]" : "cursor-not-allowed opacity-40"
              }`}
              title="Scan signature image"
            >
              <ImagePlus size={17} />
              Scan signature
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                disabled={!pageInfo}
                onChange={addSignatureOverlay}
              />
            </label>

            <button
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#ded8cc] bg-white text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!pageInfo}
              type="button"
              onClick={() => {
                setShowSignaturePad(true);
                setStatus("Draw your signature, then add it to the PDF.");
              }}
            >
              <PenLine size={17} />
              Draw signature
            </button>

            {(showShapeControls || showTextControls || showImageControls) ? (
              <section className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-normal text-[#69635b]">Style</h2>
                {showShapeControls ? (
                  <label className="block text-sm font-medium">
                    {selectedOverlay?.type === "line" ||
                    selectedOverlay?.type === "arrow" ||
                    selectedOverlay?.type === "highlight" ||
                    tool === "line" ||
                    tool === "arrow" ||
                    tool === "highlight"
                      ? "Shape color"
                      : "Cover color"}
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        className="h-10 w-14 rounded-md border border-[#ded8cc] bg-white p-1"
                        type="color"
                        value={pickedColor}
                        onFocus={recordHistory}
                        onChange={(event) => updateSelectedBoxColor(event.target.value)}
                      />
                      <input
                        className="h-10 min-w-0 flex-1 rounded-md border border-[#ded8cc] bg-white px-3 font-mono text-sm"
                        value={pickedColor}
                        onFocus={recordHistory}
                        onChange={(event) => {
                          if (isHexColor(event.target.value)) {
                            updateSelectedBoxColor(event.target.value);
                          }
                        }}
                      />
                    </div>
                  </label>
                ) : null}

                {selectedOverlay?.type === "line" ||
                selectedOverlay?.type === "arrow" ||
                tool === "line" ||
                tool === "arrow" ? (
                  <label className="block text-sm font-medium">
                    Stroke thickness
                    <input
                      className="mt-2 h-10 w-full rounded-md border border-[#ded8cc] bg-white px-3 text-sm"
                      min={1}
                      max={24}
                      type="number"
                      value={strokeWidth}
                      onFocus={recordHistory}
                      onChange={(event) => updateSelectedStrokeWidth(Number(event.target.value))}
                    />
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

                {showImageControls ? (
                  <>
                    <div>
                      <div className="mb-2 text-sm font-medium">
                        {selectedOverlay?.imageLabel || "Image"} size
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          className="h-10 rounded-md border border-[#ded8cc] bg-white text-sm font-medium hover:bg-[#f5f3ef]"
                          type="button"
                          onClick={() => scaleSelectedImage(0.85)}
                        >
                          Smaller
                        </button>
                        <button
                          className="h-10 rounded-md border border-[#ded8cc] bg-white text-sm font-medium hover:bg-[#f5f3ef]"
                          type="button"
                          onClick={() => scaleSelectedImage(1.15)}
                        >
                          Larger
                        </button>
                      </div>
                    </div>

                    <label className="block text-sm font-medium">
                      Width
                      <input
                        className="mt-2 h-10 w-full rounded-md border border-[#ded8cc] bg-white px-3 text-sm"
                        min={24}
                        max={pageInfo?.width || 1000}
                        type="number"
                        value={
                          isEditingImageWidth
                            ? imageWidthValue
                            : String(Math.round(selectedOverlay?.width || 0))
                        }
                        onBlur={applyImageWidthInput}
                        onFocus={() => {
                          recordHistory();
                          setIsEditingImageWidth(true);
                          setImageWidthValue(String(Math.round(selectedOverlay?.width || 0)));
                        }}
                        onChange={(event) => setImageWidthValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
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
                          {overlay.type === "box" ? "Box" : overlay.type === "highlight" ? "Highlight" : overlay.type === "arrow" ? "Arrow" : overlay.type === "line" ? "Line" : overlay.type === "image" ? overlay.imageLabel || "Image" : overlay.text?.trim() || "Text"}
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
                    {tool === "box" ? "Drag to draw box" : tool === "highlight" ? "Drag to highlight" : tool === "line" ? "Drag to draw line" : tool === "arrow" ? "Drag to draw arrow" : tool === "clone" ? "Drag to copy area" : "Click to place text"}
                  </div>
                ) : null}
                {!previewMode && drawingState ? (
                  <div
                    className={`pointer-events-none absolute z-10 ${
                      tool === "line" || tool === "arrow" ? "" : "border-2 border-dashed border-[#146c63] bg-[#146c63]/15"
                    }`}
                    style={{
                      left:
                        (tool === "line" || tool === "arrow"
                          ? getLineFromPoints(
                              drawingState.startX,
                              drawingState.startY,
                              drawingState.currentX,
                              drawingState.currentY,
                              strokeWidth,
                            ).x
                          : getBoxFromPoints(
                              drawingState.startX,
                              drawingState.startY,
                              drawingState.currentX,
                              drawingState.currentY,
                            ).x) * zoom,
                      top:
                        (tool === "line" || tool === "arrow"
                          ? getLineFromPoints(
                              drawingState.startX,
                              drawingState.startY,
                              drawingState.currentX,
                              drawingState.currentY,
                              strokeWidth,
                            ).y
                          : getBoxFromPoints(
                              drawingState.startX,
                              drawingState.startY,
                              drawingState.currentX,
                              drawingState.currentY,
                            ).y) * zoom,
                      width:
                        (tool === "line" || tool === "arrow"
                          ? getLineFromPoints(
                              drawingState.startX,
                              drawingState.startY,
                              drawingState.currentX,
                              drawingState.currentY,
                              strokeWidth,
                            ).width
                          : getBoxFromPoints(
                              drawingState.startX,
                              drawingState.startY,
                              drawingState.currentX,
                              drawingState.currentY,
                            ).width) * zoom,
                      height:
                        (tool === "line" || tool === "arrow"
                          ? getLineFromPoints(
                              drawingState.startX,
                              drawingState.startY,
                              drawingState.currentX,
                              drawingState.currentY,
                              strokeWidth,
                            ).height
                          : getBoxFromPoints(
                              drawingState.startX,
                              drawingState.startY,
                              drawingState.currentX,
                              drawingState.currentY,
                            ).height) * zoom,
                    }}
                  >
                    {tool === "line" || tool === "arrow" ? (
                      <svg className="h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                        {tool === "arrow" ? (
                          <defs>
                            <marker id="preview-arrowhead" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
                              <path d="M0,0 L8,4 L0,8 Z" fill="#146c63" />
                            </marker>
                          </defs>
                        ) : null}
                        {(() => {
                          const previewLine = getLineFromPoints(
                            drawingState.startX,
                            drawingState.startY,
                            drawingState.currentX,
                            drawingState.currentY,
                            strokeWidth,
                          );
                          return (
                            <line
                              stroke="#146c63"
                              markerEnd={tool === "arrow" ? "url(#preview-arrowhead)" : undefined}
                              strokeLinecap="round"
                              strokeWidth={Math.max(1, ((strokeWidth || 3) / Math.max(previewLine.width, previewLine.height)) * 100)}
                              x1={previewLine.orientation === "vertical" ? "50" : "0"}
                              x2={previewLine.orientation === "vertical" ? "50" : "100"}
                              y1={previewLine.orientation === "horizontal" ? "50" : previewLine.orientation === "up" ? "100" : "0"}
                              y2={previewLine.orientation === "horizontal" ? "50" : previewLine.orientation === "up" ? "0" : "100"}
                            />
                          );
                        })()}
                      </svg>
                    ) : null}
                  </div>
                ) : null}
                {currentOverlays.map((overlay) => (
                  <div
                    key={overlay.id}
                    className={`absolute touch-none ${
                      previewMode
                        ? "outline outline-1 outline-transparent"
                        : selectedId === overlay.id
                        ? "outline outline-2 outline-[#146c63]"
                        : overlay.type === "box" ||
                            overlay.type === "highlight" ||
                            overlay.type === "line" ||
                            overlay.type === "arrow" ||
                            overlay.type === "image"
                          ? "outline outline-1 outline-transparent hover:outline-[#146c63]/35"
                          : "outline outline-1 outline-transparent"
                    }`}
                    style={{
                      left: overlay.x * zoom,
                      top: overlay.y * zoom,
                      width: overlay.width * zoom,
                      height: overlay.height * zoom,
                      background:
                        overlay.type === "box"
                          ? overlay.color
                          : "transparent",
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
                    {overlay.type === "highlight" ? (
                      <div className="h-full w-full" style={{ background: overlay.color, opacity: 0.38 }} />
                    ) : overlay.type === "line" || overlay.type === "arrow" ? (
                      <svg className="h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                        {overlay.type === "arrow" ? (
                          <defs>
                            <marker
                              id={`arrowhead-${overlay.id}`}
                              markerHeight="8"
                              markerWidth="8"
                              orient="auto"
                              refX="7"
                              refY="4"
                            >
                              <path d="M0,0 L8,4 L0,8 Z" fill={overlay.color} />
                            </marker>
                          </defs>
                        ) : null}
                        <line
                          markerEnd={overlay.type === "arrow" ? `url(#arrowhead-${overlay.id})` : undefined}
                          stroke={overlay.color}
                          strokeLinecap="round"
                          strokeWidth={Math.max(1, ((overlay.strokeWidth || 3) / Math.max(overlay.width, overlay.height)) * 100)}
                          x1={overlay.lineOrientation === "vertical" ? "50" : "0"}
                          x2={overlay.lineOrientation === "vertical" ? "50" : "100"}
                          y1={overlay.lineOrientation === "horizontal" ? "50" : overlay.lineOrientation === "up" ? "100" : "0"}
                          y2={overlay.lineOrientation === "horizontal" ? "50" : overlay.lineOrientation === "up" ? "0" : "100"}
                        />
                      </svg>
                    ) : overlay.type === "text" ? (
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
                    ) : overlay.type === "image" && overlay.imageData ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt=""
                        className="h-full w-full select-none object-fill"
                        draggable={false}
                        src={overlay.imageData}
                      />
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
      {showSignaturePad ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-2xl rounded-md border border-[#ded8cc] bg-[#fffdfa] p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Draw signature</h2>
                <p className="text-sm text-[#69635b]">Use your mouse, trackpad, or touch screen.</p>
              </div>
              <button
                className="flex h-9 w-9 items-center justify-center rounded-md border border-[#ded8cc] bg-white hover:bg-[#f5f3ef]"
                type="button"
                onClick={() => setShowSignaturePad(false)}
                title="Close"
              >
                <X size={17} />
              </button>
            </div>
            <canvas
              ref={signatureCanvasRef}
              className="h-56 w-full touch-none rounded-md border border-[#ded8cc] bg-white"
              height={220}
              width={720}
              onPointerDown={beginDrawSignature}
              onPointerMove={continueDrawSignature}
              onPointerUp={() => setIsDrawingSignature(false)}
              onPointerLeave={() => setIsDrawingSignature(false)}
            />
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button
                className="h-10 rounded-md border border-[#ded8cc] bg-white px-4 text-sm font-medium hover:bg-[#f5f3ef]"
                type="button"
                onClick={clearSignaturePad}
              >
                Clear
              </button>
              <button
                className="h-10 rounded-md bg-[#146c63] px-4 text-sm font-medium text-white hover:bg-[#0f5e56]"
                type="button"
                onClick={addDrawnSignature}
              >
                Add signature
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
