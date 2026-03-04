import { useApp } from "@/contexts/AppContext";
import { Card, CardContent } from "@/components/ui/card";
import { StateWrapper } from "@/components/common/StateWrapper";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Search, Filter } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const iconColors: Record<string, string> = {
  warning: "text-warning", warningCleared: "text-success",
  alarmArmed: "text-safety", alarmDayArmed: "text-warning", alarmNightArmed: "text-info", alarmDisarmed: "text-success",
  deviceOffline: "text-destructive", deviceOnline: "text-success",
  gatewayOffline: "text-destructive", gatewayOnline: "text-success",
  batteryLow: "text-warning", batteryOk: "text-success",
  opened: "text-warning", closed: "text-success",
  moodActivated: "text-primary",
};

export default function HistoryPage() {
  const { currentHome } = useApp();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  if (!currentHome) return <StateWrapper state="loading"><div /></StateWrapper>;

  const events = currentHome.recentEvents.filter(e => {
    if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !e.bodyText.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter !== "all" && e.iconType !== filter) return false;
    return true;
  });

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold">History</h1>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search events…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[140px]">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            <SelectItem value="alarmArmed">Alarm</SelectItem>
            <SelectItem value="deviceOffline">Device</SelectItem>
            <SelectItem value="moodActivated">Mood</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <StateWrapper state={events.length === 0 ? "empty" : "success"}
        emptyTitle="No events found" emptyDescription="Events from your home will appear here.">
        <Card>
          <CardContent className="p-0 divide-y">
            {events.map((event, i) => (
              <motion.div key={event.id}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02, duration: 0.15 }}
                className="flex items-start gap-3 px-4 py-3">
                <div className={`mt-1 ${iconColors[event.iconType] ?? "text-muted-foreground"}`}>
                  <Activity className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{event.title}</p>
                  <p className="text-2xs text-muted-foreground">{event.bodyText}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xs text-muted-foreground">{formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}</p>
                  <p className="text-2xs text-muted-foreground/60">{format(new Date(event.timestamp), "HH:mm")}</p>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
        <div className="text-center pt-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground">Load more</Button>
        </div>
      </StateWrapper>
    </div>
  );
}
