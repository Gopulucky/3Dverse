"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Printer,
  Beaker,
  Image,
  FileCheck2,
  ArrowRight,
  ArrowLeft,
  Check,
  Rocket,
  Building2,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useRequireAuth } from "@/stores/auth-store";

const STEPS = [
  { icon: User, label: "Profile", desc: "Tell us about yourself" },
  { icon: Printer, label: "Equipment", desc: "Add your 3D printers" },
  { icon: Beaker, label: "Materials", desc: "What materials you stock" },
  { icon: Image, label: "Portfolio", desc: "Show off your work" },
  { icon: FileCheck2, label: "Terms & Go", desc: "Accept & launch" },
];

const SPECIALIZATION_OPTIONS = [
  "Prototyping", "Miniatures & Figurines", "Jewelry", "Mechanical Parts",
  "Architecture Models", "Cosplay & Props", "Art & Sculpture",
  "Custom Enclosures", "Drone Parts", "Medical Models",
];

const TECHNOLOGIES = [
  { value: "FDM", label: "FDM" },
  { value: "SLA", label: "SLA" },
  { value: "SLS", label: "SLS" },
  { value: "MJF", label: "MJF" },
  { value: "DLP", label: "DLP" },
  { value: "Other", label: "Other" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ready: isAuthenticated } = useRequireAuth();
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1: Profile
  const [profile, setProfile] = useState({
    full_name: "", bio: "", company_name: "",
    business_type: "individual", website_url: "", pincode: "",
  });

  // Step 2: Printer (simple inline add)
  const [printerForm, setPrinterForm] = useState({
    name: "", technology: "FDM", brand: "", model: "",
    build_volume_x: "", build_volume_y: "", build_volume_z: "",
  });
  const [addedPrinters, setAddedPrinters] = useState<any[]>([]);

  // Step 3: Materials
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<number[]>([]);

  // Step 5: Terms
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);

  // Check onboarding status
  const { data: onboardingStatus } = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: () => api.get<any>("/api/creator/onboarding/status"),
    enabled: isAuthenticated,
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["material-catalog"],
    queryFn: () => api.get<any[]>("/api/creator/materials/catalog"),
    enabled: isAuthenticated,
  });

  const { data: existingPrinters = [] } = useQuery({
    queryKey: ["creator-printers"],
    queryFn: () => api.get<any[]>("/api/creator/printers"),
    enabled: isAuthenticated,
  });

  const stepMutation = useMutation({
    mutationFn: (payload: any) => api.post("/api/creator/onboarding/step", payload),
  });

  const printerMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/creator/printers", data),
    onSuccess: (result: any) => {
      setAddedPrinters((prev) => [...prev, result]);
      setPrinterForm({ name: "", technology: "FDM", brand: "", model: "", build_volume_x: "", build_volume_y: "", build_volume_z: "" });
      queryClient.invalidateQueries({ queryKey: ["creator-printers"] });
      toast.success("Printer added!");
    },
    onError: (e: any) => toast.error(e.detail || "Failed"),
  });

  const materialMutation = useMutation({
    mutationFn: (materialId: number) =>
      api.post("/api/creator/materials/my-materials", { material_id: materialId }),
  });


  useEffect(() => {
    if (onboardingStatus?.onboarding_completed) {
      router.push("/creator/dashboard");
    } else if (onboardingStatus?.current_step > 0) {
      setCurrentStep(onboardingStatus.current_step);
    }
  }, [onboardingStatus, router]);

  if (!isAuthenticated) return null;

  async function goNext() {
    // Save current step data
    if (currentStep === 0) {
      await stepMutation.mutateAsync({
        step: 1,
        data: { ...profile },
      });
    } else if (currentStep === 1) {
      // Printers handled via direct API
      await stepMutation.mutateAsync({ step: 2, data: {} });
    } else if (currentStep === 2) {
      // Add selected materials
      for (const id of selectedMaterialIds) {
        try {
          await materialMutation.mutateAsync(id);
        } catch {
          // skip duplicates
        }
      }
      await stepMutation.mutateAsync({ step: 3, data: {} });
    } else if (currentStep === 3) {
      await stepMutation.mutateAsync({ step: 4, data: {} });
    } else if (currentStep === 4) {
      if (!termsAccepted) {
        toast.error("Please accept the terms to continue");
        return;
      }
      await stepMutation.mutateAsync({
        step: 5,
        data: { specializations: selectedSpecs },
      });
      toast.success("🎉 Onboarding complete! Welcome to Creator Studio!");
      queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
      router.push("/creator/dashboard");
      return;
    }

    setCurrentStep((prev) => Math.min(prev + 1, 4));
  }

  function goPrev() {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }

  const allPrinters = [...existingPrinters, ...addedPrinters];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(110,91,255,0.08),transparent_60%)]" />
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12 relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold font-display">
            <span className="text-gradient-primary">3D</span>
            <span>Verse</span>{" "}
            <span className="text-muted-foreground font-normal">Creator Studio</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            Let's set up your studio in a few steps
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-1 mb-10">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isPast = idx < currentStep;
            const isCurrent = idx === currentStep;
            return (
              <div key={idx} className="flex items-center">
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold transition-all ${
                    isPast
                      ? "bg-success/15 text-success"
                      : isCurrent
                      ? "bg-primary/15 text-primary ring-2 ring-primary/30"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isPast ? <Check size={12} /> : <Icon size={14} />}
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`w-6 h-px mx-1 ${isPast ? "bg-success" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <Card className="p-8 border-border bg-card mb-6">
          {/* Step 1: Profile */}
          {currentStep === 0 && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <User size={32} className="mx-auto text-primary mb-2" />
                <h2 className="text-2xl font-bold font-display">Your Profile</h2>
                <p className="text-sm text-muted-foreground">Basic info about you and your studio</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 block">Full Name *</Label>
                  <Input
                    required
                    placeholder="Your name"
                    value={profile.full_name}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Studio / Company Name</Label>
                  <Input
                    placeholder="e.g. PixelForge 3D"
                    value={profile.company_name}
                    onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Bio</Label>
                <textarea
                  className="w-full bg-card border border-input text-foreground text-sm rounded-md p-2.5 focus:ring-2 focus:ring-ring focus-visible:outline-none min-h-[80px] resize-y"
                  placeholder="Tell customers about your experience, skills, and what you specialize in..."
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 block">Business Type</Label>
                  <select
                    className="w-full bg-card border border-input text-foreground text-sm rounded-md p-2.5 focus:ring-2 focus:ring-ring focus-visible:outline-none"
                    value={profile.business_type}
                    onChange={(e) => setProfile({ ...profile, business_type: e.target.value })}
                  >
                    <option value="individual">Individual Creator</option>
                    <option value="company">Company / Studio</option>
                  </select>
                </div>
                <div>
                  <Label className="mb-2 block">Pincode (for order routing)</Label>
                  <Input
                    placeholder="e.g. 560001"
                    value={profile.pincode}
                    onChange={(e) => setProfile({ ...profile, pincode: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Equipment */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <Printer size={32} className="mx-auto text-primary mb-2" />
                <h2 className="text-2xl font-bold font-display">Your Equipment</h2>
                <p className="text-sm text-muted-foreground">Add at least one 3D printer</p>
              </div>

              {/* Added printers */}
              {allPrinters.length > 0 && (
                <div className="space-y-2 mb-4">
                  {allPrinters.map((p: any, i: number) => (
                    <div key={p.id || i} className="flex items-center gap-3 p-3 rounded-lg border border-success/30 bg-success/5">
                      <Check size={16} className="text-success shrink-0" />
                      <div>
                        <p className="font-semibold text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.technology} — {p.brand} {p.model}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick add form */}
              <Card className="p-4 border-border/50">
                <h3 className="text-sm font-semibold mb-3">Add a Printer</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    placeholder="Printer name *"
                    value={printerForm.name}
                    onChange={(e) => setPrinterForm({ ...printerForm, name: e.target.value })}
                  />
                  <select
                    className="w-full bg-card border border-input text-foreground text-sm rounded-md p-2.5 focus:ring-2 focus:ring-ring focus-visible:outline-none"
                    value={printerForm.technology}
                    onChange={(e) => setPrinterForm({ ...printerForm, technology: e.target.value })}
                  >
                    {TECHNOLOGIES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <Input
                    placeholder="Brand (e.g. Bambu Lab)"
                    value={printerForm.brand}
                    onChange={(e) => setPrinterForm({ ...printerForm, brand: e.target.value })}
                  />
                  <Input
                    placeholder="Model (e.g. X1 Carbon)"
                    value={printerForm.model}
                    onChange={(e) => setPrinterForm({ ...printerForm, model: e.target.value })}
                  />
                </div>
                <div className="mt-3">
                  <Label className="mb-1 block text-xs text-muted-foreground">Build Volume (mm) — optional</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Input type="number" placeholder="X" value={printerForm.build_volume_x} onChange={(e) => setPrinterForm({ ...printerForm, build_volume_x: e.target.value })} />
                    <Input type="number" placeholder="Y" value={printerForm.build_volume_y} onChange={(e) => setPrinterForm({ ...printerForm, build_volume_y: e.target.value })} />
                    <Input type="number" placeholder="Z" value={printerForm.build_volume_z} onChange={(e) => setPrinterForm({ ...printerForm, build_volume_z: e.target.value })} />
                  </div>
                </div>
                <Button
                  className="mt-3"
                  size="sm"
                  disabled={!printerForm.name || printerMutation.isPending}
                  onClick={() => {
                    printerMutation.mutate({
                      name: printerForm.name,
                      technology: printerForm.technology,
                      brand: printerForm.brand || null,
                      model: printerForm.model || null,
                      build_volume_x: printerForm.build_volume_x ? parseFloat(printerForm.build_volume_x) : null,
                      build_volume_y: printerForm.build_volume_y ? parseFloat(printerForm.build_volume_y) : null,
                      build_volume_z: printerForm.build_volume_z ? parseFloat(printerForm.build_volume_z) : null,
                    });
                  }}
                >
                  <Printer size={14} />
                  Add Printer
                </Button>
              </Card>
            </div>
          )}

          {/* Step 3: Materials */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <Beaker size={32} className="mx-auto text-primary mb-2" />
                <h2 className="text-2xl font-bold font-display">Your Materials</h2>
                <p className="text-sm text-muted-foreground">Select the materials you have in stock</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {catalog.map((mat: any) => {
                  const isSelected = selectedMaterialIds.includes(mat.id);
                  return (
                    <button
                      key={mat.id}
                      type="button"
                      onClick={() =>
                        setSelectedMaterialIds((prev) =>
                          isSelected
                            ? prev.filter((id) => id !== mat.id)
                            : [...prev, mat.id]
                        )
                      }
                      className={`p-4 rounded-lg border text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <p className="font-semibold text-sm">{mat.name}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{mat.category}</p>
                      <div className="flex gap-1 mt-2">
                        {mat.technology_compatibility?.map((t: string) => (
                          <Badge key={t} variant="outline" className="text-[9px] px-1 py-0">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Selected {selectedMaterialIds.length} materials. You can add more later.
              </p>
            </div>
          )}

          {/* Step 4: Portfolio */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <Image size={32} className="mx-auto text-primary mb-2" />
                <h2 className="text-2xl font-bold font-display">Portfolio Preview</h2>
                <p className="text-sm text-muted-foreground">
                  Upload photos of your best prints to build trust with customers.
                  <br />
                  <span className="text-xs">(You can skip this and add them later from Settings)</span>
                </p>
              </div>
              <Card className="p-8 border-dashed border-2 border-border text-center">
                <Image size={48} className="mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  Portfolio upload will be available from your Creator Settings page.
                  <br />For now, you can skip this step.
                </p>
                <Button variant="outline" onClick={() => router.push("/creator/settings")}>
                  Go to Settings to Upload
                </Button>
              </Card>
            </div>
          )}

          {/* Step 5: Terms */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <Rocket size={32} className="mx-auto text-primary mb-2" />
                <h2 className="text-2xl font-bold font-display">Almost There!</h2>
                <p className="text-sm text-muted-foreground">
                  Choose your specializations and accept the terms
                </p>
              </div>

              {/* Specializations */}
              <div>
                <Label className="mb-3 block">What do you specialize in?</Label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALIZATION_OPTIONS.map((spec) => {
                    const isSelected = selectedSpecs.includes(spec);
                    return (
                      <button
                        key={spec}
                        type="button"
                        onClick={() =>
                          setSelectedSpecs((prev) =>
                            isSelected ? prev.filter((s) => s !== spec) : [...prev, spec]
                          )
                        }
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          isSelected
                            ? "bg-primary/15 border-primary text-primary"
                            : "border-border text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {spec}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Terms */}
              <Card className="p-4 border-border bg-muted/30">
                <h3 className="font-bold text-sm mb-2">Creator Terms of Service</h3>
                <ul className="text-xs text-muted-foreground space-y-1 mb-4">
                  <li>• I will maintain quality standards for all printed products</li>
                  <li>• I will fulfill orders within the committed delivery timeline</li>
                  <li>• I agree to the platform's commission structure</li>
                  <li>• I will respond to customer inquiries within 24 hours</li>
                  <li>• I confirm all equipment and material declarations are accurate</li>
                  <li>• I agree to 3DVerse's IP protection and content policies</li>
                </ul>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-semibold">
                    I accept the Creator Terms of Service
                  </span>
                </label>
              </Card>
            </div>
          )}
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="ghost"
            onClick={goPrev}
            disabled={currentStep === 0}
          >
            <ArrowLeft size={16} />
            Back
          </Button>
          <Button onClick={goNext} disabled={stepMutation.isPending}>
            {currentStep === 4 ? (
              <>
                <Rocket size={16} />
                Launch Creator Studio
              </>
            ) : (
              <>
                Continue
                <ArrowRight size={16} />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
