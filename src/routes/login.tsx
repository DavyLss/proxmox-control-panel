import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/proxmox/auth-context";
import type { ProxmoxTfaChallenge } from "@/lib/proxmox/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ServerCog } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, completeTfa, isAuthenticated, isRestored } = useAuth();
  const [baseUrl, setBaseUrl] = useState("https://192.168.1.10:8006");
  const [username, setUsername] = useState("root");
  const [realm, setRealm] = useState("pam");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [tfa, setTfa] = useState<ProxmoxTfaChallenge | null>(null);
  const [tfaCode, setTfaCode] = useState("");
  const [tfaKind, setTfaKind] = useState<"totp" | "recovery">("totp");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("pve.baseUrl");
    if (saved) setBaseUrl(saved);
  }, []);

  useEffect(() => {
    if (isRestored && isAuthenticated && typeof window !== "undefined") {
      window.location.replace("/dashboard");
    }
  }, [isAuthenticated, isRestored]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await signIn({ baseUrl, username, realm, password });
      window.localStorage.setItem("pve.baseUrl", baseUrl);
      if (r.tfa) {
        setTfa(r.tfa);
        setTfaKind(r.tfa.types.totp ? "totp" : "recovery");
        toast.message("Authentification à deux facteurs requise");
      } else {
        toast.success("Connecté à Proxmox");
        if (typeof window !== "undefined") {
          window.location.assign("/dashboard");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de connexion");
    } finally {
      setLoading(false);
    }
  };

  const onSubmitTfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tfa) return;
    setLoading(true);
    try {
      await completeTfa(tfa, tfaCode.replace(/\s+/g, ""), tfaKind);
      toast.success("Connecté à Proxmox");
      if (typeof window !== "undefined") {
        window.location.assign("/dashboard");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Code 2FA invalide");
    } finally {
      setLoading(false);
    }
  };

  if (!isRestored) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Restauration de la session…
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full grid place-items-center px-4 bg-gradient-to-br from-background via-background to-accent/30">
      <Card className="w-full max-w-md border-border/60 shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 grid place-items-center h-12 w-12 rounded-xl bg-primary/15 text-primary">
            <ServerCog className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight">Proxmox Console</CardTitle>
          <CardDescription>
            {tfa
              ? "Saisissez votre code à deux facteurs"
              : "Connectez-vous avec votre compte Proxmox VE"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tfa ? (
            <form onSubmit={onSubmitTfa} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Méthode</Label>
                <Select value={tfaKind} onValueChange={(v) => setTfaKind(v as "totp" | "recovery")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tfa.types.totp && <SelectItem value="totp">TOTP (application)</SelectItem>}
                    {tfa.types.recovery && (
                      <SelectItem value="recovery">Clé de récupération</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tfa">Code</Label>
                <Input
                  id="tfa"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder={tfaKind === "totp" ? "123456" : "xxxx-xxxx"}
                  value={tfaCode}
                  onChange={(e) => setTfaCode(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setTfa(null);
                    setTfaCode("");
                  }}
                >
                  Retour
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Vérification…" : "Valider"}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="url">URL du serveur</Label>
                <Input
                  id="url"
                  placeholder="https://pve.local:8006"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="user">Utilisateur</Label>
                  <Input
                    id="user"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Realm</Label>
                  <Select value={realm} onValueChange={setRealm}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pam">pam</SelectItem>
                      <SelectItem value="pve">pve</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pwd">Mot de passe</Label>
                <Input
                  id="pwd"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Connexion…" : "Se connecter"}
              </Button>
            </form>
          )}
          <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
            Les identifiants sont envoyés directement à votre serveur Proxmox. Le ticket
            d'authentification est conservé en session de votre navigateur.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
