import { useApp } from "@/contexts/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { StateWrapper } from "@/components/common/StateWrapper";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Workflow, Plus, Clock, Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion } from "framer-motion";
import type { Rule } from "@/types/api";

export default function AutomationPage() {
  const { currentHome, currentUser } = useApp();
  if (!currentHome) return <StateWrapper state="loading"><div /></StateWrapper>;

  const rules = currentHome.rules;
  const isMaster = currentUser.role === "master" || currentUser.role === "admin";

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Automation</h1>
        {isMaster && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => toast.info("TODO: Create rule flow")}>
            <Plus className="h-4 w-4" /> New Rule
          </Button>
        )}
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules" className="gap-1.5"><Zap className="h-3.5 w-3.5" /> Rules</TabsTrigger>
          <TabsTrigger value="timelines" className="gap-1.5"><Clock className="h-3.5 w-3.5" /> Timelines</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-4">
          <StateWrapper state={rules.length === 0 ? "empty" : "success"}
            emptyTitle="No rules yet" emptyDescription="Automate your home by creating rules that respond to events.">
            <div className="space-y-3">
              {rules.map((rule, i) => (
                <motion.div key={rule.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.2 }}>
                  <RuleCard rule={rule} />
                </motion.div>
              ))}
            </div>
          </StateWrapper>
        </TabsContent>

        <TabsContent value="timelines" className="mt-4">
          <StateWrapper state="empty" emptyTitle="No timeline items" emptyDescription="Schedule actions for specific times.">
            <div />
          </StateWrapper>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RuleCard({ rule }: { rule: Rule }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 text-primary shrink-0">
            <Workflow className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{rule.name ?? "Unnamed Rule"}</p>
            <p className="text-2xs text-muted-foreground">
              {rule.conditions.length} condition{rule.conditions.length !== 1 ? "s" : ""} · {rule.actions.length} action{rule.actions.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge variant={rule.enabled ? "online" : "offline"} dot={false}>
            {rule.enabled ? "Active" : "Paused"}
          </StatusBadge>
          <Switch
            checked={rule.enabled}
            onCheckedChange={(v) => toast.success(`Rule ${v ? "enabled" : "disabled"}`)}
            aria-label={`Toggle ${rule.name}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
