import { Table } from '../Table'
import { coerceArgToNumber, LuaType, coerceToNumber } from '../utils'

const maxinteger = Number.MAX_SAFE_INTEGER
const mininteger = Number.MIN_SAFE_INTEGER
const huge = Infinity
const pi = Math.PI

let randomSeed = 1

function getRandom(): number {
    randomSeed = (16807 * randomSeed) % 2147483647
    return randomSeed / 2147483647
}

function abs(x: LuaType): number {
    const X = coerceArgToNumber(x, 'abs', 1)
    return Math.abs(X)
}

function acos(x: LuaType): number {
    const X = coerceArgToNumber(x, 'acos', 1)
    return Math.acos(X)
}

function asin(x: LuaType): number {
    const X = coerceArgToNumber(x, 'asin', 1)
    return Math.asin(X)
}

function atan(y: LuaType, x?: LuaType): number {
    const Y = coerceArgToNumber(y, 'atan', 1)
    const X = x === undefined ? 1 : coerceArgToNumber(x, 'atan', 2)
    return Math.atan2(Y, X)
}

function atan2(y: LuaType, x: LuaType): number {
    return atan(y, x)
}

function ceil(x: LuaType): number {
    const X = coerceArgToNumber(x, 'ceil', 1)
    return Math.ceil(X)
}

function cos(x: LuaType): number {
    const X = coerceArgToNumber(x, 'cos', 1)
    return Math.cos(X)
}

function cosh(x: LuaType): number {
    const X = coerceArgToNumber(x, 'cosh', 1)
    return (exp(X) + exp(-X)) / 2
}

function deg(x: LuaType): number {
    const X = coerceArgToNumber(x, 'deg', 1)
    return (X * 180) / Math.PI
}

function exp(x: LuaType): number {
    const X = coerceArgToNumber(x, 'exp', 1)
    return Math.exp(X)
}

function floor(x: LuaType): number {
    const X = coerceArgToNumber(x, 'floor', 1)
    return Math.floor(X)
}

function fmod(x: LuaType, y: LuaType): number {
    const X = coerceArgToNumber(x, 'fmod', 1)
    const Y = coerceArgToNumber(y, 'fmod', 2)
    return X % Y
}

function frexp(x: LuaType): number[] {
    let X = coerceArgToNumber(x, 'frexp', 1)

    if (X === 0) {
        return [0, 0]
    }

    const delta = X > 0 ? 1 : -1
    X *= delta

    const exponent = Math.floor(Math.log(X) / Math.log(2)) + 1
    const mantissa = X / Math.pow(2, exponent)

    return [mantissa * delta, exponent]
}

function ldexp(m: LuaType, e: LuaType): number {
    const M = coerceArgToNumber(m, 'ldexp', 1)
    const E = coerceArgToNumber(e, 'ldexp', 2)
    return M * Math.pow(2, E)
}

function log(x: LuaType, base?: LuaType): number {
    const X = coerceArgToNumber(x, 'log', 1)
    if (base === undefined) {
        return Math.log(X)
    } else {
        const B = coerceArgToNumber(base, 'log', 2)
        return Math.log(X) / Math.log(B)
    }
}

function log10(x: LuaType): number {
    const X = coerceArgToNumber(x, 'log10', 1)
    // v5.2: warn ('math.log10 is deprecated. Use math.log with 10 as its second argument instead.');
    return Math.log(X) / Math.log(10)
}

function max(...args: LuaType[]): number {
    const ARGS = args.map((n, i) => coerceArgToNumber(n, 'max', i + 1))
    return Math.max(...ARGS)
}

function min(...args: LuaType[]): number {
    const ARGS = args.map((n, i) => coerceArgToNumber(n, 'min', i + 1))
    return Math.min(...ARGS)
}

function modf(x: LuaType): number[] {
    const X = coerceArgToNumber(x, 'modf', 1)
    const intValue = Math.floor(X)
    const mantissa = X - intValue
    return [intValue, mantissa]
}

function pow(x: LuaType, y: LuaType): number {
    const X = coerceArgToNumber(x, 'pow', 1)
    const Y = coerceArgToNumber(y, 'pow', 2)
    return Math.pow(X, Y)
}

function rad(x: LuaType): number {
    const X = coerceArgToNumber(x, 'rad', 1)
    return (Math.PI / 180) * X
}

function random(min?: LuaType, max?: LuaType): number {
    if (min === undefined && max === undefined) return getRandom()
    const firstArg = coerceArgToNumber(min, 'random', 1)
    const MIN = max === undefined ? 1 : firstArg
    const MAX = max === undefined ? firstArg : coerceArgToNumber(max, 'random', 2)

    if (MIN > MAX) throw new Error("bad argument #2 to 'random' (interval is empty)")
    return Math.floor(getRandom() * (MAX - MIN + 1) + MIN)
}

function randomseed(x: LuaType): void {
    randomSeed = coerceArgToNumber(x, 'randomseed', 1)
}

function sin(x: LuaType): number {
    const X = coerceArgToNumber(x, 'sin', 1)
    return Math.sin(X)
}

function sinh(x: LuaType): number {
    const X = coerceArgToNumber(x, 'sinh', 1)
    return (exp(X) - exp(-X)) / 2
}

function sqrt(x: LuaType): number {
    const X = coerceArgToNumber(x, 'sqrt', 1)
    return Math.sqrt(X)
}

function tan(x: LuaType): number {
    const X = coerceArgToNumber(x, 'tan', 1)
    return Math.tan(X)
}

function tanh(x: LuaType): number {
    const X = coerceArgToNumber(x, 'tanh', 1)
    return (exp(X) - exp(-X)) / (exp(X) + exp(-X))
}

function tointeger(x: LuaType): number {
    const X = coerceToNumber(x)
    if (X === undefined) return undefined
    return Math.floor(X)
}

function type(x: LuaType): string {
    const X = coerceToNumber(x)
    if (X === undefined) return undefined
    if (tointeger(X) === X) return 'integer'
    return 'float'
}

function ult(m: LuaType, n: LuaType): boolean {
    const M = coerceArgToNumber(m, 'ult', 1)
    const N = coerceArgToNumber(n, 'ult', 2)

    const toUnsigned = (n: number): number => n >>> 0
    return toUnsigned(M) < toUnsigned(N)
}

const libMath = new Table({
    abs,
    acos,
    asin,
    atan,
    atan2,
    ceil,
    cos,
    cosh,
    deg,
    exp,
    floor,
    fmod,
    frexp,
    huge,
    ldexp,
    log,
    log10,
    max,
    min,
    maxinteger,
    mininteger,
    modf,
    pi,
    pow,
    rad,
    random,
    randomseed,
    sin,
    sinh,
    sqrt,
    tan,
    tanh,
    tointeger,
    type,
    ult
})

export { libMath }
