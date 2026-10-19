import { getSysInfoFast } from '../model/staticCache.js'

/**
 * 获取操作系统的分发版信息
 * @return {Promise<Object>}
 */
export async function getSysInfo() {
  try {
    return getSysInfoFast()
  } catch (error) {
    logger.error('获取系统信息时出错:', error)
    return { key: 'System', value: "The Emperor's New System" }
  }
}
