/** "Mercedes-Benz Citaro C2G (C2-C4 szerz)" -> "Mercedes-Benz Citaro C2G": BKK's notes in brackets are internal */
export function vehicleName(model: string | null | undefined) {
  const clean = model?.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
  return clean || null
}
