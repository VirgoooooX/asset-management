const slugifySegment = (value: string, fallback: string) => {
  const cleaned = value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .slice(0, 80)
  return cleaned || fallback
}

export const slugifyCategory = (value: string) => slugifySegment(value, 'uncategorized')

export const slugifyAssetFolder = (value: string) => slugifySegment(value, 'unnamed')
