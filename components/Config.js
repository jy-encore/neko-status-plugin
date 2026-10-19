import YAML from 'yaml'
import fs from 'fs'
import { pluginRoot, pluginResources } from '../model/path.js'
import Log from '../utils/logs.js'

class Config {
  constructor() {
    this._cache = null
    this._mtime = -1
    this._path = `${pluginRoot}/config/config/config.yaml`
    this._defPath = `${pluginRoot}/config/config_default.yaml`
  }

  getConfig() {
    try {
      const stat = fs.statSync(this._path)
      if (this._cache && stat.mtimeMs === this._mtime) return this._cache
      this._cache = YAML.parse(fs.readFileSync(this._path, 'utf-8'))
      this._mtime = stat.mtimeMs
      return this._cache
    } catch (err) {
      Log.e('读取config.yaml失败', err)
      return this.getDefConfig()
    }
  }

  getDefConfig() {
    try {
      return YAML.parse(fs.readFileSync(this._defPath, 'utf-8'))
    } catch (err) {
      Log.e('读取config_default.yaml失败', err)
      return false
    }
  }

  setConfig(config_data) {
    try {
      fs.writeFileSync(this._path, YAML.stringify(config_data))
      this._cache = config_data
      try {
        this._mtime = fs.statSync(this._path).mtimeMs
      } catch {
        this._mtime = Date.now()
      }
      return true
    } catch (err) {
      Log.e('写入config.yaml失败', err)
      return false
    }
  }

  getTemplate() {
    try {
      const template = fs.readdirSync(`${pluginResources}/template`)
      return template.map((item) => ({ label: item + '模板', value: item }))
    } catch (err) {
      Log.e('读取template失败', err)
      return [{ label: '读取失败', value: 'default' }]
    }
  }
}

export default new Config()
