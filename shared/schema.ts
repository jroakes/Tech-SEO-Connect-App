import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z} from "zod";

export const conferenceImages = pgTable("conference_images", {
  id: varchar("id").primaryKey(),
  imagePath: text("image_path").notNull(),
  fullPath: text("full_path").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const insertConferenceImageSchema = createInsertSchema(conferenceImages).pick({
  imagePath: true,
  fullPath: true,
});

export type InsertConferenceImage = z.infer<typeof insertConferenceImageSchema>;
export type ConferenceImage = typeof conferenceImages.$inferSelect;

export interface Location {
  name: string;
  category: string;
  lat: number;
  lng: number;
  narrative?: string;
}

export interface ScheduleSession {
  time: string;
  title: string;
  duration: number;
  isBreak: boolean;
  day: 1 | 2;
  speaker?: string;
}
