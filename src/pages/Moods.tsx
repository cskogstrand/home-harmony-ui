import { useApp } from "@/contexts/AppContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StateWrapper } from "@/components/common/StateWrapper";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Sparkles, Play, Plus, Sunrise, Moon, Film, Plane } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import type { Mood } from "@/types/api";

const moodIcons: Record<string, React.ElementType> = {
  sunrise: Sunrise, moon: Moon, film: Film, plane: Plane,
};

export default function MoodsPage() {
  const { currentHome, currentUser } = useApp();
  if (!currentHome) return <StateWrapper state="loading"><div /></StateWrapper>;

  const moods = currentHome.moods ?? [];
  const isMaster = currentUser.role === "master" || currentUser.role === "admin";

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Scenes</h1>
        {isMaster && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => toast.info("TODO: Create mood flow")}>
            <Plus className="h-4 w-4" /> Create Mood
          </Button>
        )}
      </div>

      <StateWrapper state={moods.length === 0 ? "empty" : "success"}
        emptyTitle="No moods yet" emptyDescription="Create moods to quickly set the right atmosphere.">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {moods.map((mood, i) => (
            <motion.div key={mood.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}>
              <MoodCard mood={mood} />
            </motion.div>
          ))}
        </div>
      </StateWrapper>
    </div>
  );
}

function MoodCard({ mood }: { mood: Mood }) {
  const { activateMood, homeOnline } = useApp();
  const IconComponent = (mood.icon ? moodIcons[mood.icon] : undefined) ?? Sparkles;
  return (
    <Card className={`transition-shadow ${mood.active ? "border-primary/40 shadow-card-hover" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center h-10 w-10 rounded-lg ${
              mood.active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
            }`}>
              <IconComponent className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">{mood.name}</p>
              <p className="text-2xs text-muted-foreground">
                {mood.devices?.length ?? 0} device{(mood.devices?.length ?? 0) !== 1 ? "s" : ""}
                {mood.roomId && " · Room scoped"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mood.active && <StatusBadge variant="online" dot={false}>Active</StatusBadge>}
            <Button size="sm" variant={mood.active ? "secondary" : "default"} className="gap-1.5 touch-target"
              disabled={!homeOnline} onClick={() => activateMood(mood.id)}>
              <Play className="h-3.5 w-3.5" />
              {mood.active ? "Apply again" : "Activate"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
