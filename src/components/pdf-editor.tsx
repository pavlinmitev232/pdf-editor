"use client";

import { ChangeEvent, DragEvent, KeyboardEvent as ReactKeyboardEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
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

type Tool = "select" | "pick" | "box" | "highlight" | "line" | "arrow" | "text" | "clone" | "section";

type SectionTemplateId = "skills" | "education" | "experience" | "projects" | "certifications" | "custom";

type SectionTemplate = {
  id: SectionTemplateId;
  label: string;
  title: string;
  body: string;
  titleColor: string;
  bodyColor: string;
  accentColor: string;
};

type Overlay = {
  id: string;
  page: number;
  type: "box" | "highlight" | "line" | "arrow" | "text" | "image" | "section";
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
  sectionTitle?: string;
  sectionBody?: string;
  sectionTemplate?: SectionTemplateId;
  sectionTitleColor?: string;
  sectionBodyColor?: string;
  sectionAccentColor?: string;
  titleSize?: number;
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

type SectionPlacement = {
  x: number;
  y: number;
  width: number;
  column: "left" | "right" | "full";
};

type PdfTextItem = {
  str: string;
  transform: number[];
  width?: number;
  height?: number;
};

type PdfTextContent = {
  items: PdfTextItem[];
};

type PdfPageProxy = {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  getTextContent: () => Promise<PdfTextContent>;
  render: (options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void>; cancel: () => void };
};

type PdfDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
};

type ResumeSectionKind =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "languages"
  | "custom";

type ResumeSection = {
  id: string;
  kind: ResumeSectionKind;
  title: string;
  items: string[];
};

type ResumeDraft = {
  name: string;
  headline: string;
  contact: string[];
  summary: string;
  sections: ResumeSection[];
  confidence: number;
  source: string;
};

type ResumeLine = {
  text: string;
  page: number;
  x: number;
  y: number;
  fontSize: number;
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
  { id: "section", label: "Section", icon: List },
];

const sectionTemplates: SectionTemplate[] = [
  {
    id: "skills",
    label: "Skills",
    title: "SKILLS",
    body: "- Skill one\n- Skill two\n- Skill three",
    titleColor: "#0f3d3e",
    bodyColor: "#242424",
    accentColor: "#17a398",
  },
  {
    id: "education",
    label: "Education",
    title: "EDUCATION",
    body: "Degree or certificate\nSchool name - Year\nKey course, award, or focus",
    titleColor: "#1d3557",
    bodyColor: "#2b2b2b",
    accentColor: "#3a86ff",
  },
  {
    id: "experience",
    label: "Experience",
    title: "EXPERIENCE",
    body: "Role title - Company\n- Achievement or responsibility\n- Achievement or responsibility",
    titleColor: "#2a2a2a",
    bodyColor: "#303030",
    accentColor: "#146c63",
  },
  {
    id: "projects",
    label: "Projects",
    title: "PROJECTS",
    body: "Project name\n- What you built or improved\n- Tools, result, or link",
    titleColor: "#213547",
    bodyColor: "#2f2f2f",
    accentColor: "#ff8a00",
  },
  {
    id: "certifications",
    label: "Certifications",
    title: "CERTIFICATIONS",
    body: "Certification name - Issuer\nCertification name - Issuer",
    titleColor: "#243b53",
    bodyColor: "#2d3748",
    accentColor: "#8a4fff",
  },
  {
    id: "custom",
    label: "Blank",
    title: "NEW SECTION",
    body: "Add details here",
    titleColor: "#111111",
    bodyColor: "#333333",
    accentColor: "#146c63",
  },
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

function getSectionPlacement(point: { x: number; y: number }, pageInfo: PageInfo): SectionPlacement {
  const margin = Math.max(28, pageInfo.width * 0.055);
  const gutter = Math.max(22, pageInfo.width * 0.035);
  const twoColumnWidth = Math.max(120, (pageInfo.width - margin * 2 - gutter) / 2);
  const fullWidth = Math.max(160, pageInfo.width - margin * 2);
  const y = margin;

  if (point.x < pageInfo.width * 0.43) {
    return { x: margin, y, width: twoColumnWidth, column: "left" };
  }

  if (point.x > pageInfo.width * 0.57) {
    return { x: margin + twoColumnWidth + gutter, y, width: twoColumnWidth, column: "right" };
  }

  return { x: margin, y, width: fullWidth, column: "full" };
}

function getOverlayLabel(overlay: Overlay) {
  if (overlay.type === "box") return "Box";
  if (overlay.type === "highlight") return "Highlight";
  if (overlay.type === "arrow") return "Arrow";
  if (overlay.type === "line") return "Line";
  if (overlay.type === "image") return overlay.imageLabel || "Image";
  if (overlay.type === "section") return overlay.sectionTitle?.trim() || "Section";
  return overlay.text?.trim() || "Text";
}

function getSectionLines(body = "") {
  return body
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
}

function isBulletSection(overlay: Overlay) {
  return (
    overlay.sectionTemplate === "skills" ||
    overlay.sectionTemplate === "experience" ||
    overlay.sectionTemplate === "projects" ||
    getSectionLines(overlay.sectionBody).some((line) => line.trimStart().startsWith("- "))
  );
}

function normalizeHeading(value: string) {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function getResumeSectionKind(text: string): ResumeSectionKind | null {
  const heading = normalizeHeading(text);
  if (["summary", "profile", "objective", "aboutme"].includes(heading)) return "summary";
  if (["experience", "workexperience", "employment", "employmenthistory", "professionalexperience"].includes(heading)) return "experience";
  if (["education", "academicbackground"].includes(heading)) return "education";
  if (["skills", "technicalskills", "skillstools", "skillsandtools"].includes(heading)) return "skills";
  if (["projects", "personalprojects"].includes(heading)) return "projects";
  if (["certifications", "certificates", "licenses"].includes(heading)) return "certifications";
  if (["languages"].includes(heading)) return "languages";
  return null;
}

function isLikelyContactLine(text: string) {
  return /@|(\+?\d[\d\s().-]{6,})|linkedin|github|portfolio|www\.|https?:\/\//i.test(text);
}

function cleanResumeItem(text: string) {
  return text.replace(/^[\s\-\u2022*]+/, "").replace(/\s+/g, " ").trim();
}

function splitSkillItems(items: string[]) {
  return items
    .flatMap((item) => item.split(/[,|;]+/))
    .map(cleanResumeItem)
    .filter(Boolean);
}

function buildResumeDraft(lines: ResumeLine[], source: string): ResumeDraft {
  const orderedLines = lines
    .map((line) => ({ ...line, text: line.text.trim() }))
    .filter((line) => line.text.length > 1)
    .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
  const topLines = orderedLines.slice(0, 10);
  const contact = topLines
    .filter((line) => isLikelyContactLine(line.text))
    .map((line) => line.text)
    .slice(0, 4);
  const nameLine =
    topLines.find((line) => !isLikelyContactLine(line.text) && line.text.length <= 48 && line.fontSize >= Math.max(...topLines.map((item) => item.fontSize)) - 2) ||
    topLines.find((line) => !isLikelyContactLine(line.text));
  const name = nameLine?.text || "Your Name";
  const headline =
    topLines.find((line) => line.text !== name && !isLikelyContactLine(line.text) && !getResumeSectionKind(line.text))?.text ||
    "Professional headline";
  const sections: ResumeSection[] = [];
  let current: ResumeSection | null = null;
  const looseSummary: string[] = [];

  for (const line of orderedLines) {
    if (line.text === name || line.text === headline || contact.includes(line.text)) continue;
    const kind = getResumeSectionKind(line.text);
    const looksLikeHeading = kind && line.text.length <= 32;

    if (looksLikeHeading) {
      current = {
        id: crypto.randomUUID(),
        kind,
        title: line.text.toUpperCase(),
        items: [],
      };
      sections.push(current);
      continue;
    }

    const item = cleanResumeItem(line.text);
    if (!item) continue;

    if (current) {
      current.items.push(item);
    } else if (!isLikelyContactLine(item) && looseSummary.length < 4) {
      looseSummary.push(item);
    }
  }

  for (const section of sections) {
    if (section.kind === "skills") {
      section.items = splitSkillItems(section.items).slice(0, 28);
    } else {
      section.items = section.items.slice(0, 14);
    }
  }

  const summarySection = sections.find((section) => section.kind === "summary");
  const summary = summarySection?.items.join(" ") || looseSummary.join(" ") || "Add a short professional summary.";
  const visibleSections = sections.filter((section) => section.kind !== "summary" && section.items.length);
  const confidence = Math.min(96, Math.max(42, 46 + visibleSections.length * 9 + contact.length * 3 + (summary.length > 40 ? 8 : 0)));

  return {
    name,
    headline,
    contact,
    summary,
    sections: visibleSections.length
      ? visibleSections
      : [
          {
            id: crypto.randomUUID(),
            kind: "experience",
            title: "EXPERIENCE",
            items: ["Add your recent role, company, and strongest achievements."],
          },
          {
            id: crypto.randomUUID(),
            kind: "skills",
            title: "SKILLS",
            items: ["Communication", "Leadership", "Problem solving"],
          },
        ],
    confidence,
    source,
  };
}

function wrapPdfText(text: string, maxChars: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
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
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [isDrawingSignature, setIsDrawingSignature] = useState(false);
  const [imageWidthValue, setImageWidthValue] = useState("");
  const [isEditingImageWidth, setIsEditingImageWidth] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [fitAfterRender, setFitAfterRender] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [toolsCollapsed, setToolsCollapsed] = useState(false);
  const [sectionHover, setSectionHover] = useState<SectionPlacement | null>(null);
  const [sectionMenu, setSectionMenu] = useState<SectionPlacement | null>(null);
  const [showResumeRebuild, setShowResumeRebuild] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<ResumeDraft | null>(null);
  const [resumeStatus, setResumeStatus] = useState("Import a text-based resume PDF to rebuild it into editable sections.");
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [isExportingResume, setIsExportingResume] = useState(false);
  const [resumeAccent, setResumeAccent] = useState("#146c63");
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
    tool === "clone" ||
    tool === "section";
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
  const showSectionControls = selectedOverlay?.type === "section";

  const selectTool = (nextTool: Tool) => {
    setTool(nextTool);
    setSectionMenu(null);
    setSectionHover(null);
    if (nextTool === "line" || nextTool === "arrow") {
      setPickedColor("#111111");
    } else if (nextTool === "highlight") {
      setPickedColor("#ffe66d");
    } else if (nextTool === "section") {
      setStatus("Section tool active. Move near the end of a column or section to add the next block.");
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
      setEditingSectionId(null);
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
      setEditingSectionId(null);
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
    setEditingSectionId(null);
    setSectionHover(null);
    setSectionMenu(null);
    setPreviewMode(false);
    setResumeDraft(null);
    setResumeStatus("PDF loaded. Run Rebuild Resume to extract editable sections.");
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

  const getContentEndPlacement = (point: { x: number; y: number }) => {
    if (!pageInfo) return null;

    const base = getSectionPlacement(point, pageInfo);
    const margin = Math.max(28, pageInfo.width * 0.055);
    const sectionHeight = 132;
    const canvas = canvasRef.current;
    const contentRows: Array<{ top: number; bottom: number; source: "pdf" | "overlay" }> = [];

    if (canvas) {
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context) {
        const scaleX = canvas.width / pageInfo.width;
        const scaleY = canvas.height / pageInfo.height;
        const startX = Math.max(0, Math.floor(base.x * scaleX));
        const endX = Math.min(canvas.width - 1, Math.ceil((base.x + base.width) * scaleX));
        const startY = Math.max(0, Math.floor(margin * scaleY));
        const endY = Math.min(canvas.height - 1, Math.ceil((pageInfo.height - margin) * scaleY));
        const stepX = Math.max(2, Math.floor((endX - startX) / 140));
        const stepY = Math.max(2, Math.floor(canvas.height / 340));
        let runStart: number | null = null;
        let lastInkY: number | null = null;

        try {
          for (let y = startY; y <= endY; y += stepY) {
            const bandHeight = Math.min(5, endY - y + 1);
            const row = context.getImageData(startX, y, Math.max(1, endX - startX), bandHeight).data;
            let inkHits = 0;

            for (let x = 0; x < row.length; x += stepX * 4) {
              const red = row[x];
              const green = row[x + 1];
              const blue = row[x + 2];
              const alpha = row[x + 3];
              const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
              if (alpha > 20 && luminance < 222) {
                inkHits += 1;
                if (inkHits >= 3) break;
              }
            }

            if (inkHits >= 3) {
              runStart ??= y;
              lastInkY = y + bandHeight;
            } else if (runStart !== null && lastInkY !== null && y - lastInkY > stepY * 3) {
              contentRows.push({
                top: Math.max(margin, runStart / scaleY),
                bottom: Math.min(pageInfo.height - margin, lastInkY / scaleY),
                source: "pdf",
              });
              runStart = null;
              lastInkY = null;
            }
          }

          if (runStart !== null && lastInkY !== null) {
            contentRows.push({
              top: Math.max(margin, runStart / scaleY),
              bottom: Math.min(pageInfo.height - margin, lastInkY / scaleY),
              source: "pdf",
            });
          }
        } catch {
          contentRows.length = 0;
        }
      }
    }

    for (const overlay of currentOverlays) {
      const overlapsColumn = overlay.x < base.x + base.width && overlay.x + overlay.width > base.x;
      if (overlapsColumn) {
        contentRows.push({
          top: overlay.y,
          bottom: overlay.y + overlay.height,
          source: "overlay",
        });
      }
    }

    const mergedRows = contentRows
      .filter((row) => row.bottom > margin && row.top < pageInfo.height - margin)
      .sort((a, b) => a.top - b.top)
      .reduce<Array<{ top: number; bottom: number; source: "pdf" | "overlay" }>>((rows, row) => {
        const previous = rows.at(-1);
        if (previous && row.top <= previous.bottom + 8) {
          previous.bottom = Math.max(previous.bottom, row.bottom);
          previous.source = previous.source === "overlay" || row.source === "overlay" ? "overlay" : "pdf";
          return rows;
        }
        rows.push({ ...row });
        return rows;
      }, []);

    const contentBlocks = mergedRows.reduce<Array<{ top: number; bottom: number; source: "pdf" | "overlay" }>>(
      (blocks, row) => {
        const previous = blocks.at(-1);
        const blockGap = previous?.source === "overlay" || row.source === "overlay" ? 20 : 16;
        if (previous && row.top <= previous.bottom + blockGap) {
          previous.bottom = Math.max(previous.bottom, row.bottom);
          previous.source = previous.source === "overlay" || row.source === "overlay" ? "overlay" : "pdf";
          return blocks;
        }
        blocks.push({ ...row });
        return blocks;
      },
      [],
    );

    const pointedBlock =
      contentBlocks
        .map((block) => ({
          block,
          distance:
            point.y >= block.bottom - 34 && point.y <= block.bottom + 92
              ? 0
              : Math.abs(point.y - block.bottom),
        }))
        .filter((item) => item.distance <= 92)
        .sort((a, b) => a.distance - b.distance || b.block.bottom - a.block.bottom)[0]?.block || null;
    const lastBlock = contentBlocks.at(-1) || null;
    const targetBlock = pointedBlock || (lastBlock && point.y >= lastBlock.bottom - 72 ? lastBlock : null);

    if (!targetBlock) return null;

    const contentBottom = Math.max(margin, targetBlock.bottom);
    const suggestedY = Math.max(margin, Math.min(pageInfo.height - sectionHeight - margin, contentBottom + 18));
    const isNearInsertionPoint =
      point.y >= Math.max(margin, targetBlock.bottom - 42) &&
      point.y <= Math.min(pageInfo.height - margin, targetBlock.bottom + 110);
    if (!isNearInsertionPoint) return null;

    return {
      ...base,
      y: suggestedY,
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
    setEditingSectionId(null);
    setTool("select");
    setTextValue("");
    setStatus("Text added. Edit it directly on the page, or drag the handle to move it.");
  };

  const addSectionOverlay = (template: SectionTemplate, placement: SectionPlacement) => {
    if (!pageInfo) return;

    const height = Math.min(170, Math.max(118, pageInfo.height - placement.y - 28));
    const overlay: Overlay = {
      id: crypto.randomUUID(),
      page: pageNumber,
      type: "section",
      x: Math.max(0, Math.min(pageInfo.width - placement.width, placement.x)),
      y: Math.max(0, Math.min(pageInfo.height - height, placement.y)),
      width: placement.width,
      height,
      color: template.titleColor,
      fontSize: 10,
      titleSize: 12,
      sectionTitle: template.title,
      sectionBody: template.body,
      sectionTemplate: template.id,
      sectionTitleColor: template.titleColor,
      sectionBodyColor: template.bodyColor,
      sectionAccentColor: template.accentColor,
    };

    commitOverlays([...overlays, overlay]);
    setSelectedId(overlay.id);
    setEditingSectionId(overlay.id);
    setTextColor(overlay.color);
    setFontSize(overlay.fontSize || 10);
    setTool("select");
    setSectionMenu(null);
    setSectionHover(null);
    setStatus(`${template.label} section added. Edit the fields in the sidebar, then drag or resize it on the page.`);
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
      setEditingSectionId(null);
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
    setEditingSectionId(null);
    setShowSignaturePad(false);
    setTool("select");
    setStatus("Drawn signature added. Drag the Move handle to place it.");
  };

  const handlePagePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!pdfDocProxy) return;
    setEditingTextId(null);
    setEditingSectionId(null);
    setSectionMenu(null);
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
    if (tool === "section" && pageInfo) {
      const placement = getContentEndPlacement(getPagePoint(event));
      if (!placement) {
        setSectionHover(null);
        setStatus("Move near the end of the current column or section to add a new section.");
        return;
      }
      setSectionHover(placement);
      setSectionMenu(placement);
      setSelectedId(null);
      setStatus("Choose a section template to add it here.");
      return;
    }
    setSelectedId(null);
    setEditingTextId(null);
    setEditingSectionId(null);
  };

  const handlePagePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (tool === "section" && !drawingState && pageInfo && !sectionMenu) {
      setSectionHover(getContentEndPlacement(getPagePoint(event)));
      return;
    }

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
    setEditingSectionId(null);
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
    setEditingSectionId(null);
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
    setEditingSectionId(overlay.type === "section" ? overlay.id : null);
    if (overlay.type === "text") {
      setTextValue(overlay.text || "");
      setTextColor(overlay.color);
      setFontSize(overlay.fontSize || 18);
      setStatus("Text selected. Type on the page, or drag the Move handle to reposition it.");
    } else if (overlay.type === "section") {
      setTextColor(overlay.color);
      setFontSize(overlay.fontSize || 10);
      setStatus("Section selected. Edit the title and content in the sidebar, or move it on the page.");
    } else {
      if (overlay.type === "box" || overlay.type === "highlight" || overlay.type === "line" || overlay.type === "arrow") {
        setPickedColor(overlay.color);
      }
      if (overlay.type === "line" || overlay.type === "arrow") {
        setStrokeWidth(overlay.strokeWidth || 3);
      }
      setStatus(`${getOverlayLabel(overlay)} selected. Drag it, resize it, or delete it.`);
    }
  };

  const updateSelectedTextColor = (color: string) => {
    if (!isHexColor(color)) return;
    setTextColor(color);
    if (selectedId) {
      updateOverlay(selectedId, { color });
    }
  };

  const updateSelectedSectionColor = (
    field: "sectionTitleColor" | "sectionBodyColor" | "sectionAccentColor",
    color: string,
  ) => {
    if (!isHexColor(color) || selectedOverlay?.type !== "section") return;
    if (field === "sectionTitleColor") {
      setTextColor(color);
      updateOverlay(selectedOverlay.id, { color, sectionTitleColor: color });
      return;
    }
    updateOverlay(selectedOverlay.id, { [field]: color });
  };

  const updateSectionBody = (overlay: Overlay, value: string) => {
    updateOverlay(overlay.id, { sectionBody: value });
  };

  const continueSectionRow = (event: ReactKeyboardEvent<HTMLTextAreaElement>, overlay: Overlay) => {
    if (event.key !== "Enter" || event.shiftKey || !isBulletSection(overlay)) return;

    event.preventDefault();
    const target = event.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const value = target.value;
    const nextValue = `${value.slice(0, start)}\n- ${value.slice(end)}`;
    updateSectionBody(overlay, nextValue);

    window.requestAnimationFrame(() => {
      target.selectionStart = start + 3;
      target.selectionEnd = start + 3;
    });
  };

  const extractResumeDraft = async () => {
    if (!pdfDocProxy) {
      setResumeStatus("Upload a resume PDF first.");
      return;
    }

    setIsParsingResume(true);
    setResumeStatus("Reading text and layout from the PDF...");

    try {
      const lines: ResumeLine[] = [];

      for (let pageIndex = 1; pageIndex <= pdfDocProxy.numPages; pageIndex += 1) {
        const page = await pdfDocProxy.getPage(pageIndex);
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();
        const rowMap = new Map<string, ResumeLine[]>();

        for (const item of textContent.items) {
          const text = item.str.trim();
          if (!text) continue;
          const [, , , scaleY, x, rawY] = item.transform;
          const y = viewport.height - rawY;
          const fontSizeEstimate = Math.max(7, Math.min(32, Math.abs(scaleY) || item.height || 10));
          const key = `${pageIndex}-${Math.round(y / 4) * 4}`;
          const line: ResumeLine = {
            text,
            page: pageIndex,
            x,
            y,
            fontSize: fontSizeEstimate,
          };
          rowMap.set(key, [...(rowMap.get(key) || []), line]);
        }

        for (const row of rowMap.values()) {
          const ordered = row.sort((a, b) => a.x - b.x);
          lines.push({
            text: ordered.map((item) => item.text).join(" ").replace(/\s+/g, " ").trim(),
            page: pageIndex,
            x: Math.min(...ordered.map((item) => item.x)),
            y: ordered.reduce((sum, item) => sum + item.y, 0) / ordered.length,
            fontSize: Math.max(...ordered.map((item) => item.fontSize)),
          });
        }
      }

      if (lines.length < 6) {
        setResumeStatus("I could not find enough selectable text. OCR fallback is next for scanned PDFs.");
        return;
      }

      const draft = buildResumeDraft(lines, fileName.replace(/-edited\.pdf$/i, ".pdf"));
      setResumeDraft(draft);
      setResumeStatus(`Rebuilt ${draft.sections.length} editable sections with ${draft.confidence}% confidence.`);
    } catch (error) {
      console.error(error);
      setResumeStatus("Could not rebuild this resume yet. Try another text-based PDF.");
    } finally {
      setIsParsingResume(false);
    }
  };

  const updateResumeDraft = (changes: Partial<ResumeDraft>) => {
    setResumeDraft((draft) => (draft ? { ...draft, ...changes } : draft));
  };

  const updateResumeSection = (id: string, changes: Partial<ResumeSection>) => {
    setResumeDraft((draft) =>
      draft
        ? {
            ...draft,
            sections: draft.sections.map((section) => (section.id === id ? { ...section, ...changes } : section)),
          }
        : draft,
    );
  };

  const addResumeSection = () => {
    setResumeDraft((draft) =>
      draft
        ? {
            ...draft,
            sections: [
              ...draft.sections,
              {
                id: crypto.randomUUID(),
                kind: "custom",
                title: "CUSTOM SECTION",
                items: ["Add a new achievement or detail."],
              },
            ],
          }
        : draft,
    );
  };

  const removeResumeSection = (id: string) => {
    setResumeDraft((draft) =>
      draft
        ? {
            ...draft,
            sections: draft.sections.filter((section) => section.id !== id),
          }
        : draft,
    );
  };

  const exportResumeDraft = async () => {
    if (!resumeDraft) return;

    setIsExportingResume(true);
    setResumeStatus("Designing your rebuilt resume PDF...");

    try {
      const output = await PDFDocument.create();
      let page = output.addPage([595.28, 841.89]);
      const font = await output.embedFont(StandardFonts.Helvetica);
      const boldFont = await output.embedFont(StandardFonts.HelveticaBold);
      const accent = hexToRgb(resumeAccent);
      const ink = rgb(0.13, 0.12, 0.1);
      const muted = rgb(0.39, 0.37, 0.33);
      const margin = 48;
      const contentWidth = 595.28 - margin * 2;
      let cursorY = 790;

      const ensureSpace = (needed: number) => {
        if (cursorY - needed > 54) return;
        page = output.addPage([595.28, 841.89]);
        cursorY = 790;
      };

      const drawWrapped = (text: string, x: number, y: number, size: number, maxChars: number, color = ink) => {
        const lines = wrapPdfText(text, maxChars);
        lines.forEach((line, index) => {
          page.drawText(line, {
            x,
            y: y - index * size * 1.35,
            size,
            font,
            color,
          });
        });
        return lines.length * size * 1.35;
      };

      page.drawText(resumeDraft.name || "Your Name", {
        x: margin,
        y: cursorY,
        size: 27,
        font: boldFont,
        color: ink,
      });
      cursorY -= 25;
      page.drawText(resumeDraft.headline || "Professional headline", {
        x: margin,
        y: cursorY,
        size: 11,
        font,
        color: rgb(accent.r, accent.g, accent.b),
      });
      cursorY -= 18;
      if (resumeDraft.contact.length) {
        drawWrapped(resumeDraft.contact.join("  |  "), margin, cursorY, 8.5, 95, muted);
        cursorY -= 20;
      }
      page.drawLine({
        start: { x: margin, y: cursorY },
        end: { x: margin + contentWidth, y: cursorY },
        thickness: 1.5,
        color: rgb(accent.r, accent.g, accent.b),
      });
      cursorY -= 22;

      if (resumeDraft.summary) {
        ensureSpace(70);
        page.drawText("SUMMARY", { x: margin, y: cursorY, size: 10, font: boldFont, color: rgb(accent.r, accent.g, accent.b) });
        cursorY -= 15;
        cursorY -= drawWrapped(resumeDraft.summary, margin, cursorY, 9.5, 105, ink) + 10;
      }

      for (const section of resumeDraft.sections) {
        ensureSpace(80);
        page.drawText(section.title || "SECTION", {
          x: margin,
          y: cursorY,
          size: 10,
          font: boldFont,
          color: rgb(accent.r, accent.g, accent.b),
        });
        cursorY -= 14;
        for (const item of section.items.filter(Boolean)) {
          ensureSpace(38);
          page.drawText("-", { x: margin, y: cursorY, size: 9.5, font, color: rgb(accent.r, accent.g, accent.b) });
          const used = drawWrapped(item, margin + 12, cursorY, 9.5, 96, ink);
          cursorY -= Math.max(14, used) + 2;
        }
        cursorY -= 8;
      }

      const bytes = await output.save();
      const pdfArrayBuffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(pdfArrayBuffer).set(bytes);
      const blob = new Blob([pdfArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${(resumeDraft.name || "rebuilt-resume").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-resume.pdf`;
      link.rel = "noopener";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      window.setTimeout(() => {
        link.remove();
        URL.revokeObjectURL(url);
      }, 1_000);
      setResumeStatus("Rebuilt resume exported.");
    } catch (error) {
      console.error(error);
      setResumeStatus("Could not export the rebuilt resume.");
    } finally {
      setIsExportingResume(false);
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
    const nextWidth = Math.max(1, Math.min(pageInfo.width, width));
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

  const updateImageWidthFromInput = (value: string) => {
    if (!selectedOverlay || selectedOverlay.type !== "image") return;

    setImageWidthValue(value);
    const nextWidth = Number(value);
    if (Number.isFinite(nextWidth) && nextWidth > 0) {
      updateSelectedImageWidth(nextWidth);
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
    setEditingSectionId(duplicate.type === "section" ? duplicate.id : null);
    setStatus(`${getOverlayLabel(duplicate)} duplicated.`);
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
        setEditingSectionId(null);
        setSectionHover(null);
        setSectionMenu(null);
        setPreviewMode(false);
        setToolsCollapsed(false);
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
      const boldFont = await output.embedFont(StandardFonts.HelveticaBold);

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
        } else if (overlay.type === "section") {
          const titleColor = hexToRgb(overlay.sectionTitleColor || overlay.color);
          const bodyColor = hexToRgb(overlay.sectionBodyColor || overlay.color);
          const accentColor = hexToRgb(overlay.sectionAccentColor || overlay.color);
          const titleSize = (overlay.titleSize || 12) * scaleY;
          const bodySize = (overlay.fontSize || 10) * scaleY;
          const lineHeight = bodySize * 1.25;
          const top = y + overlay.height * scaleY;
          const accentWidth = Math.max(2, 3 * scaleX);
          const contentX = x + accentWidth + 5 * scaleX;
          const titleY = top - titleSize - 2 * scaleY;
          const dividerY = titleY - titleSize * 0.55;
          const bodyStartY = dividerY - lineHeight * 0.9;
          const bodyLines = getSectionLines(overlay.sectionBody);

          page.drawRectangle({
            x,
            y,
            width: accentWidth,
            height: overlay.height * scaleY,
            color: rgb(accentColor.r, accentColor.g, accentColor.b),
            opacity: 0.95,
            borderWidth: 0,
          });

          if (overlay.sectionTitle) {
            page.drawText(overlay.sectionTitle, {
              x: contentX,
              y: titleY,
              size: titleSize,
              font: boldFont,
              color: rgb(titleColor.r, titleColor.g, titleColor.b),
              maxWidth: overlay.width * scaleX - accentWidth,
            });
          }

          page.drawLine({
            start: { x: contentX, y: dividerY },
            end: { x: x + overlay.width * scaleX, y: dividerY },
            thickness: Math.max(0.6, scaleY),
            color: rgb(accentColor.r, accentColor.g, accentColor.b),
            opacity: 0.85,
          });

          bodyLines.forEach((line, index) => {
            const lineY = bodyStartY - index * lineHeight;
            if (lineY < y + bodySize * 0.5) return;
            page.drawText(line, {
              x: contentX,
              y: lineY,
              size: bodySize,
              font,
              color: rgb(bodyColor.r, bodyColor.g, bodyColor.b),
              maxWidth: overlay.width * scaleX - accentWidth,
            });
          });
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

  const togglePreview = () => {
    const nextPreviewMode = !previewMode;
    setPreviewMode(nextPreviewMode);
    setEditingTextId(null);
    setEditingSectionId(null);
    setDrawingState(null);
    setToolsCollapsed(nextPreviewMode);
    setStatus(nextPreviewMode ? "Preview mode active. Only the document is shown." : "Editor mode active.");
  };

  return (
    <main className="flex h-[100dvh] overflow-hidden flex-col bg-[#f5f3ef] text-[#211f1c]">
      {!previewMode ? (
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#ded8cc] bg-[#fffdfa] px-3 py-3 md:px-5">
        <div>
          <h1 className="text-xl font-semibold">{siteConfig.name}</h1>
          <p className="hidden text-sm text-[#69635b] sm:block">Local-first visual editing for quick cleanups and covers.</p>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          <nav className="hidden min-w-0 flex-wrap items-center justify-end gap-1 text-sm text-[#69635b] sm:flex">
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
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[#146c63] bg-white px-4 text-sm font-medium text-[#146c63] hover:bg-[#e5f3ef] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!pdfDocProxy}
            type="button"
            onClick={() => {
              setShowResumeRebuild(true);
              setResumeStatus(pdfDocProxy ? "Ready to rebuild this PDF into editable resume sections." : "Upload a resume PDF first.");
            }}
          >
            <List size={17} />
            Rebuild resume
          </button>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-[#211f1c] px-4 text-sm font-medium text-white hover:bg-[#3a3630]">
            <FileUp size={18} />
            Upload
            <input className="sr-only" type="file" accept="application/pdf" onChange={loadPdf} />
          </label>
        </div>
      </header>
      ) : null}

      <section className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside
          className={`min-h-0 overflow-auto border-[#ded8cc] bg-[#fffdfa] transition-all duration-300 ease-out ${
            toolsCollapsed || previewMode
              ? "max-h-0 border-b-0 p-0 opacity-0 md:w-0 md:border-r-0"
              : "max-h-[42dvh] border-b p-3 opacity-100 md:max-h-none md:w-60 md:shrink-0 md:border-b-0 md:border-r"
          }`}
        >
          <div className={`grid gap-4 sm:grid-cols-2 md:block md:space-y-5 ${toolsCollapsed || previewMode ? "pointer-events-none" : ""}`}>
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
                    ? `${tool === "box" ? "Drag on the PDF to draw a cover box." : tool === "highlight" ? "Drag on the PDF to highlight an area." : tool === "line" ? "Drag on the PDF to draw a line." : tool === "arrow" ? "Drag on the PDF to draw an arrow." : tool === "clone" ? "Drag around an area to copy it." : tool === "section" ? "Hover and click where the new section should start." : "Click the PDF to place editable text."}`
                    : selectedOverlay
                      ? `${getOverlayLabel(selectedOverlay)} selected.`
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

            {(showShapeControls || showTextControls || showImageControls || showSectionControls) ? (
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
                        min={1}
                        max={pageInfo?.width || 1000}
                        type="number"
                        value={
                          isEditingImageWidth
                            ? imageWidthValue
                            : String(Math.round(selectedOverlay?.width || 0))
                        }
                        onBlur={() => {
                          setIsEditingImageWidth(false);
                          setImageWidthValue("");
                        }}
                        onFocus={() => {
                          recordHistory();
                          setIsEditingImageWidth(true);
                          setImageWidthValue(String(Math.round(selectedOverlay?.width || 0)));
                        }}
                        onChange={(event) => updateImageWidthFromInput(event.target.value)}
                      />
                    </label>
                  </>
                ) : null}

                {showSectionControls ? (
                  <>
                    <div className="space-y-2 rounded-md border border-[#ded8cc] bg-white p-3">
                      <div className="text-sm font-medium">Section colors</div>
                      {[
                        {
                          label: "Title",
                          field: "sectionTitleColor" as const,
                          value: selectedOverlay?.sectionTitleColor || selectedOverlay?.color || "#111111",
                        },
                        {
                          label: "Rows",
                          field: "sectionBodyColor" as const,
                          value: selectedOverlay?.sectionBodyColor || selectedOverlay?.color || "#333333",
                        },
                        {
                          label: "Accent",
                          field: "sectionAccentColor" as const,
                          value: selectedOverlay?.sectionAccentColor || selectedOverlay?.color || "#146c63",
                        },
                      ].map((item) => (
                        <label key={item.field} className="flex items-center justify-between gap-3 text-sm">
                          <span>{item.label}</span>
                          <span className="flex items-center gap-2">
                            <input
                              className="h-8 w-10 rounded-md border border-[#ded8cc] bg-white p-1"
                              type="color"
                              value={item.value}
                              onFocus={recordHistory}
                              onChange={(event) => updateSelectedSectionColor(item.field, event.target.value)}
                            />
                            <input
                              className="h-8 w-24 rounded-md border border-[#ded8cc] bg-white px-2 font-mono text-xs"
                              value={item.value}
                              onFocus={recordHistory}
                              onChange={(event) => updateSelectedSectionColor(item.field, event.target.value)}
                            />
                          </span>
                        </label>
                      ))}
                    </div>

                    <label className="block text-sm font-medium">
                      Section title
                      <input
                        className="mt-2 h-10 w-full rounded-md border border-[#ded8cc] bg-white px-3 text-sm"
                        value={selectedOverlay?.sectionTitle || ""}
                        onFocus={recordHistory}
                        onChange={(event) => {
                          if (selectedOverlay?.type === "section") {
                            updateOverlay(selectedOverlay.id, { sectionTitle: event.target.value });
                          }
                        }}
                      />
                    </label>

                    <label className="block text-sm font-medium">
                      Section content
                      <textarea
                        className="mt-2 min-h-28 w-full resize-y rounded-md border border-[#ded8cc] bg-white px-3 py-2 text-sm"
                        value={selectedOverlay?.sectionBody || ""}
                        onFocus={recordHistory}
                        onKeyDown={(event) => {
                          if (selectedOverlay?.type === "section") {
                            continueSectionRow(event, selectedOverlay);
                          }
                        }}
                        onChange={(event) => {
                          if (selectedOverlay?.type === "section") {
                            updateOverlay(selectedOverlay.id, { sectionBody: event.target.value });
                          }
                        }}
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="block text-sm font-medium">
                        Title size
                        <input
                          className="mt-2 h-10 w-full rounded-md border border-[#ded8cc] bg-white px-3 text-sm"
                          min={8}
                          max={42}
                          type="number"
                          value={selectedOverlay?.titleSize || 12}
                          onFocus={recordHistory}
                          onChange={(event) => {
                            const nextSize = Math.max(8, Math.min(42, Number(event.target.value) || 12));
                            if (selectedOverlay?.type === "section") {
                              updateOverlay(selectedOverlay.id, { titleSize: nextSize });
                            }
                          }}
                        />
                      </label>
                      <label className="block text-sm font-medium">
                        Body size
                        <input
                          className="mt-2 h-10 w-full rounded-md border border-[#ded8cc] bg-white px-3 text-sm"
                          min={7}
                          max={36}
                          type="number"
                          value={fontSize}
                          onFocus={recordHistory}
                          onChange={(event) => {
                            const nextSize = Math.max(7, Math.min(36, Number(event.target.value) || 10));
                            setFontSize(nextSize);
                            if (selectedOverlay?.type === "section") {
                              updateOverlay(selectedOverlay.id, { fontSize: nextSize });
                            }
                          }}
                        />
                      </label>
                    </div>
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
                          {getOverlayLabel(overlay)}
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
          {!previewMode ? (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#ded8cc] bg-[#fffdfa] px-3 py-3 md:px-4">
            <div className="min-w-0">
              <div className="truncate text-sm text-[#69635b]">{status}</div>
              {overlays.length ? (
                <div className="truncate text-xs text-[#8a8277]">
                  Editor outlines and handles are not exported. Visual covers do not securely remove hidden PDF text yet.
                </div>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <button
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-[#ded8cc] bg-white px-3 text-sm font-medium text-[#211f1c] transition hover:bg-[#f5f3ef]"
                type="button"
                onClick={() => setToolsCollapsed((value) => !value)}
              >
                {toolsCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                {toolsCollapsed ? "Show tools" : "Hide tools"}
              </button>
              <button
                className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium ${
                  previewMode
                    ? "border-[#211f1c] bg-[#211f1c] text-white"
                    : "border-[#ded8cc] bg-white text-[#211f1c] hover:bg-[#f5f3ef]"
                }`}
                disabled={!pdfBytes}
                type="button"
                onClick={togglePreview}
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
          ) : null}

          <div
            ref={stageRef}
            className={`flex flex-1 overflow-auto transition-all duration-300 ease-out ${previewMode ? "bg-[#d8d3c8] p-2 md:p-4" : "p-3 md:p-5"}`}
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
                onPointerLeave={
                  previewMode
                    ? undefined
                    : () => {
                        if (tool === "section" && !sectionMenu) {
                          setSectionHover(null);
                        }
                        finishDrawing();
                      }
                }
              >
                <canvas ref={canvasRef} className="absolute inset-0 bg-white" />
                {!previewMode && isPlacing ? (
                  <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-md border border-[#146c63] bg-white/95 px-3 py-2 text-xs font-semibold text-[#146c63] shadow-sm">
                    {tool === "box" ? "Drag to draw box" : tool === "highlight" ? "Drag to highlight" : tool === "line" ? "Drag to draw line" : tool === "arrow" ? "Drag to draw arrow" : tool === "clone" ? "Drag to copy area" : tool === "section" ? "Move to the end of a column" : "Click to place text"}
                  </div>
                ) : null}
                {!previewMode && tool === "section" && (sectionMenu || sectionHover) ? (
                  <div
                    className="absolute z-30"
                    style={{
                      left: (sectionMenu || sectionHover)?.x ? (sectionMenu || sectionHover)!.x * zoom : 0,
                      top: (sectionMenu || sectionHover)?.y ? (sectionMenu || sectionHover)!.y * zoom : 0,
                      width: (sectionMenu || sectionHover)?.width ? (sectionMenu || sectionHover)!.width * zoom : 0,
                    }}
                  >
                    <div className="pointer-events-none absolute left-0 right-0 top-4 h-px bg-[#146c63]" />
                    <div className="pointer-events-none absolute left-0 top-1 h-7 w-px bg-[#146c63]/45" />
                    <div className="pointer-events-none absolute right-0 top-1 h-7 w-px bg-[#146c63]/45" />
                    <button
                      className="relative z-10 inline-flex h-8 items-center gap-1.5 rounded-full border border-[#146c63] bg-white px-3 text-xs font-semibold text-[#146c63] shadow-md shadow-black/10 transition hover:-translate-y-0.5 hover:bg-[#e5f3ef]"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (sectionHover) setSectionMenu(sectionHover);
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <Plus size={14} />
                      Add section
                    </button>
                    {sectionMenu ? (
                      <div
                        className="relative z-20 mt-2 w-64 rounded-md border border-[#ded8cc] bg-[#fffdfa] p-2 shadow-xl shadow-black/15"
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <div className="mb-2 border-b border-[#ded8cc] px-2 pb-2">
                          <div className="text-sm font-semibold">Add next section</div>
                          <div className="mt-0.5 text-xs text-[#69635b]">
                            Snapped below the last visible content in this column.
                          </div>
                        </div>
                        <div className="grid gap-1">
                          {sectionTemplates.map((template) => (
                            <button
                              key={template.id}
                              className="flex min-h-11 items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm font-medium transition hover:bg-[#f5f3ef]"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                addSectionOverlay(template, sectionMenu);
                              }}
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span
                                  className="h-7 w-1.5 shrink-0 rounded-full"
                                  style={{ background: template.accentColor }}
                                />
                                <span className="min-w-0">
                                <span className="block" style={{ color: template.titleColor }}>{template.label}</span>
                                <span className="block text-xs font-normal text-[#69635b]">{template.title}</span>
                                </span>
                              </span>
                              <Plus size={14} />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
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
                            overlay.type === "image" ||
                            overlay.type === "section"
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
                    {overlay.type === "section" ? (
                      editingSectionId === overlay.id ? (
                        <div
                          className="grid h-full w-full overflow-hidden rounded-sm bg-white/80 shadow-[0_0_0_1px_rgba(20,108,99,0.14)]"
                          style={{ gridTemplateColumns: `${Math.max(3, 4 * zoom)}px 1fr` }}
                        >
                          <div style={{ background: overlay.sectionAccentColor || overlay.color }} />
                          <div className="min-w-0 px-1.5 py-1">
                            <input
                              className="w-full border-0 bg-white/80 font-bold uppercase outline-none"
                              style={{
                                color: overlay.sectionTitleColor || overlay.color,
                                fontSize: (overlay.titleSize || 12) * zoom,
                                lineHeight: 1.05,
                              }}
                              value={overlay.sectionTitle || ""}
                              onFocus={recordHistory}
                              onChange={(event) => updateOverlay(overlay.id, { sectionTitle: event.target.value })}
                              onPointerDown={(event) => event.stopPropagation()}
                            />
                            <div
                              className="my-1 w-full"
                              style={{
                                height: Math.max(1, zoom),
                                background: overlay.sectionAccentColor || overlay.color,
                              }}
                            />
                            <textarea
                              className="w-full resize-none border-0 bg-white/80 outline-none"
                              style={{
                                color: overlay.sectionBodyColor || overlay.color,
                                fontSize: (overlay.fontSize || 10) * zoom,
                                height: Math.max(24, overlay.height * zoom - (overlay.titleSize || 12) * zoom - 12),
                                lineHeight: 1.25,
                              }}
                              value={overlay.sectionBody || ""}
                              onFocus={recordHistory}
                              onKeyDown={(event) => continueSectionRow(event, overlay)}
                              onChange={(event) => updateSectionBody(overlay, event.target.value)}
                              onPointerDown={(event) => event.stopPropagation()}
                            />
                          </div>
                        </div>
                      ) : (
                        <div
                          className="grid h-full w-full overflow-hidden rounded-sm bg-white/15"
                          style={{ gridTemplateColumns: `${Math.max(3, 4 * zoom)}px 1fr` }}
                        >
                          <div style={{ background: overlay.sectionAccentColor || overlay.color }} />
                          <div className="min-w-0 px-1.5 py-1">
                            <div
                              className="truncate font-bold uppercase"
                              style={{
                                color: overlay.sectionTitleColor || overlay.color,
                                fontSize: (overlay.titleSize || 12) * zoom,
                                lineHeight: 1.05,
                              }}
                            >
                              {overlay.sectionTitle || "SECTION"}
                            </div>
                            <div
                              className="my-1 w-full"
                              style={{
                                height: Math.max(1, zoom),
                                background: overlay.sectionAccentColor || overlay.color,
                              }}
                            />
                            <div
                              className="space-y-0.5 overflow-hidden"
                              style={{
                                color: overlay.sectionBodyColor || overlay.color,
                                fontSize: (overlay.fontSize || 10) * zoom,
                                lineHeight: 1.25,
                              }}
                            >
                              {getSectionLines(overlay.sectionBody).map((line, index) => (
                                <div key={`${overlay.id}-${index}`} className="flex min-w-0 gap-1">
                                  {line.trimStart().startsWith("- ") ? (
                                    <span
                                      className="mt-[0.35em] h-[0.38em] w-[0.38em] shrink-0 rounded-full"
                                      style={{ background: overlay.sectionAccentColor || overlay.color }}
                                    />
                                  ) : null}
                                  <span className="min-w-0 break-words">
                                    {line.trimStart().startsWith("- ") ? line.trimStart().slice(2) : line}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    ) : overlay.type === "highlight" ? (
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
                className="m-auto flex min-h-64 w-full max-w-xl cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-[#bdb5a7] bg-[#fffdfa] p-6 text-center hover:bg-white md:min-h-80 md:p-10"
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
      {previewMode ? (
        <button
          className="fixed right-4 top-4 z-50 inline-flex h-10 items-center gap-2 rounded-md bg-[#211f1c] px-4 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-[#3a3630]"
          type="button"
          onClick={togglePreview}
        >
          <EyeOff size={16} />
          Exit preview
        </button>
      ) : null}
      {showResumeRebuild ? (
        <div className="fixed inset-0 z-50 bg-[#161411]/45 p-3 md:p-6">
          <div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-md border border-[#ded8cc] bg-[#fffdfa] shadow-2xl">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#ded8cc] px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold">Resume Rebuild</h2>
                <p className="text-sm text-[#69635b]">Extract a resume PDF into editable sections, polish it, then export a clean new PDF.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-[#ded8cc] bg-white px-4 text-sm font-medium hover:bg-[#f5f3ef] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!pdfDocProxy || isParsingResume}
                  type="button"
                  onClick={extractResumeDraft}
                >
                  <List size={16} />
                  {isParsingResume ? "Rebuilding" : resumeDraft ? "Rebuild again" : "Analyze PDF"}
                </button>
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-[#146c63] px-4 text-sm font-medium text-white hover:bg-[#0f5e56] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!resumeDraft || isExportingResume}
                  type="button"
                  onClick={exportResumeDraft}
                >
                  <Download size={16} />
                  {isExportingResume ? "Exporting" : "Export resume"}
                </button>
                <button
                  className="flex h-10 w-10 items-center justify-center rounded-md border border-[#ded8cc] bg-white hover:bg-[#f5f3ef]"
                  type="button"
                  onClick={() => setShowResumeRebuild(false)}
                  title="Close"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[360px_1fr]">
              <aside className="min-h-0 overflow-auto border-b border-[#ded8cc] bg-[#f7fbfa] p-4 lg:border-b-0 lg:border-r">
                <div className="rounded-md border border-[#ded8cc] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Import status</div>
                      <p className="mt-1 text-sm text-[#69635b]">{resumeStatus}</p>
                    </div>
                    <div className="rounded-full bg-[#e5f3ef] px-3 py-1 text-xs font-semibold text-[#0f5e56]">
                      {resumeDraft ? `${resumeDraft.confidence}%` : "Local"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-md border border-[#ded8cc] bg-white p-4">
                  <div className="mb-3 text-sm font-semibold">Theme</div>
                  <label className="block text-sm font-medium">
                    Accent color
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        className="h-10 w-12 rounded-md border border-[#ded8cc] bg-white p-1"
                        type="color"
                        value={resumeAccent}
                        onChange={(event) => setResumeAccent(event.target.value)}
                      />
                      <input
                        className="h-10 min-w-0 flex-1 rounded-md border border-[#ded8cc] bg-white px-3 font-mono text-sm"
                        value={resumeAccent}
                        onChange={(event) => {
                          if (isHexColor(event.target.value)) setResumeAccent(event.target.value);
                        }}
                      />
                    </div>
                  </label>
                </div>

                <div className="mt-4 rounded-md border border-[#ded8cc] bg-white p-4">
                  <div className="mb-2 text-sm font-semibold">What this does</div>
                  <div className="space-y-2 text-sm text-[#69635b]">
                    <p>Reads selectable PDF text locally in your browser.</p>
                    <p>Converts it into resume sections you can clean up quickly.</p>
                    <p>Exports a fresh, structured, ATS-friendly PDF.</p>
                  </div>
                </div>
              </aside>

              <div className="min-h-0 overflow-auto p-4 md:p-6">
                {!resumeDraft ? (
                  <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center">
                    <div className="rounded-md border border-[#ded8cc] bg-white p-6 shadow-sm">
                      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-md bg-[#e5f3ef] text-[#146c63]">
                        <List size={24} />
                      </div>
                      <h3 className="text-2xl font-semibold">Rebuild this PDF into an editable resume</h3>
                      <p className="mt-3 max-w-2xl text-[#69635b]">
                        This first version handles text-based PDFs. Scanned PDFs will need the OCR slice next, but the editor and export flow are ready for it.
                      </p>
                      <button
                        className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-[#146c63] px-5 text-sm font-semibold text-white hover:bg-[#0f5e56] disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={!pdfDocProxy || isParsingResume}
                        type="button"
                        onClick={extractResumeDraft}
                      >
                        <List size={17} />
                        {isParsingResume ? "Analyzing PDF" : "Analyze PDF"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
                    <div className="space-y-4">
                      <section className="rounded-md border border-[#ded8cc] bg-white p-4 shadow-sm">
                        <h3 className="mb-3 text-sm font-semibold uppercase tracking-normal text-[#69635b]">Header</h3>
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="block text-sm font-medium">
                            Name
                            <input
                              className="mt-2 h-10 w-full rounded-md border border-[#ded8cc] bg-white px-3 text-sm"
                              value={resumeDraft.name}
                              onChange={(event) => updateResumeDraft({ name: event.target.value })}
                            />
                          </label>
                          <label className="block text-sm font-medium">
                            Headline
                            <input
                              className="mt-2 h-10 w-full rounded-md border border-[#ded8cc] bg-white px-3 text-sm"
                              value={resumeDraft.headline}
                              onChange={(event) => updateResumeDraft({ headline: event.target.value })}
                            />
                          </label>
                        </div>
                        <label className="mt-3 block text-sm font-medium">
                          Contact lines
                          <textarea
                            className="mt-2 min-h-20 w-full rounded-md border border-[#ded8cc] bg-white px-3 py-2 text-sm"
                            value={resumeDraft.contact.join("\n")}
                            onChange={(event) => updateResumeDraft({ contact: event.target.value.split("\n").filter(Boolean) })}
                          />
                        </label>
                        <label className="mt-3 block text-sm font-medium">
                          Summary
                          <textarea
                            className="mt-2 min-h-24 w-full rounded-md border border-[#ded8cc] bg-white px-3 py-2 text-sm"
                            value={resumeDraft.summary}
                            onChange={(event) => updateResumeDraft({ summary: event.target.value })}
                          />
                        </label>
                      </section>

                      {resumeDraft.sections.map((section) => (
                        <section key={section.id} className="rounded-md border border-[#ded8cc] bg-white p-4 shadow-sm">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <input
                              className="h-10 min-w-0 flex-1 rounded-md border border-[#ded8cc] bg-white px-3 text-sm font-semibold uppercase"
                              value={section.title}
                              onChange={(event) => updateResumeSection(section.id, { title: event.target.value })}
                            />
                            <button
                              className="flex h-10 w-10 items-center justify-center rounded-md border border-[#ded8cc] bg-white hover:bg-[#f5f3ef]"
                              type="button"
                              onClick={() => removeResumeSection(section.id)}
                              title="Remove section"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <textarea
                            className="min-h-36 w-full rounded-md border border-[#ded8cc] bg-white px-3 py-2 text-sm leading-6"
                            value={section.items.join("\n")}
                            onChange={(event) =>
                              updateResumeSection(section.id, {
                                items: event.target.value.split("\n").map(cleanResumeItem).filter(Boolean),
                              })
                            }
                          />
                        </section>
                      ))}

                      <button
                        className="inline-flex h-10 items-center gap-2 rounded-md border border-[#ded8cc] bg-white px-4 text-sm font-medium hover:bg-[#f5f3ef]"
                        type="button"
                        onClick={addResumeSection}
                      >
                        <Plus size={16} />
                        Add section
                      </button>
                    </div>

                    <div className="rounded-md border border-[#ded8cc] bg-white p-6 shadow-sm xl:sticky xl:top-0">
                      <div className="border-b pb-4" style={{ borderColor: resumeAccent }}>
                        <div className="text-3xl font-semibold text-[#211f1c]">{resumeDraft.name}</div>
                        <div className="mt-1 text-sm font-medium" style={{ color: resumeAccent }}>
                          {resumeDraft.headline}
                        </div>
                        <div className="mt-2 text-xs text-[#69635b]">{resumeDraft.contact.join(" | ")}</div>
                      </div>
                      <div className="mt-4">
                        <div className="mb-1 text-xs font-bold uppercase" style={{ color: resumeAccent }}>Summary</div>
                        <p className="text-sm leading-6 text-[#33302b]">{resumeDraft.summary}</p>
                      </div>
                      <div className="mt-4 space-y-4">
                        {resumeDraft.sections.map((section) => (
                          <div key={section.id}>
                            <div className="mb-1 text-xs font-bold uppercase" style={{ color: resumeAccent }}>
                              {section.title}
                            </div>
                            <div className="space-y-1.5 text-sm leading-5 text-[#33302b]">
                              {section.items.slice(0, 6).map((item, index) => (
                                <div key={`${section.id}-preview-${index}`} className="flex gap-2">
                                  <span style={{ color: resumeAccent }}>-</span>
                                  <span>{item}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
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
