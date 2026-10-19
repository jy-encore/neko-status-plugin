import { getDiskFast } from '../model/staticCache.js'

/**
 * 获取磁盘使用情况
 * @return {Promise<Object>}
 */
export async function getDiskUsageCircle() {
  try {
    return await getDiskFast()
  } catch (error) {
    logger.error('获取磁盘信息时出错:', error)
    return { text: '0 B / 0 B', progress: 0 }
  }
}
