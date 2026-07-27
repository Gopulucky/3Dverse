"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  FileBox,
  Save,
  Loader2,
  Image as ImageIcon,
  Settings2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useRequireAuth } from "@/stores/auth-store";
import ModelViewer from "@/components/ModelViewer";
import { cn } from "@/lib/utils";
import { StudioShell } from "@/components/layout/studio-shell";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { ready: isAuthenticated } = useRequireAuth();
  const unwrappedParams = use(params);
  const productId = unwrappedParams.id;

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    // useRequireAuth handles the login redirect once hydration completes.
    if (!isAuthenticated) return;
    fetchProduct();
  }, [productId, isAuthenticated]);

  const fetchProduct = async () => {
    try {
      const products = await api.get<any[]>("/api/products/creator");
      const p = products.find((x: any) => x.id === parseInt(productId));
      if (!p) throw new Error("Product not found");
      // Ensure print_settings exists
      if (!p.print_settings) {
        p.print_settings = {
          supports_required: false,
          raft_brim_required: false,
          infill_percentage: 15,
          layer_height: 0.2,
          recommended_materials: [],
        };
      }
      setProduct(p);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch product");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e?: React.FormEvent, statusOverride?: string) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: product.title,
        description: product.description,
        price: product.price,
        category: product.category,
        status: statusOverride || product.status,
        print_settings: product.print_settings,
        hardware_required: product.hardware_required,
        assembly_instructions: product.assembly_instructions,
        is_mode_2_active: product.is_mode_2_active,
        is_mode_3_active: product.is_mode_3_active,
        is_mode_4_active: product.is_mode_4_active,
        digital_download_enabled: product.digital_download_enabled,
        watermark_enabled: product.watermark_enabled,
        available_materials: product.available_materials || [],
        available_colors: product.available_colors || [],
        available_sizes: product.available_sizes || [],
        base_print_price: product.base_print_price,
        mode_4_config:
          typeof product.mode_4_config === "string"
            ? JSON.parse(product.mode_4_config)
            : product.mode_4_config || {},
      };

      await api.put(`/api/products/${productId}`, payload);

      toast.success(
        statusOverride === "published"
          ? "Product published successfully!"
          : statusOverride === "draft"
          ? "Product unpublished."
          : "Product saved successfully"
      );
      await fetchProduct();
    } catch (err: any) {
      toast.error(err.detail || "Failed to update product");
    } finally {
      setSaving(false);
    }
  };

  const handlePublishToggle = () => {
    if (product.status !== "published") {
      const latestVersion = product.versions?.find((v: any) => v.is_latest);
      if (latestVersion?.printability_report?.status === "fail") {
        toast.error("Cannot publish: Printability check failed. Please resolve the geometry issues first.");
        return;
      }
    }

    if (product.status === "published") {
      handleUpdate(undefined, "draft");
    } else {
      handleUpdate(undefined, "published");
    }
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "model" | "media"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    if (type === "media") {
      formData.append("is_primary", "true");
    }

    try {
      await api.upload(`/api/products/${productId}/upload-${type}`, formData);
      toast.success(`${type === "media" ? "Image" : "Model"} uploaded`);
      await fetchProduct();
    } catch (err: any) {
      toast.error(err.detail || `Failed to upload ${type}`);
    } finally {
      setUploading(false);
    }
  };

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <StudioShell>
        <div className="max-w-7xl mx-auto px-6 pt-24 pb-20 space-y-6">
          <div className="flex justify-between items-center mb-8">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-[400px]" />
              <Skeleton className="h-[600px]" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
          </div>
        </div>
      </StudioShell>
    );
  }

  if (!product) {
    return (
      <StudioShell>
        <div className="min-h-screen pt-24 flex items-center justify-center">
          <p className="text-muted-foreground text-lg font-display">Product not found</p>
        </div>
      </StudioShell>
    );
  }

  const latestVersion = product.versions?.find((v: any) => v.is_latest);

  return (
    <StudioShell>
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-20">
        <Link
          href="/creator/products"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors font-semibold"
        >
          <ArrowLeft size={16} /> Back to Library
        </Link>

        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold flex items-center font-display">
              {product.title || "Untitled Product"}
            </h1>
            <Badge
              variant={product.status === "published" ? "success" : "secondary"}
              className="capitalize shadow-sm"
            >
              {product.status}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            {product.status === "published" ? (
              <Button onClick={handlePublishToggle} variant="outline" disabled={saving}>
                {saving && <Loader2 size={16} className="animate-spin mr-2" />}
                Unpublish
              </Button>
            ) : (
              <Button onClick={handlePublishToggle} variant="secondary" className="bg-primary-surface text-primary-ink hover:bg-primary/20" disabled={saving}>
                {saving && <Loader2 size={16} className="animate-spin mr-2" />}
                Publish
              </Button>
            )}
            <Button onClick={(e) => handleUpdate(e)} disabled={saving}>
              {saving ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : (
                <Save size={16} className="mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        {latestVersion?.printability_report?.status === "fail" && product.status !== "published" && (
          <div className="mb-8 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3">
            <AlertTriangle className="text-destructive mt-0.5" size={20} />
            <div>
              <h3 className="font-semibold text-destructive">Printability Check Failed</h3>
              <p className="text-sm text-destructive/80 mt-1">
                Your model failed the automated printability analysis. Please check the Geometry section for details and upload a fixed version. You cannot publish until these issues are resolved.
              </p>
            </div>
          </div>
        )}

        {product.safety_review_status === "pending" && product.status !== "published" && (
          <div className="mb-8 p-4 bg-ember/10 border border-ember/20 rounded-xl flex items-start gap-3">
            <AlertTriangle className="text-ember mt-0.5" size={20} />
            <div>
              <h3 className="font-semibold text-ember">Awaiting Safety Review</h3>
              <p className="text-sm text-ember/80 mt-1">
                Every new listing is screened for restricted or dangerous printable items before it can go
                live. This is usually quick — you&apos;ll be able to publish as soon as it clears.
              </p>
            </div>
          </div>
        )}

        {product.safety_review_status === "rejected" && (
          <div className="mb-8 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3">
            <AlertTriangle className="text-destructive mt-0.5" size={20} />
            <div>
              <h3 className="font-semibold text-destructive">Failed Safety Review</h3>
              <p className="text-sm text-destructive/80 mt-1">
                {product.safety_review_note || "This design cannot be published. Contact support for details."}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8 items-start">
          {/* LEFT COLUMN: Main Editor */}
          <div className="space-y-6">
            
            {/* OVERVIEW */}
            <Card className="p-6 border-border bg-card shadow-sm">
              <form className="space-y-5">
                <div>
                  <Label className="mb-1.5 block">Title</Label>
                  <Input
                    value={product.title}
                    onChange={(e) =>
                      setProduct({ ...product, title: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block">Description</Label>
                  <Textarea
                    rows={6}
                    value={product.description || ""}
                    onChange={(e) =>
                      setProduct({ ...product, description: e.target.value })
                    }
                    placeholder="Describe your design, instructions, story, etc."
                  />
                </div>
              </form>
            </Card>

            {/* MEDIA HUB */}
            <Card className="p-6 border-border bg-card shadow-sm">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-lg font-bold font-display">Media Hub</h2>
                <label className="cursor-pointer text-sm font-semibold text-primary hover:underline flex items-center gap-1.5">
                  <ImageIcon size={16} />
                  Add Images
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, "media")}
                    disabled={uploading}
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* 3D Viewer takes 2 spans if it exists */}
                <div className="col-span-3 lg:col-span-2 h-[350px] bg-muted/30 rounded-xl overflow-hidden relative border border-border">
                  {latestVersion?.preview_url ? (
                    <>
                      <ModelViewer
                        url={api.mediaUrl(latestVersion.preview_url)}
                        extension="glb"
                      />
                      <div className="absolute top-3 left-3 bg-background/80 backdrop-blur px-2.5 py-1.5 rounded-lg text-xs font-mono border shadow-sm flex items-center gap-2">
                        <FileBox size={14} className="text-primary"/> 3D Model
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
                      <FileBox size={32} className="mb-3 opacity-50" />
                      <span className="text-sm font-medium">No 3D Model Uploaded</span>
                    </div>
                  )}
                </div>

                {/* Images Gallery */}
                <div className="col-span-3 lg:col-span-1 grid grid-cols-3 lg:grid-cols-1 gap-4 overflow-y-auto lg:max-h-[350px] no-scrollbar pr-1">
                  {product.media?.filter((m: any) => m.media_type === "image").length > 0 ? (
                    product.media.filter((m: any) => m.media_type === "image").map((m: any) => (
                      <div key={m.id} className="relative rounded-xl overflow-hidden border border-border aspect-square bg-muted">
                        <img src={api.mediaUrl(m.media_url)} className="w-full h-full object-cover" alt="Product preview" />
                        {m.is_primary && (
                          <Badge variant="default" className="absolute top-2 right-2 text-[10px] px-2 py-0.5 shadow-sm">Main</Badge>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="w-full aspect-square border-2 border-dashed border-border rounded-xl flex items-center justify-center text-muted-foreground/40 bg-muted/20">
                       <ImageIcon size={24} />
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* PRINT SETTINGS */}
            <Card className="p-6 border-border bg-card shadow-sm">
              <h2 className="text-lg font-bold mb-1 font-display flex items-center gap-2">
                <Settings2 size={18} className="text-primary" />
                Manufacturing & Print Settings
              </h2>
              <p className="text-muted-foreground text-sm mb-6">
                Provide slicer settings and assembly instructions to help others successfully print this model.
              </p>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <label className="flex flex-col gap-2 p-3 border rounded-xl bg-card/50 cursor-pointer hover:border-primary/50 transition-colors">
                    <span className="text-sm font-semibold">Requires Supports?</span>
                    <input
                      type="checkbox"
                      checked={product.print_settings?.supports_required || false}
                      onChange={(e) =>
                        setProduct({
                          ...product,
                          print_settings: {
                            ...product.print_settings,
                            supports_required: e.target.checked,
                          },
                        })
                      }
                      className="accent-primary w-4 h-4"
                    />
                  </label>
                  
                  <label className="flex flex-col gap-2 p-3 border rounded-xl bg-card/50 cursor-pointer hover:border-primary/50 transition-colors">
                    <span className="text-sm font-semibold">Raft / Brim?</span>
                    <input
                      type="checkbox"
                      checked={product.print_settings?.raft_brim_required || false}
                      onChange={(e) =>
                        setProduct({
                          ...product,
                          print_settings: {
                            ...product.print_settings,
                            raft_brim_required: e.target.checked,
                          },
                        })
                      }
                      className="accent-primary w-4 h-4"
                    />
                  </label>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase">Infill (%)</Label>
                    <Input
                      type="number"
                      value={product.print_settings?.infill_percentage || ""}
                      onChange={(e) =>
                        setProduct({
                          ...product,
                          print_settings: {
                            ...product.print_settings,
                            infill_percentage: parseInt(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="e.g. 15"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase">Layer Height (mm)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={product.print_settings?.layer_height || ""}
                      onChange={(e) =>
                        setProduct({
                          ...product,
                          print_settings: {
                            ...product.print_settings,
                            layer_height: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="e.g. 0.2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="mb-2 block">Recommended Materials</Label>
                    <Input
                      value={(product.print_settings?.recommended_materials || []).join(", ")}
                      onChange={(e) =>
                        setProduct({
                          ...product,
                          print_settings: {
                            ...product.print_settings,
                            recommended_materials: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
                          },
                        })
                      }
                      placeholder="e.g. PLA, PETG, TPU"
                    />
                  </div>

                  <div className="space-y-3 pt-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={product.hardware_required}
                        onChange={(e) =>
                          setProduct({
                            ...product,
                            hardware_required: e.target.checked,
                          })
                        }
                        className="accent-primary w-4 h-4"
                      />
                      <span className="text-sm font-semibold">Requires extra hardware (screws, bearings, etc.)</span>
                    </label>
                  </div>
                </div>

                {product.hardware_required && (
                  <div>
                    <Label className="mb-2 block">Assembly Instructions / Hardware List</Label>
                    <Textarea
                      rows={4}
                      value={product.assembly_instructions || ""}
                      onChange={(e) =>
                        setProduct({ ...product, assembly_instructions: e.target.value })
                      }
                      placeholder="List M3 screws, magnets, glue required, or link to a guide..."
                    />
                  </div>
                )}
              </div>
            </Card>

          </div>

          {/* RIGHT SIDEBAR: Settings & Organization */}
          <div className="space-y-6">
            
            {/* ORGANIZATION */}
            <Card className="p-5 border-border bg-card shadow-sm">
              <h2 className="text-xs font-bold mb-4 uppercase tracking-wider text-muted-foreground">Product Organization</h2>
              <div>
                <Label className="mb-1.5 block">Category</Label>
                <Input
                  value={product.category || ""}
                  onChange={(e) =>
                    setProduct({ ...product, category: e.target.value })
                  }
                  placeholder="e.g. Tabletop, Gadgets"
                />
              </div>
            </Card>

            {/* PRICING & MODES */}
            <Card className="p-5 border-border bg-card shadow-sm">
              <h2 className="text-xs font-bold mb-4 uppercase tracking-wider text-muted-foreground">Pricing & Fulfillment</h2>
              <div className="space-y-5">
                {/* Mode 2 */}
                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="font-semibold text-sm group-hover:text-primary transition-colors">Digital Download</span>
                    <input type="checkbox" checked={product.is_mode_2_active} onChange={(e) => setProduct({ ...product, is_mode_2_active: e.target.checked })} className="accent-primary w-4 h-4 cursor-pointer" />
                  </label>
                  {product.is_mode_2_active && (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-data">$</span>
                      <Input type="number" step="0.01" value={product.price} onChange={(e) => setProduct({ ...product, price: parseFloat(e.target.value) })} className="pl-7 font-data" />
                    </div>
                  )}
                </div>
                
                <Separator />

                {/* Mode 3 */}
                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="font-semibold text-sm group-hover:text-primary transition-colors">Physical Print</span>
                    <input type="checkbox" checked={product.is_mode_3_active} onChange={(e) => setProduct({ ...product, is_mode_3_active: e.target.checked })} className="accent-primary w-4 h-4 cursor-pointer" />
                  </label>
                  {product.is_mode_3_active && (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-data">$</span>
                      <Input type="number" step="0.01" value={product.base_print_price} onChange={(e) => setProduct({ ...product, base_print_price: parseFloat(e.target.value) })} className="pl-7 font-data" />
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* GEOMETRY & VERSIONS */}
            <Card className="p-5 border-border bg-card shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Geometry Files</h2>
              </div>
              
              <label className="cursor-pointer flex items-center justify-center gap-2 rounded-lg text-sm font-semibold w-full py-2.5 bg-primary/5 text-primary border border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/10 transition-all mb-4">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploading ? "Uploading..." : "Upload New STL"}
                <input type="file" className="hidden" accept=".stl,.obj,.3mf,.step,.fbx,.blend" onChange={(e) => handleFileUpload(e, "model")} disabled={uploading} />
              </label>

              {product.versions && product.versions.length > 0 && (
                <div className="space-y-3">
                  {product.versions.sort((a: any, b: any) => b.version_number - a.version_number).map((v: any) => {
                    const report = v.printability_report;
                    return (
                      <div key={v.id} className={cn("p-3 rounded-xl border text-sm", v.is_latest ? "bg-card border-border shadow-sm" : "bg-muted/30 border-transparent")}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold font-data text-foreground flex items-center gap-2">
                            V{v.version_number}
                            {v.is_latest && <Badge variant="default" className="text-[9px] px-1.5 py-0 h-4">LATEST</Badge>}
                          </span>
                          <span className="text-muted-foreground text-[11px] font-data">{new Date(v.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="text-muted-foreground truncate mb-3 text-xs" title={v.file_name}>{v.file_name}</div>
                        
                        {report && (
                          <div className="flex items-center justify-between border-t border-border/60 pt-2 mt-2">
                            <span className="text-xs font-medium text-muted-foreground">Printability</span>
                            <Badge variant={report.status === "pass" ? "success" : report.status === "warning" ? "warning" : "destructive"} className="text-[10px] uppercase">
                              {report.status}
                            </Badge>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

          </div>
        </div>
      </div>
    </StudioShell>
  );
}
