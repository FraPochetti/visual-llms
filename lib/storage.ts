import fs from 'fs/promises';
import path from 'path';

const MEDIA_BASE_PATH = '/var/visualneurons/media';

export async function ensureSessionDirectory(sessionId: string): Promise<string> {
    const sessionDir = path.join(MEDIA_BASE_PATH, sessionId);
    await fs.mkdir(sessionDir, { recursive: true });
    return sessionDir;
}

export async function saveMediaFile(
    sessionId: string,
    buffer: Buffer,
    filename: string
): Promise<string> {
    const sessionDir = await ensureSessionDirectory(sessionId);
    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const finalName = `${timestamp}-${safeName}`;
    const filePath = path.join(sessionDir, finalName);

    await fs.writeFile(filePath, buffer);

    // Return relative path from media base
    return path.join(sessionId, finalName);
}

export async function getMediaFilePath(relativePath: string): Promise<string> {
    return path.join(MEDIA_BASE_PATH, relativePath);
}

export async function readMediaFile(relativePath: string): Promise<Buffer> {
    const fullPath = await getMediaFilePath(relativePath);
    return fs.readFile(fullPath);
}

export async function saveVideo(
    sessionId: string,
    videoBuffer: Buffer
): Promise<string> {
    const timestamp = Date.now();
    const filename = `video_${timestamp}.mp4`;
    return saveMediaFile(sessionId, videoBuffer, filename);
}

export async function deleteMediaFile(relativePath: string): Promise<void> {
    const fullPath = await getMediaFilePath(relativePath);
    await fs.unlink(fullPath);
}

