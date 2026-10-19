import Config from "./components/Config.js";
import lodash from "lodash";
import path from "path";
import { pluginRoot } from "./model/path.js";

export function supportGuoba() {
  return {
    pluginInfo: {
      name: 'neko-status-plugin',
      title: '猫猫状态插件',
      author: ['@erzaozi', '@CikeyQi'],
      authorLink: ['https://github.com/erzaozi', 'https://github.com/CikeyQi'],
      link: 'https://github.com/erzaozi/neko-status-plugin',
      isV3: true,
      isV2: false,
      showInMenu: true,
      description: '基于 Yunzai 的机器人状态查看插件（加速版）',
      icon: 'noto-v1:cat',
      iconColor: '#d19f56',
      iconPath: path.join(pluginRoot, 'resources/readme/girl.png'),
    },
    configInfo: {
      schemas: [
        {
          field: "use_template",
          label: "使用模板",
          bottomHelpMessage: "选择一个模板来展示系统状态",
          component: "Select",
          componentProps: {
            options: Config.getTemplate(),
          },
        },
        {
          field: "headimg_url",
          label: "头图地址",
          bottomHelpMessage: "输入一个图片地址来作为头图",
          component: "Input",
          componentProps: {
            placeholder: '图片地址，请自行测试是否有效',
          },
        },
        {
          field: "headimg_cache_ttl",
          label: "头图缓存秒数",
          bottomHelpMessage: "远程头图缓存时间，0 仍会后台刷新，请求不再等待下载",
          component: "InputNumber",
          componentProps: {
            min: 0,
            max: 86400,
          },
        },
        {
          field: "screenshot_type",
          label: "截图格式",
          bottomHelpMessage: "jpeg 编码更快、体积更小；png 更清晰",
          component: "Select",
          componentProps: {
            options: [
              { label: 'jpeg（推荐）', value: 'jpeg' },
              { label: 'png', value: 'png' },
            ],
          },
        },
        {
          field: "screenshot_quality",
          label: "JPEG 质量",
          bottomHelpMessage: "仅 jpeg 生效，80-90 是速度与清晰度的平衡点",
          component: "InputNumber",
          componentProps: {
            min: 50,
            max: 100,
          },
        },
        {
          field: "custom_timeout",
          label: "自定义命令超时(ms)",
          bottomHelpMessage: "自定义展示命令的最长等待，超时跳过该项",
          component: "InputNumber",
          componentProps: {
            min: 200,
            max: 10000,
          },
        },
        {
          field: "custom",
          label: "自定义内容",
          bottomHelpMessage: "自定义内容",
          component: "GSubForm",
          componentProps: {
            multiple: true,
            schemas: [
              {
                field: "name",
                label: "名称",
                component: "Input",
                required: true,
                componentProps: {
                  placeholder: '例：系统名称',
                },
              },
              {
                field: "command",
                label: "命令",
                component: "Input",
                required: true,
                componentProps: {
                  placeholder: '例：uname',
                },
              },
            ],
          },
        },
      ],
      getConfigData() {
        let config = Config.getConfig()
        return config
      },

      setConfigData(data, { Result }) {
        let config = {}
        for (let [keyPath, value] of Object.entries(data)) {
          lodash.set(config, keyPath, value)
        }
        config = lodash.merge({}, Config.getConfig(), config)
        config.custom = data['custom']
        Config.setConfig(config)
        return Result.ok({}, '保存成功~')
      },
    },
  }
}
