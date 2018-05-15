# lua2js

A Lua to JS transpiler

Usage example (I am using it just to convert a lua file to js; run the temporary js file and get some data from it):
```
const fs = require('fs')
const lua2js = require('lua2js')
const execSync = require('child_process').execSync

const data = lua2js.parser.parse(mainFileData)
fs.writeFileSync('./temp.js', `
  require("lua2js").runtime;
  ${data}
  require("fs").writeFileSync('./temp.json', JSON.stringify(Tget($get($, 'data'), 'raw').toObject(), null, 2));
`)
execSync('node temp.js')
```

This library is based on the sourcecode of this library: https://github.com/paulcuth/starlight, which is under this license:

```
The MIT License (MIT)

Copyright 2015—2016 Paul Cuthbertson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
