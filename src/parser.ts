import luaparse from 'luaparse'

type Block =
    | luaparse.IfClause
    | luaparse.ElseifClause
    | luaparse.ElseClause
    | luaparse.WhileStatement
    | luaparse.DoStatement
    | luaparse.RepeatStatement
    | luaparse.FunctionDeclaration
    | luaparse.ForNumericStatement
    | luaparse.ForGenericStatement
    | luaparse.Chunk

const isBlock = (node: luaparse.Node): node is Block =>
    node.type === 'IfClause' ||
    node.type === 'ElseifClause' ||
    node.type === 'ElseClause' ||
    node.type === 'WhileStatement' ||
    node.type === 'DoStatement' ||
    node.type === 'RepeatStatement' ||
    node.type === 'FunctionDeclaration' ||
    node.type === 'ForNumericStatement' ||
    node.type === 'ForGenericStatement' ||
    node.type === 'Chunk'

class MemExpr extends String {
    public base: string | MemExpr
    public property: string | MemExpr

    public constructor(base: string | MemExpr, property: string | MemExpr) {
        super()
        this.base = base
        this.property = property
    }

    public get(): string {
        return `__lua.get(${this.base}, ${this.property})`
    }

    public set(value: string | MemExpr): string {
        return `${this.base}.set(${this.property}, ${value})`
    }

    public setFn(): string {
        return `${this.base}.setFn(${this.property})`
    }

    public toString(): string {
        return this.get()
    }

    public valueOf(): string {
        return this.get()
    }
}

const UNI_OP_MAP = {
    not: 'not',
    '-': 'unm',
    '~': 'bnot',
    '#': 'len'
}

const BIN_OP_MAP = {
    '+': 'add',
    '-': 'sub',
    '*': 'mul',
    '%': 'mod',
    '^': 'pow',
    '/': 'div',
    '//': 'idiv',
    '&': 'band',
    '|': 'bor',
    '~': 'bxor',
    '<<': 'shl',
    '>>': 'shr',
    '..': 'concat',
    '~=': 'neq',
    '==': 'eq',
    '<': 'lt',
    '<=': 'le',
    '>': 'gt',
    '>=': 'ge'
}

