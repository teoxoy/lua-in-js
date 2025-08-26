import { Table } from '../Table'
import { LuaType, coerceArgToFunction, coerceArgToThread } from '../utils'
import { LuaError } from '../LuaError'
import { Thread } from '../Thread'

function create(fn: LuaType): Thread {
    const F = coerceArgToFunction(fn, 'create', 1)
    return new Thread(F as (...args: LuaType[]) => Generator<LuaType[]>)
}

function resume(thread: LuaType, ...args: LuaType[]): LuaType[] {
    const THREAD = coerceArgToThread(thread, 'resume', 1)
    try {
        return [true, ...THREAD.resume(...args)]
    } catch (e) {
        if (e instanceof LuaError) return [false, e.message]
        throw e
    }
}

function status(thread: LuaType): string {
    const THREAD = coerceArgToThread(thread, 'status', 1)
    return THREAD.status
}

function wrap(fn: LuaType): Function {
    const thread = create(fn)
    return (...args: LuaType[]): LuaType[] => thread.resume(...args)
}

function running(): LuaType[] {
    return [Thread.current, Thread.current === Thread.main]
}

const libCoroutine = new Table({
    create,
    resume,
    wrap,
    running,
    status
})

export { libCoroutine }
