import { useApp } from "@/contexts/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Bell, BellOff, Smartphone, Mail } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const categories = [
  { key: "alarms", label: "Alarm events", desc: "Armed, disarmed, triggered", enabled: true },
  { key: "devices", label: "Device alerts", desc: "Offline, low battery, errors", enabled: true },
  { key: "moods", label: "Mood changes", desc: "When moods are activated", enabled: false },
  { key: "energy", label: "Energy saver", desc: "Throttling, price alerts", enabled: true },
  { key: "gateway", label: "Gateway status", desc: "Online/offline changes", enabled: true },
  { key: "users", label: "User changes", desc: "Added, removed, permissions", enabled: false },
];

export default function NotificationsPage() {
  const { currentHome } = useApp();

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold">Notifications</h1>
      <p className="text-sm text-muted-foreground">
        Manage notifications for {currentHome?.name ?? "your home"}.
      </p>

      {/* Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Delivery channels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Push notifications</span>
            </div>
            <Switch defaultChecked onCheckedChange={() => toast.success("Push setting updated")} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Email digest</span>
            </div>
            <Switch onCheckedChange={() => toast.success("Email setting updated")} />
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Event categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 divide-y">
          {categories.map(cat => (
            <div key={cat.key} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium">{cat.label}</p>
                <p className="text-2xs text-muted-foreground">{cat.desc}</p>
              </div>
              <Switch defaultChecked={cat.enabled}
                onCheckedChange={(v) => toast.success(`${cat.label} ${v ? "enabled" : "disabled"}`)} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
