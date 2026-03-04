import { useParams, Link } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { StateWrapper } from "@/components/common/StateWrapper";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, AlertTriangle, Download, Trash2, RotateCcw,
  Eye, Settings, Info,
} from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import type { DeviceAttribute } from "@/types/api";

export default function DeviceDetailPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { currentHome, currentUser } = useApp();
  const [showDelete, setShowDelete] = useState(false);

  if (!currentHome) return <StateWrapper state="loading"><div /></StateWrapper>;

  const device = currentHome.rooms.flatMap(r => r.devices).find(d => d.id === deviceId);
  if (!device) return <StateWrapper state="error" errorTitle="Device not found" errorDescription="This device may have been removed."><div /></StateWrapper>;

  const room = currentHome.rooms.find(r => r.devices.some(d => d.id === device.id));
  const isMaster = currentUser.role === "master" || currentUser.role === "admin";

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Link to="/devices" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 touch-target">
          <ArrowLeft className="h-4 w-4" />
          Devices
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{device.name}</h1>
            <p className="text-sm text-muted-foreground">{device.displayType} · {device.vendor} {device.model}</p>
          </div>
          <StatusBadge variant={device.online ? "online" : "offline"}>
            {device.online ? "Online" : "Offline"}
          </StatusBadge>
        </div>
      </motion.div>

      {/* Warning */}
      {device.troubleshooting && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Troubleshooting needed</p>
              <p className="text-sm text-muted-foreground">{device.troubleshooting}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Software update */}
      {device.softwareUpdate && (
        <Card className="border-info/30 bg-info/5">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <Download className="h-5 w-5 text-info" />
              <div>
                <p className="text-sm font-medium">Update available</p>
                <p className="text-2xs text-muted-foreground">v{device.softwareUpdate.version} · {device.softwareUpdate.status}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => toast.success("Update started", { description: "This may take a few minutes." })}>
              Update
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Attributes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Controls & Attributes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {device.attributes.map(attr => (
            <AttributeRow key={attr.name} attr={attr} />
          ))}
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4" /> Device Info
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <InfoRow label="Vendor" value={device.vendor} />
          <InfoRow label="Model" value={device.model} />
          <InfoRow label="Software" value={`v${device.softwareVersion}`} />
          <InfoRow label="Hardware" value={device.hardwareVersion ?? "—"} />
          <InfoRow label="Room" value={room?.name ?? "Unassigned"} />
          <InfoRow label="ID" value={device.id} />
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" /> Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {device.supportsIdentify && (
            <Button variant="outline" size="sm" className="w-full justify-start gap-2"
              onClick={() => toast.info("Identify sent", { description: "The device should blink." })}>
              <Eye className="h-4 w-4" /> Identify Device
            </Button>
          )}
          <Button variant="outline" size="sm" className="w-full justify-start gap-2"
            onClick={() => toast.info("Reading diagnostics…")}>
            <RotateCcw className="h-4 w-4" /> Read Diagnostics
          </Button>
          {isMaster && (
            <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-destructive hover:text-destructive"
              onClick={() => setShowDelete(true)}>
              <Trash2 className="h-4 w-4" /> Remove Device
            </Button>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Remove device?"
        description={`"${device.name}" will be permanently removed from your home. This action cannot be undone.`}
        confirmLabel="Remove"
        destructive
        onConfirm={() => { setShowDelete(false); toast.success("Device removed"); }}
      />
    </div>
  );
}

function AttributeRow({ attr }: { attr: DeviceAttribute }) {
  const [localValue, setLocalValue] = useState(attr.value);

  if (typeof attr.value === "boolean") {
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground">{attr.name}</span>
        <Switch
          checked={localValue as boolean}
          onCheckedChange={(v) => { setLocalValue(v); toast.success(`${attr.name} ${v ? "on" : "off"}`); }}
          aria-label={`Toggle ${attr.name}`}
        />
      </div>
    );
  }

  if (typeof attr.value === "number" && attr.minValue !== undefined && attr.maxValue !== undefined) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">{attr.name}</span>
          <span className="text-sm font-medium">{localValue as number}{attr.unit ?? ""}</span>
        </div>
        <Slider
          value={[localValue as number]}
          min={attr.minValue as number}
          max={attr.maxValue as number}
          step={attr.step ?? 1}
          onValueChange={([v]) => setLocalValue(v)}
          onValueCommit={([v]) => toast.success(`${attr.name} set to ${v}${attr.unit ?? ""}`)}
          aria-label={attr.name}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{attr.name}</span>
      <span className="text-sm font-medium">{String(attr.value)}{attr.unit ?? ""}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xs text-muted-foreground">{label}</p>
      <p className="font-medium truncate">{value}</p>
    </div>
  );
}
