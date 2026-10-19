import plugin from '../../../lib/plugins/plugin.js'
import { pluginResources } from '../model/path.js'
import getData from '../model/getData.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
import Config from '../components/Config.js'

export class neko_status extends plugin {
  constructor() {
    super({
      name: 'Neko状态',
      dsc: '获取Neko状态',
      event: 'message',
      priority: -1009,
      rule: [
        {
          reg: '^[/#]?(状态|status)$',
          fnc: 'status'
        }
      ]
    })
  }

  async status(e) {
    const t0 = Date.now()
    const config = Config.getConfig() || {}
    const data = await getData.getData(e)
    const t1 = Date.now()

    const imgType = config.screenshot_type || 'jpeg'
    const screenshotOpts = {
      saveId: 'status',
      imgType,
      tplFile: `${pluginResources}/template/${config.use_template || 'default'}/template.html`,
      pluginResources,
      data,
      pageGotoParams: {
        waitUntil: 'load',
        timeout: 15000
      }
    }
    if (imgType !== 'png') {
      screenshotOpts.quality = Number(config.screenshot_quality || 90)
    }

    const base64 = await puppeteer.screenshot('neko-status-plugin', screenshotOpts)
    const t2 = Date.now()
    logger.mark(`[Neko状态] 采集 ${t1 - t0}ms / 截图 ${t2 - t1}ms / 合计 ${t2 - t0}ms`)
    await e.reply(base64)
    return true
  }
}
