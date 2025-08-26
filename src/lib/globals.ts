import { parse } from '../parser'
import { Table } from '../Table'
import { LuaError } from '../LuaError'
import {
    LuaType,
    Config,
    type,
    tostring,
    posrelat,
    coerceToNumber,
    coerceToString,
    coerceToBoolean,
    coerceArgToNumber,
    coerceArgToString,
    coerceArgToTable,
    hasOwnProperty
} from '../utils'
import { metatable as stringMetatable } from './string'

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function ipairsIterator(table: Table, index: number): LuaType[] {
    if (index === undefined) {
        throw new LuaError('Bad argument #2 to ipairs() iterator')
    }

    const nextIndex = index + 1
    const numValues = table.numValues

    if (!numValues[nextIndex] || numValues[nextIndex] === undefined) return undefined
    return [nextIndex, numValues[nextIndex]]
}

const _VERSION = 'Lua 5.3'

function assert(v: LuaType, m?: LuaType): [unknown, unknown] {
    if (coerceToBoolean(v)) return [v, m]

    const msg = m === undefined ? 'Assertion failed!' : coerceArgToString(m, 'assert', 2)
    throw new LuaError(msg)
}

function collectgarbage(): [] {
    // noop
    return []
}

function error(message: LuaType): void {
    const msg = coerceArgToString(message, 'error', 1)
    throw new LuaError(msg)
}

/**
 * If object does not have a metatable, returns nil.
 * Otherwise, if the object's metatable has a __metatable field, returns the associated value.
 * Otherwise, returns the metatable of the given object.
 */
function getmetatable(table: LuaType): Table {
    if (table instanceof Table && table.metatable) {
        const mm = table.metatable.rawget('__metatable') as Table
        return mm ? mm : table.metatable
    }
    if (typeof table === 'string') {
        return stringMetatable
    }
}

/**
 * Returns three values (an iterator function, the table t, and 0) so that the construction
 *
 *      `for i,v in ipairs(t) do body end`
 *
 * will iterate over the key–value pairs (1,t[1]), (2,t[2]), ..., up to the first nil value.
 */
function ipairs(t: LuaType): [Function, Table, number] {
    const table = coerceArgToTable(t, 'ipairs', 1)
    const mm = table.getMetaMethod('__pairs') || table.getMetaMethod('__ipairs')
    return mm ? mm(table).slice(0, 3) : [ipairsIterator, table, 0]
}

/**
 * Allows a program to traverse all fields of a table.
 * Its first argument is a table and its second argument is an index in this table.
 * next returns the next index of the table and its associated value.
 * When called with nil as its second argument, next returns an initial index and its associated value.
 * When called with the last index, or with nil in an empty table, next returns nil.
 * If the second argument is absent, then it is interpreted as nil.
 * In particular, you can use next(t) to check whether a table is empty.
 *
 * The order in which the indices are enumerated is not specified, even for numeric indices.
 * (To traverse a table in numerical order, use a numerical for.)
 *
 * The behavior of next is undefined if, during the traversal, you assign any value to a non-existent field in the table.
 * You may however modify existing fields. In particular, you may clear existing fields.
 */
function next(table: LuaType, index?: LuaType): [number | string, LuaType] {
    const TABLE = coerceArgToTable(table, 'next', 1)

    // SLOOOOOOOW...
    let found = index === undefined

    if (found || (typeof index === 'number' && index > 0)) {
        const numValues = TABLE.numValues
        const keys = Object.keys(numValues)
        let i = 1

        if (!found) {
            const I = keys.indexOf(`${index}`)
            if (I >= 0) {
                found = true
                i += I
            }
        }

        if (found) {
            for (i; keys[i] !== undefined; i++) {
                const key = Number(keys[i])
                const value = numValues[key]
                if (value !== undefined) return [key, value]
            }
        }
    }

    for (const i in TABLE.strValues) {
        if (hasOwnProperty(TABLE.strValues, i)) {
            if (!found) {
                if (i === index) found = true
            } else if (TABLE.strValues[i] !== undefined) {
                return [i, TABLE.strValues[i]]
            }
        }
    }

    for (const i in TABLE.keys) {
        if (hasOwnProperty(TABLE.keys, i)) {
            const key = TABLE.keys[i]

            if (!found) {
                if (key === index) found = true
            } else if (TABLE.values[i] !== undefined) {
                return [key, TABLE.values[i]]
            }
        }
    }
}

