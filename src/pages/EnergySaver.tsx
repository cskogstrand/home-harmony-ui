import { useApp } from "@/contexts/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StateWrapper } from "@/components/common/StateWrapper";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, TrendingDown, Thermometer, Car, Droplets, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

export default function EnergySaverPage() {
  const { currentHome } = useApp();
  if (!currentHome) return <StateWrapper state="loading"><div /></StateWrapper>;

  const devices = currentHome.rooms.flatMap(r => r.devices).filter(d => d.eligibleForEnergySaver);
  const away = currentHome.energySaver?.away;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Energy Saver</h1>
        <StatusBadge variant={away?.enabled ? "online" : "offline"}>
          {away?.enabled ? "Away mode on" : "Home mode"}
        </StatusBadge>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Zap} label="Current" value="2.1 kW" />
        <StatCard icon={TrendingDown} label="Saved today" value="3.2 kWh" />
        <StatCard icon={BarChart3} label="Price now" value="0.85 NOK/kWh" />
        <StatCard icon={TrendingDown} label="Monthly est." value="920 NOK" />
      </div>

      <Tabs defaultValue="devices">
        <TabsList>
          <TabsTrigger value="devices" className="gap-1.5"><Zap className="h-3.5 w-3.5" /> Devices</TabsTrigger>
          <TabsTrigger value="consumption" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Consumption</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="mt-4">
          <StateWrapper state={devices.length === 0 ? "empty" : "success"}
            emptyTitle="No energy devices" emptyDescription="Eligible devices will appear here.">
            <div className="space-y-3">
              {devices.map((device, i) => {
                const Icon = device.type === "thermostat" ? Thermometer : device.type === "evCharger" ? Car : Droplets;
                return (
                  <motion.div key={device.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.2 }}>
                    <Card>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{device.name}</p>
                            <p className="text-2xs text-muted-foreground">{device.displayType}</p>
                          </div>
                        </div>
                        <StatusBadge variant={device.energySaverEnabled ? "online" : "offline"}>
                          {device.energySaverEnabled ? "Active" : "Off"}
                        </StatusBadge>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </StateWrapper>
        </TabsContent>

        <TabsContent value="consumption" className="mt-4">
          <Card>
            <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              {/* TODO: Real chart with recharts */}
              Consumption chart placeholder — connect analytics API
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-2xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
        </div>
        <p className="text-lg font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
