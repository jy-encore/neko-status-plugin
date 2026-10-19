import { execFile } from 'child_process'
import fs from 'fs'
import os from 'os'
import { withTimeout } from '../utils/timeout.js'

const VIRTUAL_RE = /(virtual(\s|_|-)?(display|adapter|gpu|graphics|monitor|desktop|video)?|remote\s*(display|desktop|fx|adapter)|microsoft\s*(remote|basic|hyper)|basic\s*(display|render|video)|indirect\s*display|iddcx|\bidd\b|iddsample|usbmmidd|hyper-?v|\brdp\b|vmware|virtualbox|vbox(\s|-)graphics|\bqxl\b|virtio|bochs|\bqemu\b|citrix|parsec|sunshine|spacedesk|usb(\s|-)?(display|video|graphics)|displaylink|miracast|wireless\s*display|teamviewer|anydesk|todesk|oray|sunlogin|splashtop|rustdesk|parallels|\bxen\b|meta\s*quest|\boculus\b|wsl\s*graphics|windows\s*subsystem|standard\s*vga|microsoft\s*adapter)/i

const CLASS_RE = /\b(vga compatible controller|3d controller|display controller)\b/i

export function isVirtualGpu(name = '', extra = '') {
  return VIRTUAL_RE.test(`${name} ${extra}`)
}

function scoreGpu(name, extra = '') {
  const n = `${name} ${extra}`.toLowerCase()
  if (isVirtualGpu(name, extra)) return -1
  if (/ven_10de|\b10de\b|nvidia|geforce|\brtx\b|\bgtx\b|quadro/.test(n)) return 100
  if (/ven_1002|\b1002\b|\bamd\b|radeon/.test(n)) return 90
  if (/intel.*arc|arc\s*(a|b|pro)?\s*\d/i.test(n)) return 85
  if (/ven_8086|\b8086\b|\bintel\b|uhd|iris/.test(n)) return 70
  if (/mali|adreno|apple\s*m\d/.test(n)) return 40
  if (/microsoft/i.test(extra) && !/intel|nvidia|amd|radeon|geforce/i.test(n)) return -1
  return 20
}

export function pickGpuName(candidates = []) {
  let best = null
  let bestScore = 0
  for (const c of candidates) {
    const name = cleanGpuName(String(c?.name || c?.model || '').trim(), `${c.vendor || ''} ${c.pnp || ''}`)
    if (!name) continue
    const extra = `${c.vendor || ''} ${c.pnp || ''} ${c.bus || ''} ${c.vendorId || ''}`
    if (isVirtualGpu(name, extra)) continue
    const score = scoreGpu(name, extra)
    if (score > bestScore) {
      bestScore = score
      best = name.replace(/\s+/g, ' ')
    }
  }
  return best
}

function cleanGpuName(name, extra = '') {
  if (!name) return ''
  const intel = name.match(/\[((?:UHD|HD|Iris|Arc)[^\]]*)\]/i)
  if (intel) return /intel/i.test(`${name} ${extra}`) ? `Intel ${intel[1]}` : intel[1]
  return name.replace(/\s*\[[0-9a-f]{4}:[0-9a-f]{4}\]\s*$/i, '').trim()
}

function execText(cmd, args, timeout = 1200) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, windowsHide: true, encoding: 'utf8' }, (err, stdout) => {
      if (err) return resolve('')
      resolve(String(stdout || ''))
    })
  })
}

function fromNvidiaSmi() {
  return execText('nvidia-smi', ['--query-gpu=name', '--format=csv,noheader'], 400).then((text) => {
    const names = text.split('\n').map((s) => s.trim()).filter(Boolean)
    return names.map((name) => ({ name, vendor: 'NVIDIA', pnp: 'VEN_10DE' }))
  })
}

function fromWindowsCim() {
  if (os.platform() !== 'win32') return Promise.resolve([])
  const script = [
    "$ProgressPreference='SilentlyContinue'",
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    'Get-CimInstance -ClassName Win32_VideoController | Select-Object Name,AdapterCompatibility,PNPDeviceID | ConvertTo-Json -Compress'
  ].join('; ')
  const shells = ['powershell.exe', 'pwsh.exe']
  return (async () => {
    for (const shell of shells) {
      const text = await execText(shell, [
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script
      ], 1500)
      const raw = text.trim()
      if (!raw) continue
      try {
        const parsed = JSON.parse(raw)
        const list = Array.isArray(parsed) ? parsed : [parsed]
        return list.map((row) => ({
          name: row.Name || '',
          vendor: row.AdapterCompatibility || '',
          pnp: row.PNPDeviceID || ''
        }))
      } catch { /* try next */ }
    }
    const csv = await execText('wmic', [
      'path', 'win32_VideoController', 'get', 'Name,AdapterCompatibility,PNPDeviceID', '/format:csv'
    ], 1500)
    return parseWmicCsv(csv)
  })()
}

function parseWmicCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const iName = header.findIndex((h) => h === 'name')
  const iVendor = header.findIndex((h) => h === 'adaptercompatibility')
  const iPnp = header.findIndex((h) => h === 'pnpdeviceid')
  if (iName < 0) return []
  const out = []
  for (const line of lines.slice(1)) {
    const cols = line.split(',')
    out.push({
      name: cols[iName] || '',
      vendor: iVendor >= 0 ? cols[iVendor] || '' : '',
      pnp: iPnp >= 0 ? cols[iPnp] || '' : ''
    })
  }
  return out
}

function fromLspci(text) {
  const out = []
  for (const line of text.split('\n')) {
    if (!CLASS_RE.test(line) && !/\b\[03(00|02|80)\]/.test(line)) continue
    const fields = []
    const re = /"([^"]*)"/g
    let m
    while ((m = re.exec(line))) fields.push(m[1])
    const vendor = fields[2] || ''
    const device = fields[3] || ''
    const name = (device.replace(/\s*\[[0-9a-f]{4}:[0-9a-f]{4}\]\s*$/i, '').trim()) || device
    if (!name) continue
    out.push({ name, vendor, pnp: vendor })
  }
  return out
}

function fromLinuxSysfs() {
  const drm = '/sys/class/drm'
  let cards = []
  try {
    cards = fs.readdirSync(drm).filter((n) => /^card\d+$/.test(n))
  } catch {
    return []
  }
  const seen = new Set()
  const out = []
  const vendorMap = {
    '0x10de': 'NVIDIA',
    '0x1002': 'AMD',
    '0x8086': 'Intel',
    '0x1a03': 'ASPEED',
    '0x15ad': 'VMware',
    '0x1414': 'Microsoft',
    '0x1af4': 'Virtio'
  }
  for (const card of cards) {
    try {
      const vendor = fs.readFileSync(`${drm}/${card}/device/vendor`, 'utf8').trim().toLowerCase()
      const device = fs.readFileSync(`${drm}/${card}/device/device`, 'utf8').trim().toLowerCase()
      const key = `${vendor}:${device}`
      if (seen.has(key)) continue
      seen.add(key)
      let driver = ''
      try {
        const uevent = fs.readFileSync(`${drm}/${card}/device/uevent`, 'utf8')
        driver = (uevent.match(/^DRIVER=(.+)$/m) || [])[1] || ''
      } catch { /* ignore */ }
      const vendorName = vendorMap[vendor] || vendor
      let name = ''
      if (vendor === '0x8086') {
        name = driver === 'xe' ? 'Intel Graphics' : 'Intel UHD / Iris Graphics'
      } else if (vendor === '0x10de') {
        name = 'NVIDIA GPU'
      } else if (vendor === '0x1002') {
        name = 'AMD Radeon'
      } else {
        name = `${vendorName} GPU`
      }
      out.push({
        name,
        vendor: vendorName,
        pnp: `VEN_${vendor.replace('0x', '').toUpperCase()}`,
        bus: driver
      })
    } catch { /* skip */ }
  }
  return out
}

async function fromLinuxPci() {
  if (os.platform() !== 'linux') return []
  const lspci = await execText('lspci', ['-mm', '-nn'], 800)
  if (lspci.trim()) return fromLspci(lspci)
  return fromLinuxSysfs()
}

async function fromSystemInformation() {
  try {
    const si = (await import('systeminformation')).default
    const graphics = await withTimeout(si.graphics(), 1800, null)
    const controllers = graphics?.controllers || []
    return controllers.map((c) => ({
      name: c.model || c.name || '',
      vendor: c.vendor || '',
      vendorId: c.vendorId || '',
      bus: c.bus || '',
      pnp: `${c.vendorId || ''} ${c.subVendor || ''}`
    }))
  } catch {
    return []
  }
}

export async function detectGpuName() {
  const batches = await Promise.all([
    fromNvidiaSmi().catch(() => []),
    fromWindowsCim().catch(() => []),
    fromLinuxPci().catch(() => []),
    fromSystemInformation().catch(() => [])
  ])
  return pickGpuName(batches.flat())
}
