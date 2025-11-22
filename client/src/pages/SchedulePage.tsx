import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScheduleCard } from "../components/ScheduleCard";
import { scheduleDay1, scheduleDay2 } from "../data/scheduleData";
import { MapPin } from "lucide-react";

export default function SchedulePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2" data-testid="text-page-title">
            Conference Schedule
          </h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span className="text-sm" data-testid="text-venue">The Fruit, Durham NC</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-date-range">
            December 4-5, 2025
          </p>
        </div>

        <Tabs defaultValue="day1" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="day1" data-testid="tab-day1">Day 1 - Dec 4</TabsTrigger>
            <TabsTrigger value="day2" data-testid="tab-day2">Day 2 - Dec 5</TabsTrigger>
          </TabsList>

          <TabsContent value="day1" className="space-y-0">
            {scheduleDay1.map((session, idx) => (
              <ScheduleCard key={idx} session={session} />
            ))}
          </TabsContent>

          <TabsContent value="day2" className="space-y-0">
            {scheduleDay2.map((session, idx) => (
              <ScheduleCard key={idx} session={session} />
            ))}
          </TabsContent>
        </Tabs>

        <div className="mt-8 p-4 border border-card-border bg-muted/30">
          <p className="text-sm text-muted-foreground" data-testid="text-schedule-note">
            All sessions are 30 minutes. Breaks provide time for networking and refreshments.
            The schedule runs from 8:00 AM to 4:55 PM each day.
          </p>
        </div>
      </div>
    </div>
  );
}
