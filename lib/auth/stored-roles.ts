/** Current database permissions are authoritative; a token cannot restore them. */
export function storedUserRoles(primary: unknown, encoded: unknown): string[] | null {
  if (typeof primary !== 'string' || primary.trim().length === 0 || primary !== primary.trim()) return null
  // Existing single-role accounts predate the optional JSON column.
  if (encoded === null || encoded === undefined) return [primary]
  // Exact legacy encoding observed in production. Do not accept arbitrary
  // malformed JSON or use this exception after its primary role is revoked.
  if (primary === 'tester' && encoded === '[tester]') return ['tester']
  if (typeof encoded !== 'string') return null
  try {
    const roles: unknown = JSON.parse(encoded)
    if (!Array.isArray(roles) || roles.length === 0
      || !roles.every(role => typeof role === 'string' && role.length > 0 && role === role.trim())
      || !roles.includes(primary)) return null
    return [...new Set<string>(roles)]
  } catch {
    return null
  }
}
