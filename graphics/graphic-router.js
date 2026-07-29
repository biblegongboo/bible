// Bible Quiz does not use the optional Super Graphic Engine yet.
// Keep this compatibility module so the shared GongBoo engine can load safely.
export function isSuperGraphicPayload() { return false; }
export async function preloadSuperGraphicEngine() { return false; }
export function renderSuperGraphicPayload() { return ''; }
