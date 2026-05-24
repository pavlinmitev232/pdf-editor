export const siteConfig = {
  name: "Patch PDF",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://patch-pdf.com",
  description:
    "A browser-first PDF editor for adding text, covering content, matching page colors, and exporting clean PDF files without uploading documents.",
};

export const seoPages = [
  {
    href: "/edit-pdf-online",
    title: "Edit PDF Online",
    description: "Upload a PDF, add text, cover content, preview the page, and export a new file in your browser.",
  },
  {
    href: "/add-text-to-pdf",
    title: "Add Text to PDF",
    description: "Place editable text directly on a PDF page, adjust the size and color, then export the result.",
  },
  {
    href: "/cover-text-in-pdf",
    title: "Cover Text in PDF",
    description: "Use a color-matched cover box to hide old text or visual mistakes in a PDF you own.",
  },
  {
    href: "/private-pdf-editor",
    title: "Private PDF Editor",
    description: "Edit PDF files locally in your browser without sending the document to an application server.",
  },
  {
    href: "/pdf-color-picker",
    title: "PDF Color Picker",
    description: "Sample colors from the rendered PDF page so cover boxes blend into the original document.",
  },
];

export const allSitePaths = [
  "/",
  ...seoPages.map((page) => page.href),
  "/guides",
  "/guides/how-to-edit-pdf",
  "/guides/cover-redact-pdf",
  "/guides/pdf-color-picker",
  "/about",
  "/contact",
  "/privacy",
  "/cookies",
  "/terms",
  "/acceptable-use",
  "/accessibility",
  "/copyright",
  "/disclaimer",
];

