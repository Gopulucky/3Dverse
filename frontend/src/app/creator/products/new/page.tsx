"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  UploadCloud,
  Loader2,
  FileBox,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StudioShell } from "@/components/layout/studio-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { getCreatorPath, useCreatorType, type CreatorType } from "@/lib/creator-nav";
import { useRequireAuth } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

const STEPS = ["Details", "Upload"] as const;

/** Keep in step with MAX_MODEL_UPLOAD_BYTES in backend/app/api/routers/products.py. */
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/**
 * Per-path copy. Fulfillment is no longer a per-product question — it follows
 * from the account-level creator path, so the flow is the same everywhere and
 * only the wording changes.
 */
interface UploadCopy {
  /** `self` for anyone who ships their own work; designers rely on partners. */
  fulfillment: "self" | "pending_partner";
  noun: string;
  detailsTitle: string;
  detailsSubtitle: string;
  uploadTitle: string;
  uploadSubtitle: string;
  /** Studio creators may list an item they have already printed, file or not. */
  fileRequired: boolean;
}

const COPY: Record<CreatorType, UploadCopy> = {
  studio: {
    fulfillment: "self",
    noun: "product",
    detailsTitle: "Name your product",
    detailsSubtitle: "A great title helps buyers find what you print.",
    uploadTitle: "Upload your 3D file",
    uploadSubtitle:
      "Attach the model you print from. Optional if you're listing something you've already made.",
    fileRequired: false,
  },
  seller: {
    fulfillment: "self",
    noun: "design",
    detailsTitle: "Name your design",
    detailsSubtitle: "A great title helps buyers find your design.",
    uploadTitle: "Upload your design file",
    uploadSubtitle: "This is the file buyers receive when they purchase.",
    fileRequired: true,
  },
  designer: {
    fulfillment: "pending_partner",
    noun: "design",
    detailsTitle: "Name your design",
    detailsSubtitle: "A great title helps buyers and print partners find your work.",
    uploadTitle: "Upload your design file",
    uploadSubtitle: "Print partners manufacture and ship from this file.",
    fileRequired: true,
  },
};

/** Fallback while the creator path is still loading or was never set. */
const DEFAULT_COPY = COPY.studio;

