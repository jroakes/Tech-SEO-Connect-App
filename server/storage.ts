import { type ConferenceImage, type InsertConferenceImage } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  createConferenceImage(image: InsertConferenceImage): Promise<ConferenceImage>;
  getAllConferenceImages(): Promise<ConferenceImage[]>;
}

export class MemStorage implements IStorage {
  private conferenceImages: Map<string, ConferenceImage>;

  constructor() {
    this.conferenceImages = new Map();
  }

  async createConferenceImage(insertImage: InsertConferenceImage): Promise<ConferenceImage> {
    const id = randomUUID();
    const image: ConferenceImage = {
      ...insertImage,
      id,
      uploadedAt: new Date(),
    };
    this.conferenceImages.set(id, image);
    return image;
  }

  async getAllConferenceImages(): Promise<ConferenceImage[]> {
    return Array.from(this.conferenceImages.values()).sort(
      (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()
    );
  }
}

export const storage = new MemStorage();
