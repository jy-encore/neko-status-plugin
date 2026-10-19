/**
 * 转换字节大小为更易读的格式（KB, MB, GB 等）
 * @param {number} bytes
 * @return {string}
 */
export default function formatSizeUnits(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return '0 bytes'
  if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' GB'
  if (n >= 1048576) return (n / 1048576).toFixed(2) + ' MB'
  if (n >= 1024) return (n / 1024).toFixed(2) + ' KB'
  if (n > 1) return n.toFixed(2) + ' B'
  if (n === 1) return '1 byte'
  return '0 bytes'
}
