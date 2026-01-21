export const slugifyCategory = (value: string) => {
  const trimmed = value.trim()
  const cleaned = trimmed
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .slice(0, 80)
  return cleaned || 'uncategorized'
}

export const slugifyAssetFolder = (value: string) => {
  const trimmed = value.trim()
  const cleaned = trimmed
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .slice(0, 80)
  return cleaned || 'unnamed'
}
