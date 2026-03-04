import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { StateWrapper } from "@/components/common/StateWrapper";
import { PinPadModal } from "@/components/devices/PinPadModal";
import {
  Shield, ShieldAlert, ShieldCheck, Sun, Moon, Clock, Users, Radio,
  DoorOpen, AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import type { AlarmMode } from "@/types/api";

const profileConfig: Record<string, { label: string; icon: React.ElementType; description: string }> = {
  armed: { label: "Away", icon: ShieldAlert, description: "All sensors active. Full protection." },
  nightArmed: { label: "Night", icon: Moon, description: "Perimeter sensors active, interior motion ignored." },
  dayArmed: { label: "Custom", icon: Sun, description: "Custom sensor selection for daytime." },
};

export default function AlarmPage() {
  const { currentHome, currentUser } = useApp();
  const [pinOpen, setPinOpen] = useState(false);
  const [targetMode, setTargetMode] = useState<AlarmMode>("disarmed");

  if (!currentHome) return <StateWrapper state="loading"><div /></StateWrapper>;

  const profile = currentHome.activeProfile;
  const profiles = currentHome.profiles;
  const isMaster = currentUser.role === "master" || currentUser.role === "admin";
  const allDevices = currentHome.rooms.flatMap(r => r.devices);
  const alarmDevices = allDevices.filter(d => d.alarmDevice);
  const entranceDevices = allDevices.filter(d =>
    d.type === "sensorContactDoor" || d.type === "magnetContact" || d.type === "sensorContact"
  );

  const handleArm = (mode: AlarmMode) => {
    setTargetMode(mode);
    setPinOpen(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Current Status */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Alarm</h1>
          <Badge variant={profile?.mode === "disarmed" ? "secondary" : "destructive"} className="gap-1.5">
            <Shield className="h-3 w-3" />
            {profile?.mode === "disarmed" ? "Disarmed" : profile?.mode === "armed" ? "Armed" : profile?.mode === "nightArmed" ? "Night Armed" : "Day Armed"}
          </Badge>
        </div>
      </motion.div>

      {/* Quick Arm Buttons */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {profile?.mode !== "disarmed" && (
              <Button variant="outline" className="gap-2" onClick={() => handleArm("disarmed")}>
                <ShieldCheck className="h-4 w-4" /> Disarm
              </Button>
            )}
            {Object.entries(profileConfig).map(([mode, cfg]) => (
              <Button key={mode} variant={profile?.mode === mode ? "default" : "outline"} className="gap-2"
                onClick={() => handleArm(mode as AlarmMode)} disabled={profile?.mode === mode}>
                <cfg.icon className="h-4 w-4" /> {cfg.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* Profile Settings */}
      <Tabs defaultValue="armed">
        <TabsList>
          {Object.entries(profileConfig).map(([mode, cfg]) => (
            <TabsTrigger key={mode} value={mode} className="gap-1.5">
              <cfg.icon className="h-3.5 w-3.5" /> {cfg.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(profileConfig).map(([mode, cfg]) => {
          const profileSettings = profiles?.[mode as keyof typeof profiles];
          const assignedDevices = alarmDevices.filter(d => d.profiles?.includes(mode));
          const delayDevices = entranceDevices.filter(d => d.profiles?.includes(mode));

          return (
            <TabsContent key={mode} value={mode} className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <cfg.icon className="h-4 w-4" /> {cfg.label} Profile
                  </CardTitle>
                  <p className="text-2xs text-muted-foreground">{cfg.description}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Entry/Exit Duration */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Entry Delay</span>
                      <span className="ml-auto text-sm font-bold">{profileSettings?.entryDuration ?? 30}s</span>
                    </div>
                    {isMaster && (
                      <Slider
                        value={[profileSettings?.entryDuration ?? 30]}
                        min={0} max={120} step={5}
                        onValueChange={v => toast.info(`Entry delay set to ${v[0]}s (mock)`)}
                        aria-label="Entry delay"
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Exit Delay</span>
                      <span className="ml-auto text-sm font-bold">{profileSettings?.exitDuration ?? 30}s</span>
                    </div>
                    {isMaster && (
                      <Slider
                        value={[profileSettings?.exitDuration ?? 30]}
                        min={0} max={120} step={5}
                        onValueChange={v => toast.info(`Exit delay set to ${v[0]}s (mock)`)}
                        aria-label="Exit delay"
                      />
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Alarm Devices */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Radio className="h-4 w-4" /> Alarm Devices ({assignedDevices.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {assignedDevices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No devices assigned to this profile.</p>
                  ) : (
                    <div className="space-y-2">
                      {assignedDevices.map(d => (
                        <div key={d.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <p className="text-sm font-medium">{d.name}</p>
                            <p className="text-2xs text-muted-foreground">{d.displayType}</p>
                          </div>
                          {isMaster && (
                            <Switch defaultChecked aria-label={`Toggle ${d.name} for ${cfg.label}`}
                              onCheckedChange={v => toast.info(`${d.name} ${v ? "enabled" : "disabled"} for ${cfg.label} (mock)`)} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Entrance Sensors with Delay */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DoorOpen className="h-4 w-4" /> Entrance Sensors (with delay)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {delayDevices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No entrance sensors configured.</p>
                  ) : (
                    <div className="space-y-2">
                      {delayDevices.map(d => (
                        <div key={d.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <p className="text-sm font-medium">{d.name}</p>
                            <p className="text-2xs text-muted-foreground">Entry delay applies</p>
                          </div>
                          <Badge variant="outline" className="text-2xs">
                            <Clock className="h-3 w-3 mr-1" /> {profileSettings?.entryDuration ?? 30}s
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Users & Access */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" /> Users & Access
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {currentHome.users.map(u => (
                      <div key={u.email} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{u.name}</p>
                          <p className="text-2xs text-muted-foreground capitalize">{u.role}</p>
                        </div>
                        <Badge variant="secondary" className="text-2xs capitalize">{u.role}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {!isMaster && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 text-sm">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                  <span>Only master users can edit alarm settings.</span>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      <PinPadModal
        open={pinOpen}
        onOpenChange={setPinOpen}
        title={targetMode === "disarmed" ? "Disarm Alarm" : `Arm: ${profileConfig[targetMode]?.label ?? targetMode}`}
        description="Enter your alarm PIN to confirm."
        variant="alarm"
        onSubmit={() => toast.success(`Alarm ${targetMode === "disarmed" ? "disarmed" : "armed"} (mock)`)}
      />
    </div>
  );
}
