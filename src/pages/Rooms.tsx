import { useApp } from "@/contexts/AppContext";
import { Card, CardContent } from "@/components/ui/card";
import { StateWrapper } from "@/components/common/StateWrapper";
import { Link } from "react-router-dom";
import { ChevronRight, DoorOpen, Sofa, BedDouble, CookingPot, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";

const roomIcons: Record<string, React.ElementType> = {
  sofa: Sofa, bed: BedDouble, door: DoorOpen, utensils: CookingPot,
};

export default function RoomsPage() {
  const { currentHome, currentUser } = useApp();
  if (!currentHome) return <StateWrapper state="loading"><div /></StateWrapper>;

  const isMaster = currentUser.role === "master" || currentUser.role === "admin";

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Rooms</h1>
        {isMaster && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => toast.info("TODO: Create room flow")}>
            <Plus className="h-4 w-4" /> Add Room
          </Button>
        )}
      </div>

      <StateWrapper state={currentHome.rooms.length === 0 ? "empty" : "success"}
        emptyTitle="No rooms yet" emptyDescription="Organize your devices into rooms for easier control.">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {currentHome.rooms.map((room, i) => {
            const RoomIcon = roomIcons[room.icon] ?? DoorOpen;
            const onlineCount = room.devices.filter(d => d.online).length;
            return (
              <motion.div key={room.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}>
                <Link to={`/rooms/${room.id}`}>
                  <Card className="hover:shadow-card-hover transition-shadow cursor-pointer group">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary">
                            <RoomIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{room.name}</p>
                            <p className="text-2xs text-muted-foreground">
                              {room.devices.length} device{room.devices.length !== 1 ? "s" : ""} · {onlineCount} online
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </StateWrapper>
    </div>
  );
}
