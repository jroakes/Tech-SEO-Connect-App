import { type ConferenceImage, type InsertConferenceImage, conferenceImages } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { desc, eq } from "drizzle-orm";
import { ObjectStorageService } from "./objectStorage";

export interface IStorage {
  createConferenceImage(image: InsertConferenceImage): Promise<ConferenceImage>;
  getAllConferenceImages(): Promise<ConferenceImage[]>;
  deleteConferenceImage(id: string): Promise<void>;
}

export class DbStorage implements IStorage {
  private objectStorageService: ObjectStorageService;

  constructor() {
    this.objectStorageService = new ObjectStorageService();
  }

  async createConferenceImage(insertImage: InsertConferenceImage): Promise<ConferenceImage> {
    const id = randomUUID();
    const [image] = await db.insert(conferenceImages).values({
      id,
      ...insertImage,
    }).returning();
    return image;
  }

  async getAllConferenceImages(): Promise<ConferenceImage[]> {
    return await db.select().from(conferenceImages).orderBy(desc(conferenceImages.uploadedAt));
  }

  async deleteConferenceImage(id: string): Promise<void> {
    const [image] = await db.select().from(conferenceImages).where(eq(conferenceImages.id, id));
    
    if (!image) {
      throw new Error("Image not found");
    }

    if (image.fullPath) {
      try {
        const file = await this.objectStorageService.getFileByFullPath(image.fullPath);
        await file.delete();
      } catch (error) {
        console.error("Error deleting object from storage:", error);
      }
    }

    await db.delete(conferenceImages).where(eq(conferenceImages.id, id));
  }
}

export const storage = new DbStorage();
