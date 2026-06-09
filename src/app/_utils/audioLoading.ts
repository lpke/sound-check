export type ArrayBufferLoadProgress = {
  loadedBytes: number;
  percent: number | null;
  totalBytes: number | null;
};

export async function readResponseArrayBufferWithProgress(
  response: Response,
  onProgress: (progress: ArrayBufferLoadProgress) => void,
) {
  const totalBytes = getContentLength(response);

  if (!response.body) {
    const arrayBuffer = await response.arrayBuffer();

    onProgress({
      loadedBytes: arrayBuffer.byteLength,
      percent: getProgressPercent(arrayBuffer.byteLength, totalBytes),
      totalBytes,
    });

    return arrayBuffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;

  onProgress({
    loadedBytes,
    percent: getProgressPercent(loadedBytes, totalBytes),
    totalBytes,
  });

  for (;;) {
    const result = await reader.read();

    if (result.done) {
      break;
    }

    chunks.push(result.value);
    loadedBytes += result.value.byteLength;
    onProgress({
      loadedBytes,
      percent: getProgressPercent(loadedBytes, totalBytes),
      totalBytes,
    });
  }

  const output = new Uint8Array(loadedBytes);
  let offset = 0;

  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  });

  return output.buffer.slice(0);
}

function getContentLength(response: Response) {
  const contentLength = response.headers.get('content-length');

  if (!contentLength) {
    return null;
  }

  const parsedLength = Number.parseInt(contentLength, 10);

  return Number.isFinite(parsedLength) && parsedLength > 0
    ? parsedLength
    : null;
}

function getProgressPercent(loadedBytes: number, totalBytes: number | null) {
  if (!totalBytes) {
    return null;
  }

  return Math.min(100, Math.max(0, (loadedBytes / totalBytes) * 100));
}
