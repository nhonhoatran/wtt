export interface SwapPickResult {
  /** Entry id still waiting for a partner; null when nothing is picked. */
  picked: string | null;
  /** Both ids to swap once a second, different member is chosen. */
  swap: [string, string] | null;
}

/** Two-step "Đổi chỗ": first click picks, clicking the same member again cancels, a different member completes the swap. */
export function pickForSwap(picked: string | null, clicked: string): SwapPickResult {
  if (picked === null) return { picked: clicked, swap: null };
  if (picked === clicked) return { picked: null, swap: null };
  return { picked: null, swap: [picked, clicked] };
}
