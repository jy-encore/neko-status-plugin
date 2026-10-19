import { getSampledCpu } from '../model/sampler.js'
import { getCpuModelFast } from '../model/staticCache.js'

/**
 * 获取CPU负载和频率（后台采样，请求时 0 等待）
 * @return {Promise<Object>}
 */
export async function getCpuLoadAndSpeed() {
  try {
    return getSampledCpu()
  } catch (error) {
    logger.error('获取CPU信息时出错:', error)
    return { text: '0% (0GHz)', progress: 0 }
  }
}

/**
 * 获取CPU型号
 * @return {Promise<Object>}
 */
export async function getCpuModel() {
  try {
    return getCpuModelFast()
  } catch (error) {
    logger.error('获取CPU信息时出错:', error)
    return { key: 'CPU', value: "The Emperor's New CPU" }
  }
}