const generate = (node: luaparse.Node): string | MemExpr => {
    switch (node.type) {
        case 'LabelStatement': {
            return `case '${node.label.name}': label = undefined`
        }

        case 'BreakStatement': {
            return 'break'
        }

        case 'GotoStatement': {
            return `label = '${node.label.name}'; continue`
        }

        case 'ReturnStatement': {
            const args = parseExpressions(node.arguments)
            return `return ${args}`
        }

        case 'IfStatement': {
            const clauses = node.clauses.map(clause => generate(clause))
            return clauses.join(' else ')
        }

        case 'IfClause':
        case 'ElseifClause': {
            const condition = expression(node.condition)
            const body = parseBody(node)
            return `if (__lua.bool(${condition})) {\n${body}\n}`
        }

        case 'ElseClause': {
            const body = parseBody(node)
            return `{\n${body}\n}`
        }

        case 'WhileStatement': {
            const condition = expression(node.condition)
            const body = parseBody(node)
            return `while(${condition}) {\n${body}\n}`
        }

        case 'DoStatement': {
            const body = parseBody(node)
            return `\n${body}\n`
        }

        case 'RepeatStatement': {
            const condition = expression(node.condition)
            const body = parseBody(node)
            return `do {\n${body}\n} while (!(${condition}))`
        }

        case 'LocalStatement': {
            return parseAssignments(node)
        }

        case 'AssignmentStatement': {
            return parseAssignments(node)
        }

        case 'CallStatement': {
            return generate(node.expression)
        }

        case 'FunctionDeclaration': {
            const getFuncDef = (params: string[]): string => {
                const paramStr = params.join(';\n')
                const body = parseBody(node, paramStr)
                const argsStr = params.length === 0 ? '' : '...args'
                const returnStr =
                    node.body.findIndex(node => node.type === 'ReturnStatement') === -1 ? '\nreturn []' : ''
                return `function* (${argsStr}) {\n${body}${returnStr}\n}`
            }

            const params = node.parameters.map(param => {
                if (param.type === 'VarargLiteral') {
                    return `$${nodeToScope.get(param)}.setVarargs(args)`
                }
                return `$${nodeToScope.get(param)}.setLocal('${param.name}', args.shift())`
            })

            // anonymous function
            if (node.identifier === null) return getFuncDef(params)

            if (node.identifier.type === 'Identifier') {
                const scope = nodeToScope.get(node.identifier)
                const setStr = node.isLocal ? 'setLocal' : 'set'
                return `$${scope}.${setStr}('${node.identifier.name}', ${getFuncDef(params)})`
            }

            const identifier = generate(node.identifier) as MemExpr
            if (node.identifier.indexer === ':') {
                params.unshift(`$${nodeToScope.get(node)}.setLocal('self', args.shift())`)
            }
            return identifier.set(getFuncDef(params))
        }

        case 'ForNumericStatement': {
            const varName = node.variable.name
            const start = expression(node.start)
            const end = expression(node.end)
            const step = node.step === null ? 1 : expression(node.step)
            const init = `let ${varName} = ${start}, end = ${end}, step = ${step}`
            const cond = `step > 0 ? ${varName} <= end : ${varName} >= end`
            const after = `${varName} += step`
            const varInit = `$${nodeToScope.get(node.variable)}.setLocal('${varName}', ${varName});`
            const body = parseBody(node, varInit)

            return `for (${init}; ${cond}; ${after}) {\n${body}\n}`
        }

        case 'ForGenericStatement': {
            const iterators = parseExpressions(node.iterators)

            const variables = node.variables
                .map((variable, index) => {
                    return `$${nodeToScope.get(variable)}.setLocal('${variable.name}', res[${index}])`
                })
                .join(';\n')

            const body = parseBody(node, variables)

            return `for (let [iterator, table, next] = ${iterators}, res = __lua.call(iterator, table, next); res[0] !== undefined; res = __lua.call(iterator, table, res[0])) {\n${body}\n}`
        }

        case 'Chunk': {
            const body = parseBody(node)
            return `function* (__lua) {\n'use strict'\nconst $0 = __lua.globalScope\nlet vars\nlet vals\nlet label\n\n${body}\n}`
        }

        case 'Identifier': {
            return `$${nodeToScope.get(node)}.get('${node.name}')`
        }

        case 'StringLiteral': {
            const S = node.value
                .replace(/([^\\])?\\(\d{1,3})/g, (_, pre, dec) => `${pre || ''}${String.fromCharCode(dec)}`)
                .replace(/\\/g, '\\\\')
                .replace(/`/g, '\\`')

            return `\`${S}\``
        }

        case 'NumericLiteral': {
            return node.value.toString()
        }

        case 'BooleanLiteral': {
            return node.value ? 'true' : 'false'
        }

        case 'NilLiteral': {
            return 'undefined'
        }

        case 'VarargLiteral': {
            return `$${nodeToScope.get(node)}.getVarargs()`
        }

        // inside TableConstructorExpression
        // case 'TableKey': {}
        // case 'TableKeyString': {}
        // case 'TableValue': {}

        case 'TableConstructorExpression': {
            if (node.fields.length === 0) return 'new __lua.Table()'

            const fields = node.fields
                .map((field, index, arr) => {
                    if (field.type === 'TableKey') {
                        return `t.rawset(${generate(field.key)}, ${expression(field.value)})`
                    }

                    if (field.type === 'TableKeyString') {
                        return `t.rawset('${field.key.name}', ${expression(field.value)})`
                    }

                    if (field.type === 'TableValue') {
                        if (index === arr.length - 1 && ExpressionReturnsArray(field.value)) {
                            return `t.insert(...${generate(field.value)})`
                        }
                        return `t.insert(${expression(field.value)})`
                    }
                })
                .join(';\n')

            return `new __lua.Table(t => {\n${fields}\n})`
        }

        case 'UnaryExpression': {
            const operator = UNI_OP_MAP[node.operator]
            const argument = expression(node.argument)

            if (!operator) {
                throw new Error(`Unhandled unary operator: ${node.operator}`)
            }

            return `__lua.${operator}(${argument})`
        }

        case 'BinaryExpression': {
            const left = expression(node.left)
            const right = expression(node.right)
            const operator = BIN_OP_MAP[node.operator]

            if (!operator) {
                throw new Error(`Unhandled binary operator: ${node.operator}`)
            }

            return `__lua.${operator}(${left}, ${right})`
        }

        case 'LogicalExpression': {
            const left = expression(node.left)
            const right = expression(node.right)
            const operator = node.operator

            if (operator === 'and') {
                return `__lua.and(() => ${left}, () => ${right})`
            }
            if (operator === 'or') {
                return `__lua.or(() => ${left}, () => ${right})`
            }
            throw new Error(`Unhandled logical operator: ${node.operator}`)
        }
        case 'MemberExpression': {
            const base = expression(node.base)
            return new MemExpr(base, `'${node.identifier.name}'`)
        }

        case 'IndexExpression': {
            const base = expression(node.base)
            const index = expression(node.index)
            return new MemExpr(base, index)
        }

        case 'CallExpression':
        case 'TableCallExpression':
        case 'StringCallExpression': {
            if (
                node.type === 'CallExpression' &&
                node.base.type === 'MemberExpression' &&
                node.base.base.type === 'Identifier' &&
                node.base.base.name === 'coroutine' &&
                node.base.identifier.type === 'Identifier' &&
                node.base.identifier.name === 'yield' &&
                node.base.indexer === '.'
            ) {
                const args = parseExpressions(node.arguments)
                return `yield ${args}`
            }

            const functionName = expression(node.base)
            const args =
                node.type === 'CallExpression'
                    ? parseExpressionList(node.arguments).join(', ')
                    : expression(node.type === 'TableCallExpression' ? node.arguments : node.argument)

            if (functionName instanceof MemExpr && node.base.type === 'MemberExpression' && node.base.indexer === ':') {
                return `__lua.call(${functionName}, ${functionName.base}, ${args})`
            }

            return `__lua.call(${functionName}, ${args})`
        }

        default:
            throw new Error(`No generator found for: ${node.type}`)
    }
}

const parseBody = (node: Block, header = ''): string => {
    const scope = nodeToScope.get(node)
    const scopeDef = scope === undefined ? '' : `const $${scope} = $${scopeToParentScope.get(scope)}.extend();`

    const body = node.body.map(statement => generate(statement)).join(';\n')

    const goto = nodeToGoto.get(node)
    if (goto === undefined) return `${scopeDef}\n${header}\n${body}`

    const gotoHeader = `L${goto}: do { switch(label) { case undefined:`
    const gotoParent = gotoToParentGoto.get(goto)
    const def = gotoParent === undefined ? '' : `break; default: continue L${gotoParent}\n`
    const footer = `${def}} } while (label)`

    return `${scopeDef}\n${gotoHeader}\n${header}\n${body}\n${footer}`
}

const expression = (node: luaparse.Expression): string | MemExpr => {
    const v = generate(node)
    if (ExpressionReturnsArray(node)) return `${v}[0]`
    return v
}

const parseExpressions = (expressions: luaparse.Expression[]): string | MemExpr => {
    // return the `array` directly instead of `[...array]`
    if (expressions.length === 1 && ExpressionReturnsArray(expressions[0])) {
        return generate(expressions[0])
    }

    return `[${parseExpressionList(expressions).join(', ')}]`
}

const parseExpressionList = (expressions: luaparse.Expression[]): (string | MemExpr)[] => {
    return expressions.map((node, index, arr) => {
        const value = generate(node)
        if (ExpressionReturnsArray(node)) {
            return index === arr.length - 1 ? `...${value}` : `${value}[0]`
        }
        return value
    })
}

const parseAssignments = (node: luaparse.LocalStatement | luaparse.AssignmentStatement): string => {
    const lines: (string | MemExpr)[] = []
    const valFns: string[] = []

    const useTempVar = node.variables.length > 1 && node.init.length > 0 && !node.init.every(isLiteral)

    for (let i = 0; i < node.variables.length; i++) {
        const K = node.variables[i]
        const V = node.init[i]

        const initStr =
            // eslint-disable-next-line no-nested-ternary
            useTempVar ? `vars[${i}]` : V === undefined ? 'undefined' : expression(V)

        if (K.type === 'Identifier') {
            const setStr = node.type === 'LocalStatement' ? 'setLocal' : 'set'
            lines.push(`$${nodeToScope.get(K)}.${setStr}('${K.name}', ${initStr})`)
        } else {
            const name = generate(K) as MemExpr

            if (useTempVar) {
                lines.push(`vals[${valFns.length}](${initStr})`)
                valFns.push(name.setFn())
            } else {
                lines.push(name.set(initStr))
            }
        }
    }

    // push remaining CallExpressions
    for (let i = node.variables.length; i < node.init.length; i++) {
        const init = node.init[i]
        if (isCallExpression(init)) {
            lines.push(generate(init))
        }
    }

    if (useTempVar) {
        lines.unshift(`vars = ${parseExpressions(node.init)}`)
        if (valFns.length > 0) {
            lines.unshift(`vals = [${valFns.join(', ')}]`)
        }
    }

    return lines.join(';\n')
}

const isCallExpression = (
    node: luaparse.Expression
): node is luaparse.CallExpression | luaparse.StringCallExpression | luaparse.TableCallExpression => {
    return node.type === 'CallExpression' || node.type === 'StringCallExpression' || node.type === 'TableCallExpression'
}

const ExpressionReturnsArray = (node: luaparse.Expression): boolean => {
    return isCallExpression(node) || node.type === 'VarargLiteral'
}

const isLiteral = (node: luaparse.Expression): boolean => {
    return (
        node.type === 'StringLiteral' ||
        node.type === 'NumericLiteral' ||
        node.type === 'BooleanLiteral' ||
        node.type === 'NilLiteral' ||
        node.type === 'TableConstructorExpression'
    )
}

const checkGoto = (ast: luaparse.Chunk): void => {
    const gotoInfo: {
        type: 'local' | 'label' | 'goto'
        name: string
        scope: number
        last?: boolean
    }[] = []

    let gotoScope = 0
    const gotoScopeMap = new Map<number, number>()
    const getNextGotoScope = (() => {
        let id = 0
        return () => {
            id += 1
            return id
        }
    })()

    const check = (node: luaparse.Node): void => {
        if (isBlock(node)) {
            createGotoScope()

            for (let i = 0; i < node.body.length; i++) {
                const n = node.body[i]
                switch (n.type) {
                    case 'LocalStatement': {
                        gotoInfo.push({
                            type: 'local',
                            name: n.variables[0].name,
                            scope: gotoScope
                        })
                        break
                    }
                    case 'LabelStatement': {
                        if (
                            gotoInfo.find(
                                node => node.type === 'label' && node.name === n.label.name && node.scope === gotoScope
                            )
                        ) {
                            throw new Error(`label '${n.label.name}' already defined`)
                        }

                        gotoInfo.push({
                            type: 'label',
                            name: n.label.name,
                            scope: gotoScope,
                            last:
                                node.type !== 'RepeatStatement' &&
                                node.body.slice(i).every(n => n.type === 'LabelStatement')
                        })
                        break
                    }
                    case 'GotoStatement': {
                        gotoInfo.push({
                            type: 'goto',
                            name: n.label.name,
                            scope: gotoScope
                        })
                        break
                    }
                    case 'IfStatement': {
                        n.clauses.forEach(n => check(n))
                        break
                    }
                    default: {
                        check(n)
                    }
                }
            }

            destroyGotoScope()
        }
    }
    check(ast)

    function createGotoScope(): void {
        const parent = gotoScope
        gotoScope = getNextGotoScope()
        gotoScopeMap.set(gotoScope, parent)
    }
    function destroyGotoScope(): void {
        gotoScope = gotoScopeMap.get(gotoScope)
    }

    for (let i = 0; i < gotoInfo.length; i++) {
        const goto = gotoInfo[i]

        if (goto.type === 'goto') {
            const label = gotoInfo
                .filter(node => node.type === 'label' && node.name === goto.name && node.scope <= goto.scope)
                .sort((a, b) => Math.abs(goto.scope - a.scope) - Math.abs(goto.scope - b.scope))[0]

            if (!label) {
                throw new Error(`no visible label '${goto.name}' for <goto>`)
            }

            const labelI = gotoInfo.findIndex(n => n === label)

            if (labelI > i) {
                const locals = gotoInfo
                    .slice(i, labelI)
                    .filter(node => node.type === 'local' && node.scope === label.scope)

                if (!label.last && locals.length > 0) {
                    throw new Error(`<goto ${goto.name}> jumps into the scope of local '${locals[0].name}'`)
                }
            }
        }
    }
}

const visitNode = (
    node: luaparse.Node,
    visitProp: (node: luaparse.Node, prevScope: number, prevGoto: number) => void,
    nextScope: number,
    isNewScope: boolean,
    nextGoto: number
): void => {
    const VP = (node: luaparse.Node | luaparse.Node[], partOfBlock = true): void => {
        if (!node) return

        const S = partOfBlock === false && isNewScope ? scopeToParentScope.get(nextScope) : nextScope
        if (Array.isArray(node)) {
            node.forEach(n => visitProp(n, S, nextGoto))
        } else {
            visitProp(node, S, nextGoto)
        }
    }

    switch (node.type) {
        case 'LocalStatement':
        case 'AssignmentStatement':
            VP(node.variables)
            VP(node.init)
            break
        case 'UnaryExpression':
            VP(node.argument)
            break
        case 'BinaryExpression':
        case 'LogicalExpression':
            VP(node.left)
            VP(node.right)
            break
        case 'FunctionDeclaration':
            VP(node.identifier, false)
            VP(node.parameters)
            VP(node.body)
            break
        case 'ForGenericStatement':
            VP(node.variables)
            VP(node.iterators, false)
            VP(node.body)
            break
        case 'IfClause':
        case 'ElseifClause':
        case 'WhileStatement':
        case 'RepeatStatement':
            VP(node.condition, false)
        /* fall through */
        case 'Chunk':
        case 'ElseClause':
        case 'DoStatement':
            VP(node.body)
            // VK(node.globals)
            // VK(node.comments)
            break
        case 'ForNumericStatement':
            VP(node.variable)
            VP(node.start, false)
            VP(node.end, false)
            VP(node.step, false)
            VP(node.body)
            break
        case 'ReturnStatement':
            VP(node.arguments)
            break
        case 'IfStatement':
            VP(node.clauses)
            break
        case 'MemberExpression':
            VP(node.base)
            VP(node.identifier)
            break
        case 'IndexExpression':
            VP(node.base)
            VP(node.index)
            break
        case 'LabelStatement':
            VP(node.label)
            break
        case 'CallStatement':
            VP(node.expression)
            break
        case 'GotoStatement':
            VP(node.label)
            break
        case 'TableConstructorExpression':
            VP(node.fields)
            break
        case 'TableKey':
        case 'TableKeyString':
            VP(node.key)
        /* fall through */
        case 'TableValue':
            VP(node.value)
            break
        case 'CallExpression':
            VP(node.base)
            VP(node.arguments)
            break
        case 'TableCallExpression':
            VP(node.base)
            VP(node.arguments)
            break
        case 'StringCallExpression':
            VP(node.base)
            VP(node.argument)
        //     break
        // case 'Identifier':
        // case 'NumericLiteral':
        // case 'BooleanLiteral':
        // case 'StringLiteral':
        // case 'NilLiteral':
        // case 'VarargLiteral':
        // case 'BreakStatement':
        // case 'Comment':
        //     break
        // default:
        //     throw new Error(`Unhandled ${node.type}`)
    }
}

const scopeToParentScope = new Map<number, number>()
const nodeToScope = new Map<luaparse.Node, number>()

const gotoToParentGoto = new Map<number, number>()
const nodeToGoto = new Map<luaparse.Node, number>()

const setExtraInfo = (ast: luaparse.Chunk): void => {
    let scopeID = 0
    let gotoID = 0

    const visitProp = (node: luaparse.Node, prevScope: number, prevGoto: number): void => {
        let nextScope = prevScope
        let nextGoto = prevGoto

        if (isBlock(node)) {
            // set scope info
            if (
                node.body.findIndex(
                    n => n.type === 'LocalStatement' || (n.type === 'FunctionDeclaration' && n.isLocal)
                ) !== -1 ||
                (node.type === 'FunctionDeclaration' &&
                    (node.parameters.length > 0 || (node.identifier && node.identifier.type === 'MemberExpression'))) ||
                node.type === 'ForNumericStatement' ||
                node.type === 'ForGenericStatement'
            ) {
                scopeID += 1
                nextScope = scopeID

                nodeToScope.set(node, scopeID)
                scopeToParentScope.set(scopeID, prevScope)
            }

            // set goto info
            if (node.body.findIndex(s => s.type === 'LabelStatement' || s.type === 'GotoStatement') !== -1) {
                nextGoto = gotoID

                nodeToGoto.set(node, gotoID)
                if (node.type !== 'Chunk' && node.type !== 'FunctionDeclaration') {
                    gotoToParentGoto.set(gotoID, prevGoto)
                }

                gotoID += 1
            }
        }

        // set scope info
        else if (node.type === 'Identifier' || node.type === 'VarargLiteral') {
            nodeToScope.set(node, prevScope)
        }

        visitNode(node, visitProp, nextScope, prevScope !== nextScope, nextGoto)
    }

    visitProp(ast, scopeID, gotoID)
}

const parse = (data: string): string => {
    const ast = luaparse.parse(data.replace(/^#.*/, ''), {
        scope: false,
        comments: false,
        luaVersion: '5.3',
        encodingMode: 'x-user-defined'
    })
    checkGoto(ast)
    setExtraInfo(ast)
    return generate(ast).toString()
}

export { parse }
