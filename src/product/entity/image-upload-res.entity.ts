export class ImageUploadResEntity {
  success: boolean;
  data: {
    // PUT the file here with exactly these headers (plus content-length = size)
    upload_url: string;
    headers: Record<string, string>;
    // save this as the product's image_url once the PUT succeeds
    public_url: string;
    expires_in: number;
  };

  constructor(partial: Partial<ImageUploadResEntity>) {
    Object.assign(this, partial);
  }
}
