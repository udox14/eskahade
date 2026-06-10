const STRUCTURAL_ROLE_VALUES = ['pengurus_asrama', 'sekpen', 'dewan_santri', 'keamanan']
const JABATAN_PREFIX = 'jabatan:'

function isStructuralBaseRole(role: string) {
  return STRUCTURAL_ROLE_VALUES.includes(role)
}

function isGlobalJabatanRole(role: string) {
  return role.startsWith(JABATAN_PREFIX)
}

function parseScopedStructuralRole(role: string) {
  const [base, jabatan, ...rest] = role.split(':')
  if (rest.length > 0 || !base || !jabatan) return null
  if (!isStructuralBaseRole(base)) return null
  return { base, jabatan }
}

export function rolesCanAccessFeature(featureRoles: string[], userRoles: string[]) {
  const userRoleSet = new Set(userRoles)
  const structuralBaseRoles = featureRoles.filter(isStructuralBaseRole)
  const globalJabatanRoles = featureRoles.filter(isGlobalJabatanRole)
  const scopedStructuralRoles = featureRoles.filter(role => parseScopedStructuralRole(role) != null)
  const hasStructuralConstraint = globalJabatanRoles.length > 0 || scopedStructuralRoles.length > 0

  const nonStructuralDirectRoles = featureRoles.filter(role =>
    !isStructuralBaseRole(role) &&
    !isGlobalJabatanRole(role) &&
    parseScopedStructuralRole(role) == null
  )

  if (nonStructuralDirectRoles.some(role => userRoleSet.has(role))) return true
  if (scopedStructuralRoles.some(role => userRoleSet.has(role))) return true

  if (structuralBaseRoles.length > 0 && globalJabatanRoles.length > 0) {
    return structuralBaseRoles.some(baseRole =>
      userRoleSet.has(baseRole) &&
      globalJabatanRoles.some(jabatanRole => {
        const jabatan = jabatanRole.slice(JABATAN_PREFIX.length)
        return userRoleSet.has(jabatanRole) || userRoleSet.has(`${baseRole}:${jabatan}`)
      })
    )
  }

  if (globalJabatanRoles.length > 0 && globalJabatanRoles.some(role => userRoleSet.has(role))) {
    return true
  }

  if (!hasStructuralConstraint && structuralBaseRoles.some(role => userRoleSet.has(role))) {
    return true
  }

  return false
}
