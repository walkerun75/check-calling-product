"use client";

export function SelectAllPermissions() {
  return (
    <input
      type="checkbox"
      aria-label="Select all permissions"
      onChange={(event) => {
        const form = event.currentTarget.closest("form");
        form?.querySelectorAll<HTMLInputElement>('input[name="permissions"]').forEach((checkbox) => {
          checkbox.checked = event.currentTarget.checked;
        });
      }}
    />
  );
}
