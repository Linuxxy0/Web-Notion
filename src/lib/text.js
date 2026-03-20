const DEFAULT_ENCODINGS = ['utf-8', 'gbk', 'gb18030'];

export function base64ToBytes(base64Value) {
  const base64 = String(base64Value || '').replace(/\s+/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function decodeBytesBestEffort(bytesLike, preferred = DEFAULT_ENCODINGS) {
  const bytes = bytesLike instanceof Uint8Array ? bytesLike : new Uint8Array(bytesLike);

  for (const encoding of preferred) {
    try {
      const decoder = new TextDecoder(encoding, { fatal: true });
      return {
        text: decoder.decode(bytes),
        encoding,
      };
    } catch (error) {
      // continue
    }
  }

  return {
    text: new TextDecoder('utf-8').decode(bytes),
    encoding: 'utf-8',
  };
}

export async function readFileTextBestEffort(file, preferred = DEFAULT_ENCODINGS) {
  const buffer = await file.arrayBuffer();
  return decodeBytesBestEffort(buffer, preferred);
}

export function truncateText(text, maxChars = 200000) {
  const safe = String(text ?? '');
  if (safe.length <= maxChars) return safe;
  return `${safe.slice(0, maxChars)}

--- 预览已截断，仅显示前 ${maxChars} 个字符 ---`;
}

export function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
