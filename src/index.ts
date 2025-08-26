/* eslint-disable import/order */
/* eslint-disable import/no-duplicates */
import { Scope } from './Scope'
import { createG } from './lib/globals'
import { operators } from './operators'
import { Table } from './Table'
import { LuaError } from './LuaError'
import { libMath } from './lib/math'
import { libTable } from './lib/table'
import { libString, metatable as stringMetatable } from './lib/string'
import { getLibOS } from './lib/os'
import { getLibPackage } from './lib/package'
import { libCoroutine } from './lib/coroutine'
import { LuaType, ensureArray, Config, hasOwnProperty } from './utils'
import { Thread } from './Thread'
import { parse as parseScript } from './parser'

interface Script {
    exec: () => LuaType
}

const call = (f: Function | Table | Thread, ...args: LuaType[]): LuaType[] => {
    if (f instanceof Thread) return f.resume(...args)

    if (f instanceof Function) {
        const res = f(...args)
        if (res && typeof res.next === 'function') {
            let r = res.next()
            while (!r.done) r = res.next()
            return ensureArray(r.value)
        }
        return ensureArray(res as LuaType)
    }

    const mm = f instanceof Table && f.getMetaMethod('__call')
    if (mm) return ensureArray(mm(f, ...args))

    throw new LuaError(`attempt to call an uncallable type`)
}

const stringTable = new Table()
stringTable.metatable = stringMetatable

const get = (t: Table | string, v: LuaType): LuaType => {
    if (t instanceof Table) return t.get(v)
    if (typeof t === 'string') return stringTable.get(v)

    throw new LuaError(`no table or metatable found for given type`)
}

const execChunk = (_G: Table, chunk: string, chunkName?: string): LuaType[] => {
    const exec = new Function(`return ${chunk}`)() as (lua: unknown) => Generator<LuaType[]>
    const globalScope = new Scope(_G.strValues).extend()
    if (chunkName) globalScope.setVarargs([chunkName])
    const iterator = exec({
        globalScope,
        ...operators,
        Table,
        call,
        get
    })
    let res = iterator.next()
    while (!res.done) {
        res = iterator.next()
    }
    return res.value === undefined ? [undefined] : res.value
}

function createEnv(
    config: Config = {}
): {
    parse: (script: string) => Script
    parseFile: (path: string) => Script
    loadLib: (name: string, value: Table) => void
    extendLib: (name: string, value: Table) => void
} {
    const cfg: Config = {
        LUA_PATH: './?.lua',
        stdin: '',
        stdout: console.log,
        ...config
    }

    const _G = createG(cfg, execChunk)

    const { libPackage, _require } = getLibPackage(
        (content, moduleName) => execChunk(_G, parseScript(content), moduleName)[0],
        cfg
    )
    const loaded = libPackage.get('loaded') as Table

    const loadLib = (name: string, value: Table): void => {
        _G.rawset(name, value)
        loaded.rawset(name, value)
    }

    const extendLib = (name: string, value: Table): void => {
        const lib = _G.rawget(name)
        if (lib instanceof Table) {
            for (let i = 1; i < value.numValues.length; i++) {
                if (hasOwnProperty(value.numValues, i)) lib.rawset(i, value.numValues[i])
            }
            for (const key in value.strValues) {
                if (hasOwnProperty(value.strValues, key)) lib.rawset(key, value.strValues[key])
            }
            for (let i = 0; i < value.keys.length; i++) {
                lib.rawset(value.keys[i], value.values[i])
            }
            return
        }

        loadLib(name, value)
    }

    loadLib('_G', _G)
    loadLib('package', libPackage)
    loadLib('math', libMath)
    loadLib('table', libTable)
    loadLib('string', libString)
    loadLib('os', getLibOS(cfg))
    loadLib('coroutine', libCoroutine)

    _G.rawset('require', _require)

    const parse = (code: string): Script => {
        const script = parseScript(code)
        return {
            exec: () => execChunk(_G, script)[0]
        }
    }

    const parseFile = (filename: string): Script => {
        if (!cfg.fileExists) throw new LuaError('parseFile requires the config.fileExists function')
        if (!cfg.loadFile) throw new LuaError('parseFile requires the config.loadFile function')

        if (!cfg.fileExists(filename)) throw new LuaError('file not found')

        return parse(cfg.loadFile(filename))
    }

    return {
        parse,
        parseFile,
        loadLib,
        extendLib
    }
}

// eslint-disable-next-line import/first
import * as utils from './utils'
export { createEnv, Table, LuaError, utils }
