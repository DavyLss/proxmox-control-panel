import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/proxmox/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const { signIn, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [baseUrl, setBaseUrl] = useState(
    () => localStorage.getItem("pve.baseUrl") ?? "https://192.168.1.10:8006",
  );
  const [username, setUsername] = useState("root");
  const [realm, setRealm] = useState("pam");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    navigate({ to: "/dashboard" });
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn({ baseUrl, username, realm, password });
      localStorage.setItem("pve.baseUrl", baseUrl);
      toast.success("Connecté à Proxmox");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid place-items-center px-4 bg-gradient-to-br from-background via-background to-accent/30">
      <Card className="w-full max-w-md border-border/60 shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 grid place-items-center h-12 w-12 rounded-xl bg-primary/15 text-primary">
            <ServerCog className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Proxmox Console
          </CardTitle>
          <CardDescription>
            Connectez-vous avec votre compte Proxmox VE
          </CardDescription>
        </CardHeader>
        <CardContent>
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
          <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
            Les identifiants sont envoyés directement à votre serveur Proxmox. Le
            ticket d'authentification est conservé en session de votre navigateur.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}