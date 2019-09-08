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
    luaEnv.runfile('test-runner.lua')
}

// TODO: make more official lua 5.3 tests pass (most of them don't pass because they `require "debug"`)
{
    const rootPath = './tests/lua-5.3/'
    const luaEnv = luainjs.createEnv({
        fileExists: p => fs.existsSync(path.join(rootPath, p)),
        loadFile: p => fs.readFileSync(path.join(rootPath, p), { encoding: 'utf8' }),
        osExit: code => process.exit(code)
    })
    luaEnv.runfile('goto.lua')
    luaEnv.runfile('bwcoercion.lua')
}

process.exit(exitCode)
