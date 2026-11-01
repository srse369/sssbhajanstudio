export function formatCount(shown: number, total: number) {
  return shown === total ? String(total) : `${shown}/${total}`;
}
