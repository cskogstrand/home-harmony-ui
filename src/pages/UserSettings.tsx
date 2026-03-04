import { useState } from "react";
import { useTheme } from "next-themes";
import { useApp } from "@/contexts/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sun, Moon, Monitor, User, Globe, HeadsetIcon, AlertTriangle,
  Shield, ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";

type Environment = "production" | "test" | "development";

export default function UserSettingsPage() {
  const { theme, setTheme } = useTheme();
  const { currentUser, compactMode, toggleCompactMode } = useApp();
  const [environment, setEnvironment] = useState<Environment>("production");
  const [envDialogOpen, setEnvDialogOpen] = useState(false);
  const [pendingEnv, setPendingEnv] = useState<Environment>("production");

  const showSupport = currentUser.role === "support" || currentUser.role === "admin";

  const handleEnvChange = (env: string) => {
    const e = env as Environment;
    if (e !== environment) {
      setPendingEnv(e);
      setEnvDialogOpen(true);
    }
  };

  const confirmEnvChange = () => {
    setEnvironment(pendingEnv);
    setEnvDialogOpen(false);
    toast.success(`Switched to ${pendingEnv} environment`);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Account and app preferences</p>
      </motion.div>

      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" /> Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Name</span>
              <span className="text-sm font-medium">{currentUser.name}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-t">
              <span className="text-sm">Email</span>
              <span className="text-sm text-muted-foreground">{currentUser.email}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-t">
              <span className="text-sm">Role</span>
              <Badge variant="secondary" className="capitalize">{currentUser.role}</Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Appearance */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />} Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Dark Mode</Label>
                <p className="text-2xs text-muted-foreground">Switch between light and dark theme</p>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={v => setTheme(v ? "dark" : "light")}
                aria-label="Toggle dark mode"
              />
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <div>
                <Label className="text-sm">Compact Mode</Label>
                <p className="text-2xs text-muted-foreground">Denser layout for power users</p>
              </div>
              <Switch
                checked={compactMode}
                onCheckedChange={toggleCompactMode}
                aria-label="Toggle compact mode"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Environment */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4" /> Environment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Active Environment</Label>
                <p className="text-2xs text-muted-foreground">Switching resets your session credentials</p>
              </div>
              <Select value={environment} onValueChange={handleEnvChange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="test">Test</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {environment !== "production" && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-warning/10 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                <span>You are in <strong>{environment}</strong> environment. Data may differ from production.</span>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Support Tools */}
      {showSupport && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><HeadsetIcon className="h-4 w-4" /> Support Tools</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/support">
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2"><Shield className="h-4 w-4" /> Support Dashboard</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              <p className="text-2xs text-muted-foreground">Access support tools across all homes you manage.</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Environment switch confirmation dialog */}
      <Dialog open={envDialogOpen} onOpenChange={setEnvDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" /> Switch Environment
            </DialogTitle>
            <DialogDescription>
              You are about to switch to the <strong>{pendingEnv}</strong> environment.
              Your current session credentials will be reset and you may need to sign in again.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-warning/10 p-3 text-sm">
            <p className="font-medium text-warning-foreground">Warning:</p>
            <ul className="list-disc list-inside text-muted-foreground text-2xs mt-1 space-y-1">
              <li>All cached data will be cleared</li>
              <li>Active sessions will be terminated</li>
              <li>You will need to re-authenticate</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEnvDialogOpen(false)}>Cancel</Button>
            <Button variant="default" onClick={confirmEnvChange}>Switch to {pendingEnv}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
