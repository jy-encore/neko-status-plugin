import fs from 'fs'
import os from 'os'
import { pluginRoot } from './path.js'
import { withTimeout, fetchBuffer } from '../utils/timeout.js'
import Config from '../components/Config.js'
import formatSizeUnits from '../utils/formatSize.js'
import { detectGpuName } from './gpu.js'

const FALLBACK_COVER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="963" height="768"><rect fill="#d7eaf8" width="100%" height="100%"/></svg>'
)

const store = new Map()
const inflight = new Map()

function truncate(str, n = 36) {
  const s = String(str || '')
  return s.length > n ? s.slice(0, n) + '...' : s
}

/**
 * 带 TTL 的单飞缓存：并发只跑一次；过期后后台刷新，请求立刻返回旧值
 */
export async function cached(key, ttlMs, producer, { stale = true } = {}) {
  const now = Date.now()
  const hit = store.get(key)
  if (hit && now - hit.at < ttlMs) return hit.value
  if (hit && stale && inflight.has(key)) return hit.value

  if (inflight.has(key)) return inflight.get(key)

  const job = Promise.resolve()
    .then(producer)
    .then((value) => {
      store.set(key, { at: Date.now(), value })
      inflight.delete(key)
      return value
    })
    .catch((err) => {
      inflight.delete(key)
      if (hit) return hit.value
      throw err
    })

  inflight.set(key, job)
  if (hit && stale) return hit.value
  return job
}

export function peek(key) {
  return store.get(key)?.value
}

export function setCache(key, value) {
  store.set(key, { at: Date.now(), value })
}

function memFromProc() {
  const raw = fs.readFileSync('/proc/meminfo', 'utf8')
  const map = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^(\w+):\s+(\d+)/)
    if (m) map[m[1]] = Number(m[2]) * 1024
  }
  const total = map.MemTotal || 0
  const available = map.MemAvailable || map.MemFree || 0
  const active = Math.max(0, total - available)
  return { total, active }
}

export function getMemoryFast() {
  try {
    if (os.platform() === 'linux') {
      const { total, active } = memFromProc()
      return {
        text: `${formatSizeUnits(active)} / ${formatSizeUnits(total)}`,
        progress: total > 0 ? active / total : 0
      }
    }
  } catch { /* fallback */ }

  const total = os.totalmem()
  const free = os.freemem()
  const active = Math.max(0, total - free)
  return {
    text: `${formatSizeUnits(active)} / ${formatSizeUnits(total)}`,
    progress: total > 0 ? active / total : 0
  }
}

export async function getDiskFast() {
  try {
    if (typeof fs.statfsSync === 'function') {
      const s = fs.statfsSync(pluginRoot)
      const bsize = Number(s.bsize || 4096)
      const total = Number(s.blocks) * bsize
      const available = Number(s.bavail ?? 0) * bsize
      const used = Math.max(0, total - available)
      return {
        text: `${formatSizeUnits(used)} / ${formatSizeUnits(total)}`,
        progress: total > 0 ? used / total : 0
      }
    }
  } catch { /* fallback si */ }

  try {
    const si = (await import('systeminformation')).default
    const { fsSize } = await si.get({ fsSize: 'fs,use,used,size' })
    const disk = (fsSize || []).find((d) =>
      os.platform() === 'win32' ? pluginRoot.startsWith(d.fs) : d.fs === '/'
    ) || fsSize?.[0]
    if (!disk) throw new Error('no disk')
    return {
      text: `${formatSizeUnits(disk.used)} / ${formatSizeUnits(disk.size)}`,
      progress: (disk.use || 0) / 100
    }
  } catch {
    return { text: '0 B / 0 B', progress: 0 }
  }
}

export function getCpuModelFast() {
  const cpus = os.cpus()
  const model = cpus?.[0]?.model || "The Emperor's New CPU"
  return { key: 'CPU', value: truncate(model, 36) }
}

export function getSysInfoFast() {
  try {
    if (os.platform() === 'linux') {
      const text = fs.readFileSync('/etc/os-release', 'utf8')
      const pretty = text.match(/^PRETTY_NAME="?([^"\n]+)/m)
      if (pretty?.[1]) return { key: 'System', value: truncate(pretty[1], 36) }
    }
  } catch { /* fallback */ }
  return { key: 'System', value: truncate(`${os.type()} ${os.release()}`, 36) }
}

