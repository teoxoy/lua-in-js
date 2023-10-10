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

process.exit(exitCode)
