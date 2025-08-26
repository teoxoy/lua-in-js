import { LuaError } from './LuaError'
import { LuaType } from './utils'

type Gen = Generator<LuaType[], LuaType[], LuaType[]>

type GenFn = (...args: LuaType[]) => Gen

class Thread {
    private readonly fn: GenFn
    private gen?: Gen
    public status: ThreadStatus = 'suspended'
    public last: LuaType[] = []

    public static current: Thread
    public static main: Thread

    public constructor(fn: GenFn) {
        this.fn = fn
    }

    public resume(...args: LuaType[]): LuaType[] {
        if (this.status === 'dead') {
            throw new LuaError('cannot resume dead coroutine')
        }
        const prev = Thread.current
        Thread.current = this
        this.status = 'running'
        try {
            if (!this.gen) {
                this.gen = this.fn(...args)
                const r = this.gen.next()
                this.status = r.done ? 'dead' : 'suspended'
                this.last = r.value || []
                return this.last
            }
            const r = this.gen.next(args)
            this.status = r.done ? 'dead' : 'suspended'
            this.last = r.value || []
            return this.last
        } finally {
            Thread.current = prev
        }
    }
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
const mainThread = new Thread((function*() {} as unknown) as GenFn)
mainThread.status = 'running'
Thread.main = mainThread
Thread.current = mainThread

export { Thread }
export type ThreadStatus = 'running' | 'suspended' | 'dead'
