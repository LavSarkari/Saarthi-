// Shared utility functions and formatting helpers will be placed here.
export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}
