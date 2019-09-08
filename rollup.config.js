import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import typescript from 'rollup-plugin-typescript2'
const pkg = require('./package.json')

export default {
    input: 'src/index.ts',
    output: [
        {
            file: pkg.main,
            name: pkg.name,
            format: 'cjs',
            sourcemap: true
        },
        {
            file: pkg.module,
            name: pkg.name,
            format: 'es',
            sourcemap: true
        }
    ],
    external: Object.keys(pkg.dependencies).concat(require('module').builtinModules),
    watch: {
        include: 'src/**'
    },
    plugins: [
        commonjs(),
        resolve(),
        typescript({
            useTsconfigDeclarationDir: true
        })
    ]
}