/**
 * If t has a metamethod __pairs, calls it with t as argument and returns the first three results from the call.
 *
 * Otherwise, returns three values: the next function, the table t, and nil, so that the construction
 *
 *      `for k,v in pairs(t) do body end`
 *
 * will iterate over all key–value pairs of table t.
 *
 * See function next for the caveats of modifying the table during its traversal.
 */
function pairs(t: LuaType): [Function, Table, undefined] {
    const table = coerceArgToTable(t, 'pairs', 1)
    const mm = table.getMetaMethod('__pairs')
    return mm ? mm(table).slice(0, 3) : [next, table, undefined]
}

/**
 * Calls function f with the given arguments in protected mode.
 * This means that any error inside f is not propagated;
 * instead, pcall catches the error and returns a status code.
 * Its first result is the status code (a boolean), which is true if the call succeeds without errors.
 * In such case, pcall also returns all results from the call, after this first result.
 * In case of any error, pcall returns false plus the error message.
 */
function pcall(f: LuaType, ...args: LuaType[]): [false, string] | [true, ...LuaType[]] {
    if (typeof f !== 'function') {
        throw new LuaError('Attempt to call non-function')
    }

    try {
        return [true, ...f(...args)]
    } catch (e) {
        return [false, e && e.toString()]
    }
}

/**
 * Checks whether v1 is equal to v2, without invoking the __eq metamethod. Returns a boolean.
 */
function rawequal(v1: LuaType, v2: LuaType): boolean {
    return v1 === v2
}

/**
 * Gets the real value of table[index], without invoking the __index metamethod.
 * table must be a table; index may be any value.
 */
function rawget(table: LuaType, index: LuaType): LuaType {
    const TABLE = coerceArgToTable(table, 'rawget', 1)
    return TABLE.rawget(index)
}

/**
 * Returns the length of the object v, which must be a table or a string, without invoking the __len metamethod.
 * Returns an integer.
 */
function rawlen(v: LuaType): number {
    if (v instanceof Table) return v.getn()

    if (typeof v === 'string') return v.length

    throw new LuaError('attempt to get length of an unsupported value')
}

/**
 * Sets the real value of table[index] to value, without invoking the __newindex metamethod.
 * table must be a table, index any value different from nil and NaN, and value any Lua value.
 *
 * This function returns table.
 */
function rawset(table: LuaType, index: LuaType, value: LuaType): Table {
    const TABLE = coerceArgToTable(table, 'rawset', 1)
    if (index === undefined) throw new LuaError('table index is nil')

    TABLE.rawset(index, value)
    return TABLE
}

/**
 * If index is a number, returns all arguments after argument number index;
 * a negative number indexes from the end (-1 is the last argument).
 * Otherwise, index must be the string "#", and select returns the total number of extra arguments it received.
 */
function select(index: number | '#', ...args: LuaType[]): LuaType[] | number {
    if (index === '#') {
        return args.length
    }

    if (typeof index === 'number') {
        const pos = posrelat(Math.trunc(index), args.length)
        return args.slice(pos - 1)
    }

    throw new LuaError(`bad argument #1 to 'select' (number expected, got ${type(index)})`)
}

/**
 * Sets the metatable for the given table.
 * (To change the metatable of other types from Lua code,you must use the debug library (§6.10).)
 * If metatable is nil, removes the metatable of the given table.
 * If the original metatable has a __metatable field, raises an error.
 *
 * This function returns table.
 */
function setmetatable(table: LuaType, metatable: LuaType): Table {
    const TABLE = coerceArgToTable(table, 'setmetatable', 1)

    if (TABLE.metatable && TABLE.metatable.rawget('__metatable')) {
        throw new LuaError('cannot change a protected metatable')
    }

    TABLE.metatable =
        metatable === null || metatable === undefined ? null : coerceArgToTable(metatable, 'setmetatable', 2)
    return TABLE
}

