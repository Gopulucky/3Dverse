/**
 * The facts a buyer reads before paying. A row exists only when the listing has
 * the fact: nothing here is a default or a guess.
 */
export interface DetailRow { label: string; value: string }

interface Version {
  is_latest?: boolean;
  file_format?: string | null;
  file_size?: number | null;
  printability_report?: {
    status?: string;
    volume_mm3?: number | null;
    dimensions?: { x?: number; y?: number; z?: number } | null;
  } | null;
}

export type PrintSettings = {
  recommended_materials?: string[];
  layer_height?: number | string;
  supports_required?: boolean;
  supports?: string;
  infill_percentage?: number;
  infill?: string;
  raft_brim_required?: boolean;
} | null | undefined;

const CHECKS: Record<string, string> = { pass: "Passed", warning: "Passed with warnings" };

function fileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function rows(entries: [string, string | undefined | null | false][]): DetailRow[] {
  return entries.flatMap(([label, value]) => (value ? [{ label, value }] : []));
}

export function includedRows(
  product: { versions?: Version[] | null; license_type?: string | null },
  formats: readonly string[],
): DetailRow[] {
  const versions = product.versions ?? [];
  const version = versions.find((item) => item.is_latest) ?? versions[versions.length - 1];
  const report = version?.printability_report;
  const size = report?.dimensions;
  const axes = size ? [size.x, size.y, size.z] : [];
  const digital = formats.includes("digital");
  const physical = formats.includes("physical");
  return rows([
    ["File", version?.file_format && [version.file_format, version.file_size ? fileSize(version.file_size) : ""].filter(Boolean).join(", ")],
    ["Size", axes.length === 3 && axes.every((n) => typeof n === "number") && `${axes.map((n) => Math.round(n as number)).join(" × ")} mm`],
    ["Volume", report?.volume_mm3 != null && `${(report.volume_mm3 / 1000).toFixed(1)} cm³`],
    ["Printability check", report?.status && CHECKS[report.status]],
    ["Licence", product.license_type],
    ["Delivery", digital && physical ? "Download after payment, or printed and shipped" : digital ? "Download after payment" : physical && "Printed and shipped"],
  ]);
}

export function printRows(settings: PrintSettings): DetailRow[] {
  if (!settings) return [];
  const { layer_height: height, supports_required: needed, supports, infill_percentage: infill } = settings;
  const supportText = typeof needed === "boolean"
    ? (needed ? "Required" : "Not required")
    : supports && (supports === "none" ? "Not required" : supports[0].toUpperCase() + supports.slice(1));
  return rows([
    ["Material", settings.recommended_materials?.join(", ")],
    ["Layer height", typeof height === "number" ? height > 0 && `${height} mm` : height?.replace(/\s*mm$/, " mm")],
    ["Supports", supportText],
    ["Infill", typeof infill === "number" ? infill > 0 && `${infill}%` : settings.infill],
    ["Raft or brim", typeof settings.raft_brim_required === "boolean" && (settings.raft_brim_required ? "Needed" : "Not needed")],
  ]);
}
