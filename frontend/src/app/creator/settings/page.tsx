"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Settings,
  User,
  Building2,
  Globe,
  Save,
  MapPin,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useRequireRole } from "@/stores/auth-store";
import { StudioShell } from "@/components/layout/studio-shell";
import { DeleteAccountCard } from "@/components/settings/delete-account";
import { getCreatorPath, useCreatorType } from "@/lib/creator-nav";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";

const SPECIALIZATION_OPTIONS = [
  "Prototyping",
  "Miniatures & Figurines",
  "Jewelry",
  "Mechanical Parts",
  "Architecture Models",
  "Cosplay & Props",
  "Art & Sculpture",
  "Custom Enclosures",
  "Drone Parts",
  "Medical Models",
  "Automotive Parts",
  "Educational Models",
];

export default function CreatorSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ready: isAuthenticated } = useRequireRole(["creator", "admin"]);
  const { creatorType } = useCreatorType();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["creator-profile"],
    queryFn: () => api.get<any>("/api/creator/profile"),
    enabled: isAuthenticated,
  });

  const [form, setForm] = useState({
    full_name: "",
    bio: "",
    company_name: "",
    business_type: "individual",
    tax_id: "",
    website_url: "",
    pincode: "",
    social_instagram: "",
    social_twitter: "",
    social_youtube: "",
    specializations: [] as string[],
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        bio: profile.bio || "",
        company_name: profile.company_name || "",
        business_type: profile.business_type || "individual",
        tax_id: profile.tax_id || "",
        website_url: profile.website_url || "",
        pincode: profile.pincode || "",
        social_instagram: profile.social_links?.instagram || "",
        social_twitter: profile.social_links?.twitter || "",
        social_youtube: profile.social_links?.youtube || "",
        specializations: profile.specializations || [],
      });
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put("/api/creator/profile", data),
    onSuccess: () => {
      toast.success("Profile updated!");
      queryClient.invalidateQueries({ queryKey: ["creator-profile"] });
    },
    onError: (e: any) => toast.error(e.detail || "Failed to update profile"),
  });


  if (!isAuthenticated) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const social_links: Record<string, string> = {};
    if (form.social_instagram) social_links.instagram = form.social_instagram;
    if (form.social_twitter) social_links.twitter = form.social_twitter;
    if (form.social_youtube) social_links.youtube = form.social_youtube;

    updateMutation.mutate({
      full_name: form.full_name || null,
      bio: form.bio || null,
      company_name: form.company_name || null,
      business_type: form.business_type,
      tax_id: form.tax_id || null,
      website_url: form.website_url || null,
      pincode: form.pincode || null,
      social_links: Object.keys(social_links).length > 0 ? social_links : null,
      specializations: form.specializations.length > 0 ? form.specializations : null,
    });
  }

  function toggleSpec(spec: string) {
    setForm((prev) => ({
      ...prev,
      specializations: prev.specializations.includes(spec)
        ? prev.specializations.filter((s) => s !== spec)
        : [...prev.specializations, spec],
    }));
  }

  const TIER_COLORS: Record<string, string> = {
    bronze: "text-warning",
    silver: "text-muted-foreground",
    gold: "text-warning",
    platinum: "text-primary",
  };

  const content = (
    <div className="max-w-4xl mx-auto px-6 pt-24 pb-20">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 font-display">
            <Settings className="text-primary" />
            Creator Settings
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Manage your profile, business identity, and specializations.
          </p>
        </div>
        {profile?.creator_tier && (
          <Badge variant="outline" className={`text-sm ${TIER_COLORS[profile.creator_tier] || ""}`}>
            {profile.creator_tier.toUpperCase()} Creator
          </Badge>
        )}
      </div>

      {/* Creator path — set once on entering the studio, immutable afterwards */}
      {(() => {
        const path = getCreatorPath(profile?.creator_type || creatorType);
        if (!path) return null;
        return (
          <Card className="p-6 border-border mb-8">
            <h2 className="text-lg font-bold mb-4 font-display flex items-center gap-2">
              <Lock size={18} />
              Creator Path
            </h2>
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                  path.accentBg
                )}
              >
                <path.icon size={24} className={path.accent} />
              </div>
              <div>
                <p className="font-bold">{path.label}</p>
                <p className={cn("text-sm font-medium", path.accent)}>{path.tagline}</p>
                <p className="text-sm text-muted-foreground mt-2">{path.description}</p>
                <p className="text-xs text-muted-foreground mt-3">
                  This path is permanent. To operate differently you would need to delete
                  this account and register again.
                </p>
              </div>
            </div>
          </Card>
        );
      })()}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Personal Info */}
        <Card className="p-6 border-border">
          <h2 className="text-lg font-bold mb-4 font-display flex items-center gap-2">
            <User size={18} />
            Personal Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-2 block">Full Name</Label>
              <Input
                placeholder="Your full name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-2 block">Email</Label>
              <Input value={profile?.email || ""} disabled className="opacity-60" />
            </div>
            <div className="md:col-span-2">
              <Label className="mb-2 block">Bio</Label>
              <textarea
                className="w-full bg-card border border-input text-foreground text-sm rounded-md p-2.5 focus:ring-2 focus:ring-ring focus-visible:outline-none min-h-[80px] resize-y"
                placeholder="Tell customers about yourself and your work..."
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </div>
          </div>
        </Card>

        {/* Business Identity */}
        <Card className="p-6 border-border">
          <h2 className="text-lg font-bold mb-4 font-display flex items-center gap-2">
            <Building2 size={18} />
            Business Identity
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-2 block">Company / Studio Name</Label>
              <Input
                placeholder="Your studio name"
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-2 block">Business Type</Label>
              <select
                className="w-full bg-card border border-input text-foreground text-sm rounded-md p-2.5 focus:ring-2 focus:ring-ring focus-visible:outline-none"
                value={form.business_type}
                onChange={(e) => setForm({ ...form, business_type: e.target.value })}
              >
                <option value="individual">Individual</option>
                <option value="company">Company / Studio</option>
              </select>
            </div>
            <div>
              <Label className="mb-2 block">GST / Tax ID</Label>
              <Input
                placeholder="e.g. 22AAAAA0000A1Z5"
                value={form.tax_id}
                onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-2 block flex items-center gap-1">
                <MapPin size={14} /> Pincode (for order routing)
              </Label>
              <Input
                placeholder="e.g. 560001"
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value })}
              />
            </div>
          </div>
        </Card>

        {/* Social & Web */}
        <Card className="p-6 border-border">
          <h2 className="text-lg font-bold mb-4 font-display flex items-center gap-2">
            <Globe size={18} />
            Web & Social Links
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-2 block">Website</Label>
              <Input
                placeholder="https://your-studio.com"
                value={form.website_url}
                onChange={(e) => setForm({ ...form, website_url: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-2 block">Instagram</Label>
              <Input
                placeholder="@yourstudio"
                value={form.social_instagram}
                onChange={(e) => setForm({ ...form, social_instagram: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-2 block">Twitter / X</Label>
              <Input
                placeholder="@yourstudio"
                value={form.social_twitter}
                onChange={(e) => setForm({ ...form, social_twitter: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-2 block">YouTube</Label>
              <Input
                placeholder="youtube.com/@yourstudio"
                value={form.social_youtube}
                onChange={(e) => setForm({ ...form, social_youtube: e.target.value })}
              />
            </div>
          </div>
        </Card>

        {/* Specializations */}
        <Card className="p-6 border-border">
          <h2 className="text-lg font-bold mb-4 font-display">
            Specializations
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Select the types of work you specialize in. This helps customers find you.
          </p>
          <div className="flex flex-wrap gap-2">
            {SPECIALIZATION_OPTIONS.map((spec) => {
              const isSelected = form.specializations.includes(spec);
              return (
                <button
                  key={spec}
                  type="button"
                  onClick={() => toggleSpec(spec)}
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
        </Card>

        {/* Save */}
        <div className="flex justify-end">
          <Button
            type="submit"
            size="lg"
            disabled={updateMutation.isPending}
          >
            <Save size={18} />
            Save Settings
          </Button>
        </div>
      </form>

      <DeleteAccountCard
        email={profile?.email || ""}
        note="This is also the only way to change your locked creator path."
      />
    </div>
  );

  return (
    <StudioShell>
      {isLoading ? (
        <div className="max-w-4xl mx-auto px-6 pt-24 pb-20 space-y-6">
          <Skeleton className="h-10 w-64" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : (
        content
      )}
    </StudioShell>
  );
}
