import { getCpuLoadAndSpeed, getCpuModel } from '../components/CPU.js'
import { getMemoryUsageCircle } from '../components/Memory.js'
import { getNetworkSpeed } from '../components/Network.js'
import { getDiskUsageCircle } from '../components/Disk.js'
import { getSysInfo } from '../components/System.js'
import { getGpuInfo } from '../components/GPU.js'
import { getPluginNumInfo } from '../components/Plugin.js'
import { getAccountInfo } from '../components/Account.js'
import { getAdapter } from '../components/Adapter.js'
import { getCustom } from '../components/Custom.js'
import { getHeadImageFast, getAvatarFast } from './staticCache.js'
import Version from '../components/Version.js'
import formatTime from '../utils/formatTime.js'

export default new class getData {
  async getDashboardData() {
    const [cpu, memory, network, disk] = await Promise.all([
      getCpuLoadAndSpeed(),
      getMemoryUsageCircle(),
      getNetworkSpeed(),
      getDiskUsageCircle()
    ])
    return { cpu, memory, network, disk }
  }

  async getInfoData(bot) {
    const [cpu, system, gpu, plugin, adapter, account, custom] = await Promise.all([
      getCpuModel(),
      getSysInfo(),
      getGpuInfo(),
      getPluginNumInfo(),
      getAdapter(bot),
      getAccountInfo(bot),
      getCustom()
    ])
    return { cpu, system, gpu, plugin, adapter, account, custom }
  }

  async getData(e) {
    const bot = e.bot || global.Bot

    const [dashboardData, infoData, headImage, botAvatar] = await Promise.all([
      this.getDashboardData(),
      this.getInfoData(bot),
      getHeadImageFast(),
      getAvatarFast(bot)
    ])

    return {
      BotVersion: Version.isMiao ? 'Miao-Yunzai' : Version.isTrss ? 'TRSS-Yunzai' : 'Yunzai',
      BotAvatar: botAvatar,
      BotName: bot?.nickname?.substring(0, 10) || 'Shizuku',
      HeadImage: headImage,
      Dashboard: dashboardData,
      Info: infoData,
      Runtime: formatTime(Date.now() / 1000 - (global.Bot?.stat?.start_time || Date.now() / 1000), 'Bot已运行dd天hh小时mm分钟', false)
    }
  }
}
