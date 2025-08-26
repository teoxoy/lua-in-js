const fs = require('fs')
const path = require('path')
const luainjs = require('..')

let exitCode = 0

{
    const rootPath = './tests/starlight/'
    const luaEnv = luainjs.createEnv({
        fileExists: p => fs.existsSync(path.join(rootPath, p)),
        loadFile: p => fs.readFileSync(path.join(rootPath, p), { encoding: 'utf8' }),
        osExit: code => (exitCode += code)
    })
    luaEnv.parseFile('test-runner.lua').exec()
}

// TODO: make more official lua 5.3 tests pass (most of them don't pass because they `require "debug"`)
{
    const rootPath = './tests/lua-5.3/'
    const luaEnv = luainjs.createEnv({
        fileExists: p => fs.existsSync(path.join(rootPath, p)),
        loadFile: p => fs.readFileSync(path.join(rootPath, p), { encoding: 'utf8' }),
        osExit: code => process.exit(code)
    })
    luaEnv.parseFile('goto.lua').exec()
    luaEnv.parseFile('bwcoercion.lua').exec()
    luaEnv.parseFile('logical_operations.lua').exec()
}

{
    const luaEnv = luainjs.createEnv()
    function helloBuilder(name) {
        const NAME = luainjs.utils.coerceArgToString(name, 'sayHi', 1)
        return `Hello ${NAME}!`
    }
    const myLib = new luainjs.Table({ helloBuilder })
    luaEnv.loadLib('myLib', myLib)
    const str = luaEnv.parse(`return myLib.helloBuilder('John')`).exec()
    if (str !== 'Hello John!') {
        throw Error("Strings don't match!")
    }
}

{
    const luaEnv = luainjs.createEnv()
    const ext = new luainjs.Table({ foo: () => 'bar' })
    luaEnv.extendLib('math', ext)
    const val = luaEnv.parse('return math.foo()').exec()
    if (val !== 'bar') {
        throw Error('extendLib failed!')
    }
}

{
    const luaEnv = luainjs.createEnv()
    let str
    try {
        str = luaEnv.parse('return "Backtick `literals` in strings work"').exec()
    } catch (e) {
        throw Error('Backticks in strings transpile into invalid code!')
    }
    if (str !== 'Backtick `literals` in strings work') {
        throw Error('Backticks in strings transpile incorrectly!')
    }
}

{
    const luaEnv = luainjs.createEnv()
    const script = luaEnv.parse(`
        local co = coroutine.create(function(a)
            local x, y = coroutine.yield(a + 1, a + 2)
            return x + y
        end)
        local r1 = {coroutine.resume(co, 3)}
        if r1[1] ~= true or r1[2] ~= 4 or r1[3] ~= 5 then return 'fail1' end
        local r2 = {coroutine.resume(co, 5, 6)}
        if r2[1] ~= true or r2[2] ~= 11 then return 'fail2' end
        return 'ok'
    `)
    if (script.exec() !== 'ok') throw Error('coroutine resume failed')
}

{
    const luaEnv = luainjs.createEnv()
    const script = luaEnv.parse(`
        local f = coroutine.wrap(function(a)
            local b = coroutine.yield(a + 1)
            return a + b
        end)
        local r1 = {f(3)}
        if r1[1] ~= 4 then return 'fail1' end
        local r2 = {f(5)}
        if r2[1] ~= 8 then return 'fail2' end
        return 'ok'
    `)
    if (script.exec() !== 'ok') throw Error('coroutine wrap failed')
}

{
    const luaEnv = luainjs.createEnv()
    const script = luaEnv.parse(`
        local main, isMain = coroutine.running()
        if not isMain then return 'fail1' end
        local co
        co = coroutine.create(function()
            if coroutine.status(co) ~= 'running' then return 'fail2' end
            local t, m = coroutine.running()
            if t ~= co or m then return 'fail3' end
        end)
        if coroutine.status(co) ~= 'suspended' then return 'fail4' end
        local ok = coroutine.resume(co)
        if not ok then return 'fail5' end
        if coroutine.status(co) ~= 'dead' then return 'fail6' end
        return 'ok'
    `)
    if (script.exec() !== 'ok') throw Error('coroutine running/status failed')
}

process.exit(exitCode)
