import { hasOwnProperty, LuaType } from './utils'

export class Scope {
    private parent: Scope
    private _varargs: LuaType[]
    private readonly _variables: Record<string, LuaType>

    public constructor(variables = {}) {
        this._variables = variables
    }

    public get(key: string): LuaType {
        return this._variables[key]
    }

    public set(key: string, value: LuaType): void {
        if (hasOwnProperty(this._variables, key) || !this.parent) {
            this.setLocal(key, value)
        } else {
            this.parent.set(key, value)
        }
    }

    public setLocal(key: string, value: LuaType): void {
        this._variables[key] = value
    }

    public setVarargs(args: LuaType[]): void {
        this._varargs = args
    }

    public getVarargs(): LuaType[] {
        return this._varargs || (this.parent && this.parent.getVarargs()) || []
    }

    public extend(): Scope {
        const innerVars = Object.create(this._variables)
        const scope = new Scope(innerVars)
        scope.parent = this
        return scope
    }
}