export default function NewProductPage() {
  const router = useRouter();
  const { ready: isAuthenticated } = useRequireAuth();
  const { creatorType } = useCreatorType();
  const copy = creatorType ? COPY[creatorType] : DEFAULT_COPY;
  const creatorPath = getCreatorPath(creatorType);

  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<"idle" | "uploading" | "verifying" | "analyzing" | "generating" | "ready">("idle");

  const handleDrag = useCallback((e: React.DragEvent) => {
    if (uploadStage !== "idle") return;
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, [uploadStage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (uploadStage !== "idle") return;
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  }, [uploadStage]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (uploadStage !== "idle") return;
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (f: File) => {
    const validExtensions = [".stl", ".obj", ".3mf", ".step", ".stp", ".fbx", ".blend"];
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!validExtensions.includes(ext)) {
      toast.error(`Invalid file type. Supported: ${validExtensions.join(", ")}`);
      return;
    }
    // Matches the API's own cap — better to say so here than to let the user
    // wait out a long upload that the server was always going to reject.
    if (f.size > MAX_UPLOAD_BYTES) {
      toast.error(`File is too large (${(f.size / 1024 / 1024).toFixed(0)} MB). Maximum is 100 MB.`);
      return;
    }
    if (f.size === 0) {
      toast.error("That file is empty.");
      return;
    }
    setFile(f);
    if (!title) {
      setTitle(f.name.replace(ext, "").replace(/[_-]/g, " "));
    }
  };

  const handleSubmit = async () => {
    if (copy.fileRequired && !file) {
      toast.error("Please select a 3D model file to upload");
      return;
    }
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setIsUploading(true);
    setUploadStage("uploading");
    setUploadProgress(0);

    // The draft is created first, so once this succeeds the listing exists even
    // if the file transfer later fails. Tracked here so the failure path can say
    // so and hand the creator their draft, rather than reporting a flat error
    // next to a product that is plainly already in their portfolio.
    let productId: number | null = null;

    try {
      const product = await api.post<any>("/api/products/", {
        title: title.trim(),
        description: "",
        category: "Other",
        price: 0,
        license_type: "standard",
        status: "draft",
        tags: [],
        fulfillment_status: copy.fulfillment,
      });
      productId = product.id;

      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        await api.uploadWithProgress(
          `/api/products/${product.id}/upload-model`,
          formData,
          (percent) => {
            setUploadProgress(percent);
            // Once the bytes are all sent, the server is still storing the file
            // and queueing analysis — say that instead of sitting at 100%.
            if (percent >= 100) setUploadStage("verifying");
          }
        );
      }

      setUploadProgress(100);
      setUploadStage("ready");
      toast.success(
        file
          ? "Listing created. Printability analysis is running in the background."
          : "Listing created."
      );
      router.push(`/creator/products/${product.id}`);
    } catch (err: any) {
      setUploadStage("idle");
      setUploadProgress(0);
      setIsUploading(false);

      const message = err?.detail || err?.message || `Failed to create ${copy.noun}`;
      if (productId) {
        toast.error(`${message} Your draft was saved — you can retry the file upload from it.`);
        router.push(`/creator/products/${productId}`);
      } else {
        toast.error(message);
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <StudioShell>
        <div className="max-w-5xl mx-auto px-6 pt-24 pb-20 space-y-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </StudioShell>
    );
  }

  return (
    <StudioShell>
      <div className="min-h-screen bg-background">
        {/* ── Top Progress Bar ── */}
        <div className="sticky top-16 z-20 bg-card/80 backdrop-blur border-b border-border">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Link
                href="/creator/products"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                <ArrowLeft size={16} />
                Back
              </Link>

              {/* Step Indicators */}
              <div className="flex items-center gap-2">
                {STEPS.map((s, i) => (
                  <div key={s} className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300",
                        i < step
                          ? "bg-success-surface text-success-ink"
                          : i === step
                          ? "bg-ember-surface text-ember-ink"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {i < step ? (
                        <CheckCircle2 size={13} />
                      ) : (
                        <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center text-[10px] font-bold border-current">
                          {i + 1}
                        </span>
                      )}
                      {s}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div
                        className={cn(
                          "w-8 h-px transition-colors duration-300",
                          i < step ? "bg-success/50" : "bg-border"
                        )}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="text-xs text-muted-foreground font-medium">
                Step {step + 1} of {STEPS.length}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-16">
          {/* ── STEP 0: Listing Details ── */}
          {step === 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
              <div className="mb-12">
                <div className="flex flex-wrap items-center gap-2 mb-6">
                  <div className="inline-flex items-center gap-2 bg-ember-surface text-ember-ink text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full">
                    <Sparkles size={12} />
                    Step 1 of {STEPS.length}
                  </div>
                  {/* Which creator path this listing is being created under */}
                  {creatorPath && (
                    <div
                      className={cn(
                        "inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full",
                        creatorPath.accentBg,
                        creatorPath.accent
                      )}
                    >
                      <creatorPath.icon size={12} />
                      {creatorPath.label}
                    </div>
                  )}
                </div>
                <h1 className="text-4xl font-bold font-display tracking-tight text-foreground mb-3">
                  {copy.detailsTitle}
                </h1>
                <p className="text-muted-foreground">{copy.detailsSubtitle}</p>
                {creatorPath && (
                  <p className="text-sm text-muted-foreground mt-3">
                    You're listing as a{" "}
                    <span className={cn("font-semibold", creatorPath.accent)}>
                      {creatorPath.label}
                    </span>{" "}
                    creator — {creatorPath.tagline}.
                  </p>
                )}
              </div>

              <div className="space-y-2 mb-10">
                <Label className="text-sm font-semibold text-foreground">
                  Listing Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Articulated Dragon Figurine"
                  className="h-14 text-base rounded-xl border-border focus:border-primary bg-card"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Include keywords that buyers would search for.
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  size="lg"
                  className="rounded-xl flex-1 sm:flex-none sm:px-12"
                  disabled={!title.trim()}
                  onClick={() => setStep(1)}
                >
                  Continue <ArrowRight size={16} className="ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 1: Upload the file ── */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
              <div className="mb-12">
                <div className="inline-flex items-center gap-2 bg-ember-surface text-ember-ink text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
                  <Sparkles size={12} />
                  Step 2 of {STEPS.length}
                </div>
                <h2 className="text-4xl font-bold font-display tracking-tight text-foreground mb-3">
                  {copy.uploadTitle}
                </h2>
                <p className="text-muted-foreground">{copy.uploadSubtitle}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Supported formats: STL, OBJ, 3MF, STEP, FBX, BLEND
                </p>
              </div>

              {/* Drag & Drop Zone */}
              <div
                className={cn(
                  "relative border-2 border-dashed rounded-3xl transition-all duration-300 cursor-pointer overflow-hidden",
                  uploadStage !== "idle"
                    ? "border-ember bg-muted/50 cursor-default"
                    : dragActive
                    ? "border-ember bg-ember/5 scale-[1.01] shadow-[0_0_0_4px_rgba(234,88,12,0.1)]"
                    : file
                    ? "border-success/60 bg-success/5"
                    : "border-border hover:border-ember/50 hover:bg-muted/30 group"
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {uploadStage === "idle" && (
                  <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    accept=".stl,.obj,.3mf,.step,.fbx,.blend"
                    onChange={handleChange}
                  />
                )}

                <div className="py-20 px-8 text-center pointer-events-none relative z-10">
                  {uploadStage !== "idle" ? (
                    <div className="space-y-6 max-w-sm mx-auto">
                      <div className="flex items-center justify-between font-bold font-display text-lg">
                        <span className="capitalize text-ember">
                          {uploadStage === "uploading" && "Uploading..."}
                          {uploadStage === "verifying" && "Saving on server..."}
                          {uploadStage === "analyzing" && "Analyzing Printability..."}
                          {uploadStage === "generating" && "Generating Preview..."}
                          {uploadStage === "ready" && "Ready"}
                        </span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="h-4 w-full bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-ember transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <div className="flex justify-center text-ember">
                        {uploadStage === "ready" ? (
                          <CheckCircle2 size={40} className="text-success" />
                        ) : (
                          <Loader2 size={40} className="animate-spin" />
                        )}
                      </div>
                    </div>
                  ) : file ? (
                    <div className="space-y-4">
                      <div className="w-16 h-16 bg-success/15 rounded-2xl flex items-center justify-center mx-auto border border-success/30">
                        <FileBox size={32} className="text-success" />
                      </div>
                      <div>
                        <p className="font-bold text-lg text-foreground">{file.name}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-2 bg-success-surface text-success-ink text-xs font-bold px-4 py-2 rounded-full">
                        <CheckCircle2 size={13} /> File ready — click to replace
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div
                        className={cn(
                          "w-20 h-20 rounded-3xl flex items-center justify-center mx-auto border-2 transition-all duration-300",
                          dragActive
                            ? "border-ember bg-ember/10 scale-110"
                            : "border-dashed border-border group-hover:border-ember/50 group-hover:bg-ember/5"
                        )}
                      >
                        <UploadCloud
                          size={40}
                          className={cn(
                            "transition-colors duration-300",
                            dragActive
                              ? "text-ember"
                              : "text-muted-foreground/50 group-hover:text-ember/60"
                          )}
                        />
                      </div>
                      <div>
                        <p className="text-xl font-bold text-foreground">
                          Drag and drop your file
                        </p>
                        <p className="text-muted-foreground mt-1">
                          or{" "}
                          <span className="text-ember font-semibold underline underline-offset-2">
                            click to browse
                          </span>
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground/70">
                        STL · OBJ · 3MF · STEP · FBX · BLEND · Max 100MB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Checklist */}
              {uploadStage === "idle" && (
                <div className="grid grid-cols-3 gap-3 mt-6">
                  {[
                    { label: "Watertight mesh", ok: !!file },
                    { label: "Manifold geometry", ok: !!file },
                    { label: "< 100 MB", ok: file ? file.size <= MAX_UPLOAD_BYTES : false },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-colors",
                        item.ok
                          ? "border-success/30 bg-success/5 text-success"
                          : "border-border bg-muted/30 text-muted-foreground"
                      )}
                    >
                      <CheckCircle2 size={13} className={item.ok ? "text-success" : "opacity-30"} />
                      {item.label}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between gap-4 mt-10">
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-xl"
                  onClick={() => setStep(0)}
                  disabled={uploadStage !== "idle"}
                >
                  <ArrowLeft size={16} className="mr-2" /> Back
                </Button>
                <Button
                  size="lg"
                  className="rounded-xl flex-1 sm:flex-none sm:px-12"
                  disabled={(copy.fileRequired && !file) || uploadStage !== "idle"}
                  onClick={handleSubmit}
                >
                  <UploadCloud size={18} className="mr-2" /> Create Listing
                </Button>
              </div>

              {!copy.fileRequired && !file && (
                <p className="text-xs text-muted-foreground text-center mt-4">
                  No file? You can skip this and attach one later from the product page.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </StudioShell>
  );
}
