"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const registerSchema = z
  .object({
    email: z.string().email("Please enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    role: z.enum(["customer", "creator", "print_partner"]),
    pincode: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

const roles = [
  {
    value: "customer" as const,
    label: "Customer",
    desc: "Browse and buy 3D products",
  },
  {
    value: "creator" as const,
    label: "Creator",
    desc: "Upload and sell 3D designs",
  },
  {
    value: "print_partner" as const,
    label: "Print Partner",
    desc: "Fulfill print orders",
  },
];

export default function RegisterPage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: "customer" },
  });

  const selectedRole = watch("role");

  const onSubmit = async (data: RegisterForm) => {
    try {
      await api.post("/api/auth/register", {
        email: data.email,
        password: data.password,
        role: data.role,
        pincode: data.pincode || null,
      });
      toast.success("Account created! Please log in.");
      router.push("/login");
    } catch (e: any) {
      toast.error(e.detail || "Registration failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 relative bg-background">
      {/* Background — Cure Violet radial */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(110,91,255,0.1),transparent_60%)]" />
        {/* Layer-line hairlines */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, var(--color-foreground) 0px, var(--color-foreground) 1px, transparent 1px, transparent 4px)",
          }}
        />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo — Space Grotesk */}
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold tracking-tight font-display inline-block">
            <span className="text-gradient-primary">3D</span>
            <span className="text-foreground">Verse</span>
          </Link>
        </div>

        <Card className="border-border/50">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-display">Create an account</CardTitle>
            <CardDescription>
              Join the 3DVerse community
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="email" className="mb-2 block">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-destructive text-xs mt-1">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="password" className="mb-2 block">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-destructive text-xs mt-1">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="mb-2 block">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword && (
                  <p className="text-destructive text-xs mt-1">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {/* Role Selection */}
              <div>
                <Label className="mb-3 block">I am a</Label>
                <div className="grid grid-cols-3 gap-2">
                  {roles.map((role) => (
                    <label
                      key={role.value}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border cursor-pointer transition-all text-center ${
                        selectedRole === role.value
                          ? "border-primary bg-primary-surface text-primary-ink"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <input
                        type="radio"
                        value={role.value}
                        {...register("role")}
                        className="sr-only"
                      />
                      <span className="text-sm font-semibold font-display">
                        {role.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        {role.desc}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {selectedRole === "print_partner" && (
                <div>
                  <Label htmlFor="pincode" className="mb-2 block">
                    Pincode (for order routing)
                  </Label>
                  <Input
                    id="pincode"
                    placeholder="e.g. 560001"
                    mono
                    {...register("pincode")}
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <UserPlus size={18} />
                    Create Account
                  </>
                )}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground mt-4">
              By creating an account you agree to our{" "}
              <Link href="/terms" className="underline hover:text-foreground">Terms</Link> and{" "}
              <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
            </p>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-primary hover:underline font-medium"
              >
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
