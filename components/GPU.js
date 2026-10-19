import { getGpuFast } from '../model/staticCache.js'

/**
 * 获取GPU信息（启动预取 + 10 分钟缓存 + 600ms 超时）
 * @return {Promise<Object>}
 */
export async function getGpuInfo() {
  try {
    return await getGpuFast()
  } catch (error) {
    logger.error('获取GPU信息时出错:', error)
    return { key: 'GPU', value: "The Emperor's New GPU" }
  }
}
