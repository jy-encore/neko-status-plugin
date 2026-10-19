import { getSampledNetwork } from '../model/sampler.js'

/**
 * 获取当前网络接口的上行下行速度（后台采样，请求时 0 等待）
 * @return {Promise<Object>}
 */
export async function getNetworkSpeed() {
  try {
    return getSampledNetwork()
  } catch (error) {
    logger.error('获取网络速度时出错:', error)
    return { text: '↑ 0 bytes/s ↓ 0 bytes/s', progress: 0 }
  }
}
