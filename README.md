# lua-in-js

[![npm](https://img.shields.io/npm/v/lua-in-js.svg?style=flat-square)](https://www.npmjs.com/package/lua-in-js)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-blue.svg?style=flat-square)](./CONTRIBUTING.md)
[![GitHub](https://img.shields.io/github/license/teoxoy/lua-in-js.svg?style=flat-square&color=blue)](./LICENSE)
&nbsp;&nbsp;_Badges are clickable!_

A Lua to JS transpiler/runtime. This library is a rewrite of [Starlight](https://github.com/paulcuth/starlight) with a lot of improvements.

## Install

```
npm i lua-in-js
```

## API

### Import

```js
import * as luainjs from 'lua-in-js'
```

```js
const luainjs = require('lua-in-js')
```

### Create the lua environment

Lua environments are isolated from each other (they got different global scopes)

```js
const luaEnv = luainjs.createEnv()
```

A config object can be passed in for extra functionality

```js
const luaEnv = luainjs.createEnv({
    LUA_PATH,   // default value of package.path
    fileExists, // function that takes in a path and returns a boolean
    loadFile,   // function that takes in a path and returns the content of a file
    stdin,      // string representing the standard input
    stdout,     // function representing the standard output
    osExit      // function called by os.exit
})
```

### Execute a script or file

```js
const luaScript = luaEnv.parse('print(\'Hello world!\')')
const returnValue = luaScript.exec()
```

```js
const luaScript = luaEnv.parseFile('somefile.lua')
const returnValue = luaScript.exec()
```

`parseFile` uses `config.fileExists` and `config.loadFile`

### Create a global library

Creating a global library allows you write APIs that you can use in the Lua environment.

```js
function helloBuilder(name) {
    const NAME = luainjs.utils.coerceArgToString(name, 'sayHi', 1)
    return `Hello ${NAME}!`
}

const myLib = new luainjs.Table({ helloBuilder })
luaEnv.loadLib('myLib', myLib)

const helloStr = luaEnv.parse(`return myLib.helloBuilder('John')`).exec()
console.log(helloStr)
```

Check out the [math lib](./src/lib/math.ts) for a more extensive example.

### Extend a library

Use `extendLib` to add new functions to an existing library without overwriting it.

```js
const extraMath = new luainjs.Table({ tau: Math.PI * 2 })
luaEnv.extendLib('math', extraMath)

const tau = luaEnv.parse('return math.tau').exec()
console.log(tau)
```

## Example

Check out the [test runner](./tests/test.js) for a concrete example.

## Missing functionality

 - debug library
 - utf8 library
 - io library
 - package.cpath
 - package.loadlib
 - string.dump
 - string.pack
 - string.packsize
 - string.unpack
 - os.clock
 - os.execute
 - os.getenv
 - os.remove
 - os.rename
 - os.tmpname
