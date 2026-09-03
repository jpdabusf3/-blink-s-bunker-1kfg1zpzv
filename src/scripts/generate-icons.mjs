import fs from 'node:fs'
import path from 'node:path'

const sourcePath = path.resolve('src/assets/editedimage1788462602438-8aaee.png')
const publicDir = path.resolve('public')

const sourceBuffer = fs.readFileSync(sourcePath)

// Write favicon.png and favicon.ico
fs.writeFileSync(path.join(publicDir, 'favicon.png'), sourceBuffer)
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), sourceBuffer)

// Write fallback icons as specified:
// "If generating scaled variants from the attachment is not possible, use the attachment/Supabase Storage file as fallback for all 4."
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), sourceBuffer)
fs.writeFileSync(path.join(publicDir, 'icon-192-maskable.png'), sourceBuffer)
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), sourceBuffer)
fs.writeFileSync(path.join(publicDir, 'icon-512-maskable.png'), sourceBuffer)

console.log('Public icons generated successfully!')
