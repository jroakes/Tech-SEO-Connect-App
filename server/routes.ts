import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { readFileSync } from "fs";
import path from "path";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/kml-data", async (req, res) => {
    try {
      const kmlPath = path.join(process.cwd(), "attached_assets", "Tech SEO Connect Durham, NC_1763762954623.kml");
      const kmlData = readFileSync(kmlPath, "utf-8");
      res.setHeader("Content-Type", "application/vnd.google-earth.kml+xml");
      res.send(kmlData);
    } catch (error) {
      console.error("Error reading KML file:", error);
      res.status(500).json({ error: "Failed to load location data" });
    }
  });

  app.get("/api/conference-images", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const images = await storage.getAllConferenceImages();
      
      const publicImages = images.map(image => {
        let publicPath = image.imagePath;
        const privateDir = objectStorageService.getPrivateObjectDir();
        
        if (image.fullPath && image.fullPath.startsWith(privateDir)) {
          const relativePath = image.fullPath.substring(privateDir.length);
          publicPath = `/objects${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
        }
        
        return {
          ...image,
          imagePath: publicPath,
        };
      });
      
      res.json(publicImages);
    } catch (error) {
      console.error("Error fetching conference images:", error);
      res.status(500).json({ error: "Failed to fetch images" });
    }
  });

  app.post("/api/conference-images/upload", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const { uploadURL, objectId, fullPath, publicPath } = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL, objectId, fullPath, publicPath });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  app.post("/api/conference-images", async (req, res) => {
    if (!req.body.fullPath || !req.body.publicPath) {
      return res.status(400).json({ error: "fullPath and publicPath are required" });
    }

    try {
      const image = await storage.createConferenceImage({ 
        imagePath: req.body.fullPath,
        fullPath: req.body.fullPath 
      });

      const publicImage = {
        ...image,
        imagePath: req.body.publicPath,
      };

      res.status(201).json(publicImage);
    } catch (error) {
      console.error("Error saving conference image:", error);
      res.status(500).json({ error: "Failed to save image" });
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
