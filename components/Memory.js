import { getMemoryFast } from '../model/staticCache.js'

/**
 * 获取内存使用情况
 * @return {Promise<Object>}
 */
export async function getMemoryUsageCircle() {
  try {
    return getMemoryFast()
  } catch (error) {
    logger.error('获取内存圈形图信息时出错:', error)
    return { text: '0 B / 0 B', progress: 0 }
  }
}
