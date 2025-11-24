import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, ImageIcon, Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ConferenceImage } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function GalleryPage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageToDelete, setImageToDelete] = useState<ConferenceImage | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const { data: images = [], isLoading } = useQuery<ConferenceImage[]>({
    queryKey: ["/api/conference-images"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setIsUploading(true);
      
      const uploadResponse = await apiRequest("POST", "/api/conference-images/upload", {});
      const { uploadURL, fullPath, publicPath } = uploadResponse;

      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      await apiRequest("POST", "/api/conference-images", {
        fullPath,
        publicPath,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conference-images"] });
      toast({
        title: "Image uploaded",
        description: "Your image has been successfully uploaded to the gallery.",
      });
    },
    onError: (error) => {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (imageId: string) => {
      await apiRequest("DELETE", `/api/conference-images/${imageId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conference-images"] });
      toast({
        title: "Image deleted",
        description: "The image has been removed from the gallery.",
      });
      setImageToDelete(null);
    },
    onError: (error) => {
      console.error("Delete error:", error);
      toast({
        title: "Delete failed",
        description: "Failed to delete image. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      await uploadMutation.mutateAsync(file);
    }

    e.target.value = "";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm text-muted-foreground">Loading gallery...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-screen-xl px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2" data-testid="text-page-title">
                Conference Gallery
              </h1>
              <p className="text-sm text-muted-foreground" data-testid="text-page-description">
                Share your photos from Tech SEO Connect
              </p>
            </div>
            <label htmlFor="file-upload">
              <input
                id="file-upload"
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                data-testid="input-file-upload"
                disabled={isUploading}
              />
              <Button asChild disabled={isUploading}>
                <span className="cursor-pointer" data-testid="button-upload">
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Photos
                    </>
                  )}
                </span>
              </Button>
            </label>
          </div>
        </div>

        {isUploading && (
          <div className="mb-4 p-4 border border-card-border bg-muted/30 text-center" data-testid="status-uploading">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-sm text-muted-foreground">Uploading photos...</p>
          </div>
        )}

        {images.length === 0 ? (
          <Card className="p-12 border-2 border-dashed border-border text-center" data-testid="card-empty-state">
            <ImageIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No photos yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Upload photos to share your conference experience
            </p>
            <label htmlFor="file-upload-empty">
              <input
                id="file-upload-empty"
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUploading}
              />
              <Button asChild variant="outline" disabled={isUploading}>
                <span className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Photos
                </span>
              </Button>
            </label>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="grid-images">
            {images.map((image, idx) => (
              <div key={image.id} className="relative group" data-testid={`image-${idx}`}>
                <div
                  className="aspect-square bg-muted overflow-hidden border border-card-border hover-elevate cursor-pointer transition-all"
                  onClick={() => setSelectedImage(image.imagePath)}
                >
                  <img
                    src={image.imagePath}
                    alt={`Conference photo ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImageToDelete(image);
                    }}
                    data-testid={`button-delete-${idx}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="absolute bottom-2 left-2 right-2 bg-background/80 backdrop-blur-sm px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-xs text-muted-foreground">
                    {new Date(image.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden" data-testid="dialog-image-lightbox">
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Conference photo"
              className="w-full h-auto max-h-[90vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!imageToDelete} onOpenChange={() => setImageToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Image?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this image? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => imageToDelete && deleteMutation.mutate(imageToDelete.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
