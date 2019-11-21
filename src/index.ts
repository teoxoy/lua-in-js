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
import { LuaType, ensureArray, Config } from './utils'
import { parse } from './parser'

const call = (f: Function | Table, ...args: LuaType[]): LuaType[] => {
    if (f instanceof Function) return ensureArray(f(...args))

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
    const exec = new Function('__lua', chunk)
    const globalScope = new Scope(_G.strValues).extend()
    if (chunkName) globalScope.setVarargs([chunkName])
    const res = exec({
        globalScope,
        ...operators,
        Table,
        call,
        get
    })
    return res === undefined ? [undefined] : res
}

function createEnv(
    config: Config = {}
): {
    run: (script: string) => LuaType
    runfile: (path: string) => LuaType
    loadLib: (name: string, value: Table) => void
} {
    const cfg: Config = {
        LUA_PATH: './?.lua',
        stdin: '',
        stdout: console.log,
        ...config
    }

    const _G = createG(cfg, execChunk)

    const { libPackage, _require } = getLibPackage(
        (content, moduleName) => execChunk(_G, parse(content), moduleName)[0],
        cfg
    )
    const loaded = libPackage.get('loaded') as Table

    const loadLib = (name: string, value: Table): void => {
        _G.rawset(name, value)
        loaded.rawset(name, value)
    }

    loadLib('_G', _G)
    loadLib('package', libPackage)
    loadLib('math', libMath)
    loadLib('table', libTable)
    loadLib('string', libString)
    loadLib('os', getLibOS(cfg))

    _G.rawset('require', _require)

    const run = (script: string): LuaType => execChunk(_G, parse(script))[0]
    const runfile = (filename: string): LuaType => {
        if (!cfg.fileExists) throw new LuaError('runfile requires the config.fileExists function')
        if (!cfg.loadFile) throw new LuaError('runfile requires the config.loadFile function')

        if (!cfg.fileExists(filename)) throw new LuaError('file not found')

        return run(cfg.loadFile(filename))
    }

    return {
        run,
        runfile,
        loadLib
    }
}

// eslint-disable-next-line import/first
import * as utils from './utils'
export { createEnv, Table, LuaError, utils }
