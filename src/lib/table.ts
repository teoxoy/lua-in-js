import { Table, getn } from '../Table'
import {
    LuaType,
    coerceToBoolean,
    coerceArgToNumber,
    coerceArgToString,
    coerceArgToTable,
    coerceArgToFunction
} from '../utils'
import { LuaError } from '../LuaError'

/**
 * Given a list where all elements are strings or numbers, returns the string list[i]..sep..list[i+1] ··· sep..list[j].
 * The default value for sep is the empty string, the default for i is 1, and the default for j is #list.
 * If i is greater than j, returns the empty string.
 */
function concat(table: LuaType, sep: LuaType = '', i: LuaType = 1, j?: LuaType): string {
    const TABLE = coerceArgToTable(table, 'concat', 1)
    const SEP = coerceArgToString(sep, 'concat', 2)
    const I = coerceArgToNumber(i, 'concat', 3)
    const J = j === undefined ? maxn(TABLE) : coerceArgToNumber(j, 'concat', 4)

    return []
        .concat(TABLE.numValues)
        .splice(I, J - I + 1)
        .join(SEP)
}

/**
 * Inserts element value at position pos in list, shifting up the elements list[pos], list[pos+1], ···, list[#list].
 * The default value for pos is #list+1, so that a call table.insert(t,x) inserts x at the end of list t.
 */
function insert(table: LuaType, pos: LuaType, value?: LuaType): void {
    const TABLE = coerceArgToTable(table, 'insert', 1)
    const POS = value === undefined ? TABLE.numValues.length : coerceArgToNumber(pos, 'insert', 2)
    const VALUE = value === undefined ? pos : value

    TABLE.numValues.splice(POS, 0, undefined)
    TABLE.set(POS, VALUE)
}

function maxn(table: LuaType): number {
    const TABLE = coerceArgToTable(table, 'maxn', 1)
    return TABLE.numValues.length - 1
}

/**
 * Moves elements from table a1 to table a2, performing the equivalent to the following multiple assignment:
 *
 *      `a2[t],··· = a1[f],···,a1[e].`
 *
 * The default for a2 is a1.
 * The destination range can overlap with the source range.
 * The number of elements to be moved must fit in a Lua integer.
 *
 * Returns the destination table a2.
 */
function move(a1: LuaType, f: LuaType, e: LuaType, t: LuaType, a2?: LuaType): Table {
    const A1 = coerceArgToTable(a1, 'move', 1)
    const F = coerceArgToNumber(f, 'move', 2)
    const E = coerceArgToNumber(e, 'move', 3)
    const T = coerceArgToNumber(t, 'move', 4)
    const A2 = a2 === undefined ? A1 : coerceArgToTable(a2, 'move', 5)

    if (E >= F) {
        if (F <= 0 && E >= Number.MAX_SAFE_INTEGER + F) throw new LuaError('too many elements to move')
        const n = E - F + 1 // number of elements to movea
        if (T > Number.MAX_SAFE_INTEGER - n + 1) throw new LuaError('destination wrap around')

        if (T > E || T <= F || A2 !== A1) {
            for (let i = 0; i < n; i++) {
                const v = A1.get(F + i)
                A2.set(T + i, v)
            }
        } else {
            for (let i = n - 1; i >= 0; i--) {
                const v = A1.get(F + i)
                A2.set(T + i, v)
            }
        }
    }

    return A2
}

/**
 * Returns a new table with all arguments stored into keys 1, 2, etc. and with a field "n" with the total number of arguments.
 * Note that the resulting table may not be a sequence.
 */
function pack(...args: LuaType[]): Table {
    const table = new Table(args)
    table.rawset('n', args.length)
    return table
}

/**
 * Removes from list the element at position pos, returning the value of the removed element.
 * When pos is an integer between 1 and #list, it shifts down the elements list[pos+1], list[pos+2], ···, list[#list] and
 * erases element list[#list]; The index pos can also be 0 when #list is 0, or #list + 1;
 * in those cases, the function erases the element list[pos].
 *
 * The default value for pos is #list, so that a call table.remove(l) removes the last element of list l.
 */
function remove(table: LuaType, pos?: LuaType): LuaType {
    const TABLE = coerceArgToTable(table, 'remove', 1)
    const max = getn(TABLE)
    const POS = pos === undefined ? max : coerceArgToNumber(pos, 'remove', 2)

    if (POS > max || POS < 0) {
        return
    }

    const vals = TABLE.numValues
    const result = vals.splice(POS, 1)[0]

    let i = POS
    while (i < max && vals[i] === undefined) {
        delete vals[i]
        i += 1
    }

    return result
}

/**
 * Sorts list elements in a given order, in-place, from list[1] to list[#list].
 * If comp is given, then it must be a function that receives two list elements and
 * returns true when the first element must come before the second in the final order
 * (so that, after the sort, i < j implies not comp(list[j],list[i])).
 * If comp is not given, then the standard Lua operator < is used instead.
 *
 * Note that the comp function must define a strict partial order over the elements in the list;
 * that is, it must be asymmetric and transitive. Otherwise, no valid sort may be possible.
 *
 * The sort algorithm is not stable: elements considered equal by the given order may have
 * their relative positions changed by the sort.
 */
function sort(table: Table, comp?: Function): void {
    const TABLE = coerceArgToTable(table, 'sort', 1)

    let sortFunc: (a: LuaType, b: LuaType) => number

    if (comp) {
        const COMP = coerceArgToFunction(comp, 'sort', 2)
        sortFunc = (a, b) => (coerceToBoolean(COMP(a, b)[0]) ? -1 : 1)
    } else {
        sortFunc = (a, b) => (a < b ? -1 : 1)
    }

    const arr = TABLE.numValues
    arr.shift()
    arr.sort(sortFunc).unshift(undefined)
}

/**
 * Returns the elements from the given list. This function is equivalent to
 *
 *      `return list[i], list[i+1], ···, list[j]`
 *
 * By default, i is 1 and j is #list.
 */
function unpack(table: LuaType, i?: LuaType, j?: LuaType): LuaType[] {
    const TABLE = coerceArgToTable(table, 'unpack', 1)
    const I = i === undefined ? 1 : coerceArgToNumber(i, 'unpack', 2)
    const J = j === undefined ? getn(TABLE) : coerceArgToNumber(j, 'unpack', 3)

    return TABLE.numValues.slice(I, J + 1)
}

const libTable = new Table({
    getn,
    concat,
    insert,
    maxn,
    move,
    pack,
    remove,
    sort,
    unpack
})

export { libTable }
