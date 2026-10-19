import os from 'os'
import fs from 'fs'
import formatSizeUnits from '../utils/formatSize.js'

const PLATFORM = os.platform()
const isLinux = PLATFORM === 'linux'

function readCpuSnapshot() {
  const cpus = os.cpus() || []
  let idle = 0
  let total = 0
  let speedMhz = 0
  for (const cpu of cpus) {
    const t = cpu.times || {}
    const i = t.idle || 0
    const sum = (t.user || 0) + (t.nice || 0) + (t.sys || 0) + i + (t.irq || 0) + (t.steal || 0) + (t.guest || 0)
    idle += i
    total += sum
    if (cpu.speed) speedMhz += cpu.speed
  }
  const cores = Math.max(cpus.length, 1)
  return { idle, total, speedGhz: (speedMhz / cores) / 1000 }
}

function readCpuSpeedGhz(fallback) {
  try {
    const khz = Number(fs.readFileSync('/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq', 'utf8'))
    if (khz > 0) return khz / 1e6
  } catch { /* win / mac / 无 cpufreq */ }
  return fallback || 0
}

function readNetSnapshot() {
  if (!isLinux) return null
  try {
    const raw = fs.readFileSync('/proc/net/dev', 'utf8')
    let rx = 0
    let tx = 0
    const lines = raw.trim().split('\n').slice(2)
    for (const line of lines) {
      const parts = line.replace(':', ' ').trim().split(/\s+/)
      const iface = parts[0]
      if (!iface || iface === 'lo' || iface.startsWith('veth') || iface.startsWith('br-') || iface.startsWith('docker') || iface.startsWith('virbr')) continue
      rx += Number(parts[1]) || 0
      tx += Number(parts[9]) || 0
    }
    return { rx, tx, t: Date.now() }
  } catch {
    return null
  }
}

class MetricsSampler {
  constructor() {
    this.cpu = { text: '0.00% (0GHz)', progress: 0 }
    this.network = { text: '↑ 0 bytes/s ↓ 0 bytes/s', progress: 0 }
    this._prevCpu = readCpuSnapshot()
    this._prevNet = readNetSnapshot()
    this._netBusy = false
    this._started = false
    this._timer = null
  }

  start() {
    if (this._started) return this
    this._started = true
    this._tick()
    this._timer = setInterval(() => this._tick(), 1000)
    this._timer.unref?.()
    // 启动后 200ms 再采一次，避免开机立刻 #状态 读到 0%
    setTimeout(() => this._tick(), 200).unref?.()
    return this
  }

  _tick() {
    const cur = readCpuSnapshot()
    const dTotal = cur.total - this._prevCpu.total
    const dIdle = cur.idle - this._prevCpu.idle
    const load = dTotal > 0 ? (1 - dIdle / dTotal) * 100 : 0
    const speed = readCpuSpeedGhz(cur.speedGhz)
    const clamped = Math.min(100, Math.max(0, load))
    this.cpu = {
      text: `${clamped.toFixed(2)}% (${speed ? speed.toFixed(2) : '0.00'}GHz)`,
      progress: clamped / 100
    }
    this._prevCpu = cur

    const net = readNetSnapshot()
    if (net && this._prevNet) {
      const dt = Math.max(0.2, (net.t - this._prevNet.t) / 1000)
      const rx = Math.max(0, (net.rx - this._prevNet.rx) / dt)
      const tx = Math.max(0, (net.tx - this._prevNet.tx) / dt)
      const sum = rx + tx
      this.network = {
        text: `↑ ${formatSizeUnits(tx)}/s ↓ ${formatSizeUnits(rx)}/s`,
        progress: sum > 0 ? tx / sum : 0
      }
      this._prevNet = net
    } else if (net) {
      this._prevNet = net
    } else {
      this._tickSiNetwork()
    }
  }

  async _tickSiNetwork() {
    if (this._netBusy) return
    this._netBusy = true
    try {
      const si = (await import('systeminformation')).default
      const info = await si.networkStats()
      const primary = info?.[0]
      if (!primary) return
      const tx = Number(primary.tx_sec) || 0
      const rx = Number(primary.rx_sec) || 0
      const sum = tx + rx
      this.network = {
        text: `↑ ${formatSizeUnits(tx)}/s ↓ ${formatSizeUnits(rx)}/s`,
        progress: sum > 0 ? tx / sum : 0
      }
    } catch {
      /* 保持上一次 */
    } finally {
      this._netBusy = false
    }
  }

  getCpu() {
    return this.cpu
  }

  getNetwork() {
    return this.network
  }
}

const sampler = new MetricsSampler()

export function startSampler() {
  return sampler.start()
}

export function getSampledCpu() {
  if (!sampler._started) sampler.start()
  return sampler.getCpu()
}

export function getSampledNetwork() {
  if (!sampler._started) sampler.start()
  return sampler.getNetwork()
}

export default sampler