export async function getGpuFast() {
  const hit = store.get('gpu')
  const now = Date.now()
  if (hit && now - hit.at < hit.ttl) return hit.value

  try {
    const name = await detectGpuName()
    if (name) {
      const value = { key: 'GPU', value: truncate(name, 36) }
      store.set('gpu', { at: Date.now(), value, ttl: 10 * 60 * 1000 })
      return value
    }
  } catch { /* ignore */ }

  const fallback = { key: 'GPU', value: "The Emperor's New GPU" }
  // 失败只短缓存，避免第一次超时把核显锁死 10 分钟
  store.set('gpu', { at: Date.now(), value: fallback, ttl: 20 * 1000 })
  return fallback
}

export function getPluginNumFast() {
  return cached('plugins', 30 * 1000, async () => {
    const pluginsDir = './plugins'
    const excludedDirs = ['example', 'genshin', 'other', 'system', 'bin', 'adapter']
    let pluginsCount = 0
    try {
      for (const name of fs.readdirSync(pluginsDir)) {
        if (excludedDirs.includes(name)) continue
        try {
          if (fs.statSync(`${pluginsDir}/${name}`).isDirectory()) pluginsCount++
        } catch { /* skip */ }
      }
    } catch { /* no plugins dir */ }

    let jsFilesCount = 0
    const exampleDir = './plugins/example'
    if (fs.existsSync(exampleDir)) {
      jsFilesCount = fs.readdirSync(exampleDir).filter((f) => f.endsWith('.js')).length
    }
    return { key: 'Plugins', value: `${pluginsCount} plugin & ${jsFilesCount} js loaded` }
  }, { stale: true }).catch(() => ({ key: 'Plugins', value: '0 plugin & 0 js loaded' }))
}

function toDataUri(mime, buffer) {
  return `data:${mime};base64,${buffer.toString('base64')}`
}

export async function getHeadImageFast() {
  const config = Config.getConfig() || {}
  const url = config.headimg_url
  const ttl = Math.max(0, Number(config.headimg_cache_ttl ?? 300)) * 1000
  const cacheKey = `head:${url || 'none'}`

  if (!url) return FALLBACK_COVER

  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return url
  }
  if (!/^https?:$/.test(parsed.protocol)) return url

  const refresh = async () => {
    const got = await fetchBuffer(url, { timeout: 2500 })
    if (!got) return peek(cacheKey) || FALLBACK_COVER
    const uri = toDataUri(got.mime, got.buffer)
    setCache(cacheKey, uri)
    return uri
  }

  const hit = store.get(cacheKey)
  if (hit) {
    const age = Date.now() - hit.at
    if (ttl === 0 || age > ttl / 2) refresh().catch(() => {})
    return hit.value
  }

  return withTimeout(refresh(), 1000, FALLBACK_COVER)
}

const avatarCache = new Map()

export async function getAvatarFast(bot) {
  const uin = bot?.uin || bot?.self_id || 'bot'
  if (bot?.avatar && String(bot.avatar).startsWith('data:')) return bot.avatar
  const hit = avatarCache.get(uin)
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.value

  let url = bot?.avatar
  if (!url) {
    try {
      url = await withTimeout(
        Promise.resolve(bot?.pickFriend?.(bot.uin)?.getAvatarUrl?.()),
        400,
        null
      )
    } catch {
      url = null
    }
  }
  if (!url) url = `https://q1.qlogo.cn/g?b=qq&s=100&nk=${uin}`

  if (typeof url === 'string' && url.startsWith('http')) {
    const got = await fetchBuffer(url, { timeout: 600, maxBytes: 1.5 * 1024 * 1024 })
    if (got) {
      const uri = toDataUri(got.mime, got.buffer)
      avatarCache.set(uin, { at: Date.now(), value: uri })
      return uri
    }
  }
  return url || `https://q1.qlogo.cn/g?b=qq&s=100&nk=${uin}`
}

export function prefetchStatic() {
  try { setCache('cpuModel', getCpuModelFast()) } catch { /* ignore */ }
  try { setCache('sys', getSysInfoFast()) } catch { /* ignore */ }
  getGpuFast().catch(() => {})
  getPluginNumFast().catch(() => {})
  getDiskFast().catch(() => {})
  getHeadImageFast().catch(() => {})
}

export { FALLBACK_COVER }
