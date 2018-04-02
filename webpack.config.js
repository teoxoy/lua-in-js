'use strict'
const path = require('path')
const CleanWebpackPlugin = require('clean-webpack-plugin')

module.exports = {
    mode: 'production',
    target: 'node',
    entry: './src/index',
    output: {
        path: path.resolve(__dirname, './dist'),
        filename: 'lua2js.js',
        library: 'lua2js',
        libraryTarget:'umd'
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            cacheDirectory: true,
                            presets: [
                                ["@babel/preset-env", {
                                    targets: {
                                        node: "current"
                                    }
                                }]
                            ]
                        }
                    }
                ]
            }
        ]
    },
    plugins: [
        new CleanWebpackPlugin(['dist'])
    ]
}
