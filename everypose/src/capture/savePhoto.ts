import { Album, Asset, getPermissionsAsync, requestPermissionsAsync } from 'expo-media-library'
import { File } from 'expo-file-system'

export const ALBUM_NAME = 'everypose'

let permission: boolean | null = null

/**
 * Asks for photo access once and remembers the answer, so taking a photo never waits on it.
 * Full photo access (not add-only) because we also look up our album to put photos in it.
 */
export async function ensureGalleryPermission(): Promise<boolean> {
  if (permission === true) return true
  const current = await getPermissionsAsync(false, ['photo'])
  if (current.granted) return (permission = true)
  if (!current.canAskAgain) return (permission = false)
  permission = (await requestPermissionsAsync(false, ['photo'])).granted
  return permission
}

/**
 * Saves a photo file to the gallery and tries to file it in the "everypose" album. Once the
 * photo is in the gallery it counts as saved, even if filing it or reading its address fails.
 * Returns an address to show the photo with, or null if there is none.
 */
export async function saveToGallery(filePath: string): Promise<string | null> {
  const uri = filePath.startsWith('file://') ? filePath : `file://${filePath}`
  try {
    let album: Album | null = null
    try {
      album = await Album.get(ALBUM_NAME)
    } catch {}
    const asset = await Asset.create(uri, album ?? undefined)
    if (album == null) {
      try {
        await Album.create(ALBUM_NAME, [asset])
      } catch {}
    }
    try {
      return await asset.getUri()
    } catch {
      return null
    }
  } finally {
    try {
      new File(uri).delete() // the gallery has its own copy
    } catch {}
  }
}
