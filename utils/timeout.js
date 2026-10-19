/**
 * 超时后返回 fallback，不抛错，避免拖垮 Promise.all
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {T} fallback
 * @return {Promise<T>}
 */
export function withTimeout(promise, ms, fallback) {
  let timer
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * 带 AbortSignal 的 fetch，限制体积，失败返回 null
 * @param {string} url
 * @param {{ timeout?: number, maxBytes?: number }} [opts]
 * @return {Promise<{ mime: string, buffer: Buffer } | null>}
 */
export async function fetchBuffer(url, opts = {}) {
  const timeout = opts.timeout ?? 1200
  const maxBytes = opts.maxBytes ?? 5 * 1024 * 1024
  const fetchFn = globalThis.fetch
  if (typeof fetchFn !== 'function') return null

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetchFn(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'neko-status-plugin' }
    })
    if (!res.ok) return null
    const len = Number(res.headers.get('content-length') || 0)
    if (len > maxBytes) return null
    const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length > maxBytes) return null
    return { mime, buffer }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
