import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE } from '@/lib/auth'
import { db } from '@/lib/db'

const BUCKET   = 'submission-invoices'
const MAX_FILES = 5
const MAX_SIZE  = 10 * 1024 * 1024 // 10 MB

const ALLOWED_MIME = new Set([
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Video
  'video/mp4',
  'video/quicktime',
  'video/webm',
  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
])

function randomStr(len = 6): string {
  return Math.random().toString(36).slice(2, 2 + len)
}

function extFromName(name: string): string {
  const parts = name.split('.')
  return parts.length > 1 ? parts[parts.length - 1] : 'bin'
}

async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const fileEntries = formData.getAll('files')
  const files = fileEntries.filter((e): e is File => e instanceof File)

  if (files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES} files allowed` }, { status: 400 })
  }

  const urls: string[] = []

  for (const file of files) {
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File "${file.name}" exceeds 10 MB limit` },
        { status: 400 }
      )
    }

    if (file.type && !ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: `File type "${file.type}" is not allowed` },
        { status: 400 }
      )
    }

    const ext  = extFromName(file.name)
    const path = `${session.id}/${Date.now()}-${randomStr()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error } = await db.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type || 'application/octet-stream' })

    if (error) {
      return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 })
    }

    const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(path)
    urls.push(urlData.publicUrl)
  }

  return NextResponse.json({ urls })
}
