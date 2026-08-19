"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

function photoRedirect(vehicleId: string, status: string): never {
  redirect(`/dashboard/fleet/${vehicleId}?photo=${status}#vehicle-media`);
}

function storageFailure(message: string, statusCode?: string | number): string {
  const value = `${statusCode ?? ""} ${message}`.toLowerCase();
  if (value.includes("bucket") || value.includes("not found") || value.includes("404")) return "bucket";
  if (value.includes("row-level") || value.includes("policy") || value.includes("unauthorized") || value.includes("403")) return "permission";
  if (value.includes("mime") || value.includes("content type")) return "format";
  if (value.includes("size") || value.includes("large") || value.includes("413")) return "size";
  return "storage";
}

export async function uploadVehiclePhotos(vehicleId: string, data: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) photoRedirect(vehicleId, "auth");

  const { data: member } = await supabase.from("organization_members").select("organization_id,role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!member?.organization_id || !["owner", "admin"].includes(member.role)) photoRedirect(vehicleId, "permission");
  const storageAdmin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

  const file = data.get("photos");
  if (!(file instanceof File) || file.size === 0) photoRedirect(vehicleId, "empty");
  if (file.size > MAX_PHOTO_SIZE) photoRedirect(vehicleId, "size");

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const contentType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "";
  if (!contentType) photoRedirect(vehicleId, "format");

  const { count } = await supabase.from("vehicle_photos").select("id", { count: "exact", head: true }).eq("vehicle_id", vehicleId);
  const path = `${member.organization_id}/${vehicleId}/primary.${ext}`;
  await storageAdmin.storage.from("vehicle-photos").remove(["jpg", "jpeg", "png", "webp"].map(extension => `${member.organization_id}/${vehicleId}/primary.${extension}`));
  const { error: uploadError } = await storageAdmin.storage.from("vehicle-photos").upload(path, file, { contentType, upsert: true });
  if (uploadError) {
    console.error("Vehicle photo Storage upload failed", { vehicleId, code: uploadError.name, status: "statusCode" in uploadError ? uploadError.statusCode : undefined, message: uploadError.message });
    photoRedirect(vehicleId, storageFailure(uploadError.message, "statusCode" in uploadError ? uploadError.statusCode : undefined));
  }

  const { data: url } = storageAdmin.storage.from("vehicle-photos").getPublicUrl(path);
  const { error: insertError } = await supabase.from("vehicle_photos").insert({ organization_id: member.organization_id, vehicle_id: vehicleId, storage_path: path, public_url: url.publicUrl, alt_text: file.name, is_primary: (count ?? 0) === 0, sort_order: count ?? 0 });
  if (insertError) {
    console.error("Vehicle photo metadata insert failed", { vehicleId, code: insertError.code, message: insertError.message });
    if (insertError.code !== "PGRST205") {
      await storageAdmin.storage.from("vehicle-photos").remove([path]);
      photoRedirect(vehicleId, insertError.code === "42501" ? "permission" : "database");
    }
  }

  revalidatePath(`/dashboard/fleet/${vehicleId}`);
  revalidatePath("/dashboard/vehicle-intelligence");
  revalidatePath("/dashboard/vehicle-intelligence/pulse");
  revalidatePath("/dashboard/command-center");
  photoRedirect(vehicleId, "uploaded");
}

export async function setPrimaryVehiclePhoto(vehicleId: string, photoId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: member } = await supabase.from("organization_members").select("organization_id,role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!member?.organization_id || !["owner", "admin"].includes(member.role)) return;
  const { data: photo } = await supabase.from("vehicle_photos").select("id").eq("id", photoId).eq("vehicle_id", vehicleId).eq("organization_id", member.organization_id).maybeSingle();
  if (!photo) return;
  await supabase.from("vehicle_photos").update({ is_primary: false }).eq("vehicle_id", vehicleId).eq("organization_id", member.organization_id);
  await supabase.from("vehicle_photos").update({ is_primary: true }).eq("id", photoId).eq("organization_id", member.organization_id);
  revalidatePath(`/dashboard/fleet/${vehicleId}`);
  revalidatePath("/dashboard/vehicle-intelligence");
  revalidatePath("/dashboard/vehicle-intelligence/pulse");
  revalidatePath("/dashboard/command-center");
  photoRedirect(vehicleId, "primary");
}
