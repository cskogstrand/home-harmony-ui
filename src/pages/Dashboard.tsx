import { useApp } from "@/contexts/AppContext";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Shield, ShieldCheck, ShieldAlert, Sun, Moon, Sunrise,
  AlertTriangle, Lightbulb, Thermometer, Lock, Activity,
  ChevronRight, Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { AlarmMode } from "@/types/api";
import { formatDistanceToNow } from "date-fns";

const alarmConfig: Record<AlarmMode, { label: string; icon: React.ElementType; variant: "online" | "warning" | "safety" | "info" }> = {
  disarmed: { label: "Disarmed", icon: Shield, variant: "online" },
  armed: { label: "Armed", icon: ShieldAlert, variant: "safety" },
  dayArmed: { label: "Day Armed", icon: Sun, variant: "warning" },
  nightArmed: { label: "Night Armed", icon: Moon, variant: "info" },
};

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25 },
};

export default function DashboardPage() {
  const { currentHome } = useApp();
  if (!currentHome) return null;

  const profile = currentHome.activeProfile;
  const alarm = profile ? alarmConfig[profile.mode] : null;
  const onlineDevices = currentHome.rooms.flatMap(r => r.devices).filter(d => d.online).length;
  const totalDevices = currentHome.rooms.flatMap(r => r.devices).length;
  const warnings = currentHome.warnings;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Welcome + alarm */}
      <motion.div {...fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{currentHome.name}</h1>
          <p className="text-sm text-muted-foreground">{currentHome.address?.city ?? "Home"}</p>
        </div>
        {alarm && (
          <div className={`flex items-center gap-3 rounded-lg px-4 py-3 ${
            profile!.mode === "armed" ? "bg-safety/10 safety-glow" :
            profile!.mode === "disarmed" ? "bg-success/10" : "bg-warning/10 warning-glow"
          }`}>
            <alarm.icon className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold">{alarm.label}</p>
              <p className="text-2xs text-muted-foreground">
                {formatDistanceToNow(new Date(profile!.modeChangedAt), { addSuffix: true })}
              </p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <motion.div {...fadeUp} transition={{ delay: 0.05, duration: 0.25 }}>
          <Card className="border-warning/30 bg-warning/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning" />
                {warnings.length} Warning{warnings.length > 1 ? "s" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {warnings.map(w => (
                <div key={w.id} className="flex items-start gap-2 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
                  <span className="text-foreground">{w.message}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Quick stats */}
      <motion.div {...fadeUp} transition={{ delay: 0.1, duration: 0.25 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickStat icon={Lightbulb} label="Devices" value={`${onlineDevices}/${totalDevices}`} sub="online" />
        <QuickStat icon={Thermometer} label="Avg Temp" value="21.5°C" sub="bedroom" />
        <QuickStat icon={Lock} label="Locks" value="Locked" sub="all secure" />
        <QuickStat icon={Zap} label="Energy" value="2.1 kW" sub="current draw" />
      </motion.div>

      {/* Rooms overview */}
      <motion.div {...fadeUp} transition={{ delay: 0.15, duration: 0.25 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Rooms</h2>
          <Link to="/rooms" className="text-xs text-primary font-medium hover:underline">View all</Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {currentHome.rooms.map(room => (
            <Link to={`/rooms/${room.id}`} key={room.id}>
              <Card className="hover:shadow-card-hover transition-shadow cursor-pointer group">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{room.name}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <p className="text-2xs text-muted-foreground">
                    {room.devices.length} device{room.devices.length !== 1 ? "s" : ""}
                    {room.devices.some(d => !d.online) && " · ⚠ offline"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Recent events */}
      <motion.div {...fadeUp} transition={{ delay: 0.2, duration: 0.25 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
          <Link to="/history" className="text-xs text-primary font-medium hover:underline">View all</Link>
        </div>
        <Card>
          <CardContent className="p-0 divide-y">
            {currentHome.recentEvents.slice(0, 5).map(event => (
              <div key={event.id} className="flex items-start gap-3 px-4 py-3">
                <Activity className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{event.title}</p>
                  <p className="text-2xs text-muted-foreground">{event.bodyText}</p>
                </div>
                <span className="text-2xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function QuickStat({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: string; sub: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-2xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
        </div>
        <p className="text-lg font-bold text-foreground">{value}</p>
        <p className="text-2xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
