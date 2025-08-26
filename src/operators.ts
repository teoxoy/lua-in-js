import { MetaMethods, Table } from './Table'
import { coerceToNumber, coerceToString, LuaType, coerceToBoolean } from './utils'
import { LuaError } from './LuaError'

const binaryArithmetic = <R extends boolean | number>(
    left: LuaType,
    right: LuaType,
    metaMethodName: MetaMethods,
    callback: (l: number, r: number) => R
): R => {
    const mm =
        (left instanceof Table && left.getMetaMethod(metaMethodName)) ||
        (right instanceof Table && right.getMetaMethod(metaMethodName))
    if (mm) return mm(left, right)[0]

    const L = coerceToNumber(left, 'attempt to perform arithmetic on a %type value')
    const R = coerceToNumber(right, 'attempt to perform arithmetic on a %type value')
    return callback(L, R)
}

const binaryBooleanArithmetic = (
    left: LuaType,
    right: LuaType,
    metaMethodName: MetaMethods,
    callback: (l: LuaType, r: LuaType) => boolean
): boolean => {
    if (
        (typeof left === 'string' && typeof right === 'string') ||
        (typeof left === 'number' && typeof right === 'number')
    ) {
        return callback(left, right)
    }
    return binaryArithmetic<boolean>(left, right, metaMethodName, callback)
}

// extra
const bool = (value: LuaType): boolean => coerceToBoolean(value)

// logical
const and = (l: () => LuaType, r: () => LuaType): LuaType => {
    const lv = l()
    return coerceToBoolean(lv) ? r() : lv
}

const or = (l: () => LuaType, r: () => LuaType): LuaType => {
    const lv = l()
    return coerceToBoolean(lv) ? lv : r()
}

// unary
const not = (value: LuaType): boolean => !bool(value)

const unm = (value: LuaType): number => {
    const mm = value instanceof Table && value.getMetaMethod('__unm')
    if (mm) return mm(value)[0]

    return -1 * coerceToNumber(value, 'attempt to perform arithmetic on a %type value')
}

const bnot = (value: LuaType): number => {
    const mm = value instanceof Table && value.getMetaMethod('__bnot')
    if (mm) return mm(value)[0]

    return ~coerceToNumber(value, 'attempt to perform arithmetic on a %type value')
}

const len = (value: LuaType): number => {
    if (value instanceof Table) {
        const mm = value.getMetaMethod('__len')
        if (mm) return mm(value)[0]

        return value.getn()
    }

    if (typeof value === 'string') return value.length

    throw new LuaError('attempt to get length of an unsupported value')

    // if (typeof value === 'object') {
    //     let length = 0
    //     for (const key in value) {
    //         if (hasOwnProperty(value, key)) {
    //             length += 1
    //         }
    //     }
    //     return length
    // }
}

// binary
const add = (left: LuaType, right: LuaType): number => binaryArithmetic(left, right, '__add', (l, r) => l + r)

const sub = (left: LuaType, right: LuaType): number => binaryArithmetic(left, right, '__sub', (l, r) => l - r)

const mul = (left: LuaType, right: LuaType): number => binaryArithmetic(left, right, '__mul', (l, r) => l * r)

const mod = (left: LuaType, right: LuaType): number =>
    binaryArithmetic(left, right, '__mod', (l, r) => {
        if (r === 0 || r === -Infinity || r === Infinity || isNaN(l) || isNaN(r)) return NaN

        const absR = Math.abs(r)
        let result = Math.abs(l) % absR

        if (l * r < 0) result = absR - result
        if (r < 0) result *= -1

        return result
    })

const pow = (left: LuaType, right: LuaType): number => binaryArithmetic(left, right, '__pow', Math.pow)

const div = (left: LuaType, right: LuaType): number =>
    binaryArithmetic(left, right, '__div', (l, r) => {
        if (r === undefined) throw new LuaError('attempt to perform arithmetic on a nil value')
        return l / r
    })

const idiv = (left: LuaType, right: LuaType): number =>
    binaryArithmetic(left, right, '__idiv', (l, r) => {
        if (r === undefined) throw new LuaError('attempt to perform arithmetic on a nil value')
        return Math.floor(l / r)
    })

const band = (left: LuaType, right: LuaType): number => binaryArithmetic(left, right, '__band', (l, r) => l & r)

const bor = (left: LuaType, right: LuaType): number => binaryArithmetic(left, right, '__bor', (l, r) => l | r)

const bxor = (left: LuaType, right: LuaType): number => binaryArithmetic(left, right, '__bxor', (l, r) => l ^ r)

const shl = (left: LuaType, right: LuaType): number => binaryArithmetic(left, right, '__shl', (l, r) => l << r)

const shr = (left: LuaType, right: LuaType): number => binaryArithmetic(left, right, '__shr', (l, r) => l >> r)

const concat = (left: LuaType, right: LuaType): string => {
    const mm =
        (left instanceof Table && left.getMetaMethod('__concat')) ||
        (right instanceof Table && right.getMetaMethod('__concat'))
    if (mm) return mm(left, right)[0]

    const L = coerceToString(left, 'attempt to concatenate a %type value')
    const R = coerceToString(right, 'attempt to concatenate a %type value')
    return `${L}${R}`
}

const neq = (left: LuaType, right: LuaType): boolean => !eq(left, right)

const eq = (left: LuaType, right: LuaType): boolean => {
    const mm =
        right !== left &&
        left instanceof Table &&
        right instanceof Table &&
        left.metatable === right.metatable &&
        left.getMetaMethod('__eq')

    if (mm) return !!mm(left, right)[0]

    return left === right
}

const lt = (left: LuaType, right: LuaType): boolean => binaryBooleanArithmetic(left, right, '__lt', (l, r) => l < r)

const le = (left: LuaType, right: LuaType): boolean => binaryBooleanArithmetic(left, right, '__le', (l, r) => l <= r)

const gt = (left: LuaType, right: LuaType): boolean => !le(left, right)

const ge = (left: LuaType, right: LuaType): boolean => !lt(left, right)

const operators = {
    bool,
    and,
    or,
    not,
    unm,
    bnot,
    len,
    add,
    sub,
    mul,
    mod,
    pow,
    div,
    idiv,
    band,
    bor,
    bxor,
    shl,
    shr,
    concat,
    neq,
    eq,
    lt,
    le,
    gt,
    ge
}

export { operators }
