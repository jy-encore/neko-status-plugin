import { getPluginNumFast } from '../model/staticCache.js'

/**
 * 获取插件数量信息
 * @return {Promise<Object>}
 */
export async function getPluginNumInfo() {
  try {
    return await getPluginNumFast()
  } catch (error) {
    logger.error('获取插件信息时出错:', error)
    return { key: 'Plugins', value: '0 plugin & 0 js loaded' }
  }
}
