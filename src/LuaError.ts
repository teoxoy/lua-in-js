export class LuaError extends Error {
    public constructor(message: string) {
        super()
        this.message = message
    }

    public toString(): string {
        return `LuaError: ${this.message}`
    }
}
