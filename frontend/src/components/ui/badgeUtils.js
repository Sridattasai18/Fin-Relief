/**
 * Convenience mapper: converts stress_level string from API to Badge variant
 */
export function stressVariant(level) {
  const map = {
    Low:      'healthy',
    Medium:   'tight',
    High:     'high',
    Critical: 'critical',
  }
  return map[level] || 'neutral'
}
