import { setPrimaryVehiclePhoto, uploadVehiclePhotos } from "./photo-actions";

type VehiclePhoto = {
  id: string;
  public_url: string;
  alt_text: string | null;
  is_primary: boolean;
};

export default function PhotoUploader({ vehicleId, photos, status }: { vehicleId: string; photos: VehiclePhoto[]; status?: string }) {
  return (
    <section id="vehicle-media" className="card vehicle-photo-card">
      <div className="eyebrow">Vehicle media</div>
      <h2>Profile photos</h2>
      <p className="muted">The primary photo appears anywhere this vehicle is listed.</p>
      <div className="vehicle-photo-status" aria-live="polite">
        {status === "uploaded" && <p className="alert success">✓ Vehicle image uploaded successfully. It is now available to Vehicle Intelligence.</p>}
        {status === "primary" && <p className="alert success">✓ Primary vehicle image updated successfully.</p>}
        {status === "size" && <p className="alert">This image is larger than 10 MB. Choose a smaller image and try again.</p>}
        {status === "format" && <p className="alert">This file is not a supported JPG, JPEG, PNG, or WebP image.</p>}
        {status === "permission" && <p className="alert">Photo Storage permission is not configured for this organization.</p>}
        {status === "bucket" && <p className="alert">The vehicle photo Storage bucket is not configured.</p>}
        {status === "database" && <p className="alert">The image reached Storage, but its vehicle record could not be saved.</p>}
        {status === "storage" && <p className="alert">Supabase Storage rejected this image. Try another JPEG or review the Storage configuration.</p>}
        {status === "auth" && <p className="alert">Your session expired. Sign in again before uploading.</p>}
        {status === "empty" && <p className="alert">Choose an image before uploading.</p>}
        {status === "failed" && <p className="alert">The image could not be uploaded. Choose the file again and retry.</p>}
      </div>
      <div className="vehicle-photo-grid">
        {photos.map(photo => (
          <figure className={photo.is_primary ? "primary" : ""} key={photo.id}>
            <img src={photo.public_url} alt={photo.alt_text ?? "Vehicle"} />
            <figcaption>{photo.is_primary ? <strong>Primary photo</strong> : <form action={setPrimaryVehiclePhoto.bind(null, vehicleId, photo.id)}><button type="submit">Make primary</button></form>}</figcaption>
          </figure>
        ))}
      </div>
      <form action={uploadVehiclePhotos.bind(null, vehicleId)} className="form">
        <div className="field">
          <label>Add vehicle photos</label>
          <input name="photos" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" required />
          <small className="muted">JPG, JPEG, PNG, or WebP · maximum 10 MB per image</small>
        </div>
        <button className="button">Upload photos</button>
      </form>
    </section>
  );
}