/**
 * When called with no base, tonumber tries to convert its argument to a number.
 * If the argument is already a number or a string convertible to a number,
 * then tonumber returns this number; otherwise, it returns nil.
 *
 * The conversion of strings can result in integers or floats,
 * according to the lexical conventions of Lua (see §3.1).
 * (The string may have leading and trailing spaces and a sign.)
 *
 * When called with base, then e must be a string to be interpreted as an integer numeral in that base.
 * The base may be any integer between 2 and 36, inclusive.
 * In bases above 10, the letter 'A' (in either upper or lower case) represents 10,
 * 'B' represents 11, and so forth, with 'Z' representing 35.
 * If the string e is not a valid numeral in the given base, the function returns nil.
 */
function tonumber(e: LuaType, base: LuaType): number {
    const E = coerceToString(e).trim()
    const BASE = base === undefined ? 10 : coerceArgToNumber(base, 'tonumber', 2)

    if (BASE !== 10 && E === 'nil') {
        throw new LuaError("bad argument #1 to 'tonumber' (string expected, got nil)")
    }

    if (BASE < 2 || BASE > 36) {
        throw new LuaError(`bad argument #2 to 'tonumber' (base out of range)`)
    }

    if (E === '') return
    if (BASE === 10) return coerceToNumber(E)

    const pattern = new RegExp(`^${BASE === 16 ? '(0x)?' : ''}[${CHARS.substr(0, BASE)}]*$`, 'gi')

    if (!pattern.test(E)) return // Invalid
    return parseInt(E, BASE)
}

/**
 * This function is similar to pcall, except that it sets a new message handler msgh.
 */
function xpcall(f: LuaType, msgh: LuaType, ...args: LuaType[]): [false, string] | [true, ...LuaType[]] {
    if (typeof f !== 'function' || typeof msgh !== 'function') {
        throw new LuaError('Attempt to call non-function')
    }

    try {
        return [true, ...f(...args)]
    } catch (e) {
        return [false, msgh(e)[0]]
    }
}

function createG(cfg: Config, execChunk: (_G: Table, chunk: string) => LuaType[]): Table {
    function print(...args: LuaType[]): void {
        const output = args.map(arg => tostring(arg)).join('\t')
        cfg.stdout(output)
    }

    function load(
        chunk: LuaType,
        _chunkname?: string,
        _mode?: 'b' | 't' | 'bt',
        env?: Table
    ): [undefined, string] | (() => LuaType[]) {
        let C = ''
        if (chunk instanceof Function) {
            let ret = ' '
            while (ret !== '' && ret !== undefined) {
                C += ret
                ret = chunk()[0]
            }
        } else {
            C = coerceArgToString(chunk, 'load', 1)
        }

        let parsed: string
        try {
            parsed = parse(C)
        } catch (e) {
            return [undefined, e.message]
        }

        return () => execChunk(env || _G, parsed)
    }

    function dofile(filename?: LuaType): LuaType[] {
        const res = loadfile(filename)

        if (Array.isArray(res) && res[0] === undefined) {
            throw new LuaError(res[1])
        }

        const exec = res as () => LuaType[]
        return exec()
    }

    function loadfile(
        filename?: LuaType,
        mode?: 'b' | 't' | 'bt',
        env?: Table
    ): [undefined, string] | (() => LuaType[]) {
        const FILENAME = filename === undefined ? cfg.stdin : coerceArgToString(filename, 'loadfile', 1)

        if (!cfg.fileExists) {
            throw new LuaError('loadfile requires the config.fileExists function')
        }

        if (!cfg.fileExists(FILENAME)) return [undefined, 'file not found']

        if (!cfg.loadFile) {
            throw new LuaError('loadfile requires the config.loadFile function')
        }

        return load(cfg.loadFile(FILENAME), FILENAME, mode, env)
    }

    const _G = new Table({
        _VERSION,
        assert,
        dofile,
        collectgarbage,
        error,
        getmetatable,
        ipairs,
        load,
        loadfile,
        next,
        pairs,
        pcall,
        print,
        rawequal,
        rawget,
        rawlen,
        rawset,
        select,
        setmetatable,
        tonumber,
        tostring,
        type,
        xpcall
    })

    return _G
}

export { tostring, createG }
