import * as esprima from 'esprima';
import * as escodegen from 'escodegen';

let globals = {};
let args = {};
let locals = new Map();
let envLocals = [];
let toPaint = false;

const buildBinaryExp = (op, l, r) => {
    return {
        'type': 'BinaryExpression',
        'operator': op,
        'left': l,
        'right': r
    };
};

let values = {
    'ArrayExpression': (init) => {
        return {'type': 'ArrayExpression', 'elements': init.elements.map(retVal)};
    },
    'BinaryExpression': (init) => buildBinaryExp(init.operator, retVal(init.left), retVal(init.right)),
    'MemberExpression': (init) => findValue(init.object).elements[init.property.value]
};

function copy(o) {
    let output, v, key;
    output = Array.isArray(o) ? [] : {};
    for (key in o) {
        v = o[key];
        output[key] = (typeof v === 'object') ? copy(v) : v;
    }
    return output;
}

const retVal = (init) => {
    if (init.type === 'Identifier' && (isLocal(init.name) || toPaint))
        return findValue(init);
    let ret = values[init.type];
    return ret === undefined ? init : ret(init);
};

const findValue = (init) => {
    let currLocals = envLocals.filter(x => x[init.name] !== undefined);
    return currLocals.length !== 0 ? currLocals[currLocals.length - 1] :
        locals[init.name] !== undefined ? locals[init.name] :
            args[init.name] !== undefined ? args[init.name] :
                globals[init.name];
};

const setValue = (name, value) => {
    let currLocals = envLocals.filter(x => x[name] !== undefined);
    return currLocals.length !== 0 ? currLocals[currLocals.length - 1][name] = value :
        locals[name] !== undefined ? locals[name] = value :
            args[name] !== undefined ? args[name] = value :
                globals[name] = value;
};

function flat(arr1) {
    return arr1.reduce((acc, val) => Array.isArray(val) ? acc.concat(flat(val)) : acc.concat(val), []);
}

const isLocal = (name) => {
    return locals[name] !== undefined;
};

const blockStatementHandler = (x) => {
    return {'type': 'BlockStatement', 'body': newEnvHandler(x.body)};
};

const variableDeclarationHandler = (x) => {
    x.declarations.map(variableDeclaratorHandler);
    return null;
};

const variableDeclaratorHandler = (x) => {
    locals[x.id.name] = retVal(x.init);
};

const sequenceExpressionHandler = (x) => {
    let ret = x.expressions.map(findHandler).filter(y => y !== null);
    return ret.length === 0 ? null : {'type': 'SequenceExpression', 'expressions': ret};
};

const assignmentExpressionHandler = (x) => {
    let val = retVal(x.right);
    if (x.left.type === 'MemberExpression') {
        findValue(x.left.object).elements[x.left.property.value] = val;
        // TODO global shit with member
    } else setValue(x.left.name, val);
    if (isLocal(x.left.name))
        return null;
    x.right = val;
    return x;
};

const expressionStatementHandler = (x) => {
    let exp = findHandler(x.expression);
    return exp === null ? null : {'type': 'ExpressionStatement', 'expression': exp};
};

const updateExpressionHandler = (x) => {
    let op = x.operator === '++' ? '+' : '-';
    setValue(x.argument.name, buildBinaryExp(op, findValue(x.argument),
        {'type': 'Literal', 'value': 1, 'raw': '1'}));
    return isLocal(x.argument.name) ? null : x;
};

const blockerHelper = (x) => {
    return x.type !== 'BlockStatement' ?
        blockStatementHandler({'type': 'BlockStatement', 'body': newEnvHandler([x])}) :
        blockStatementHandler(x);
};

const testHelper = (x) => {
    return x.type === 'Literal' ? x :
        x.type === 'Identifier' ? retVal(x) :
            buildBinaryExp(x.operator, testHelper(x.left), testHelper(x.right));
};

const ifHandler = (x) => {
    x.consequent = blockerHelper(x.consequent);
    x.test = testHelper(x.test);
    x.alternate = x.alternate === null ? null : blockerHelper(x.alternate);
    return x;
};

const loopHandler = (x) => {
    x.body = blockerHelper(x.body);
    return x;
};

const newEnvHandler = (x) => {
    let locs = copy(locals), globs = copy(globals), ar = copy(args);
    envLocals.push({});
    let ret = x.map(findHandler).filter(x => x !== null);
    envLocals.pop();
    locals = copy(locs);
    globals = copy(globs);
    args = copy(ar);
    return ret;
};

const returnStatementHandler = (x) => {
    x.argument = retVal(x.argument);
    return x;
};

/*************************************** Global Handlers ****************************************/

const functionDeclarationHandler = (x) => {
    x.body.body = x.body.body.map(findHandler).filter(x => x !== null);
    return x;
};

const globalDeclaratorHandler = (x) => {
    let val = retVal(x.init);
    globals[x.id.name] = val;
    x.init = val;
    return x;
};

const gVariableDeclarationHandler = (x) => {
    x.declarations = x.declarations.map(globalDeclaratorHandler);
    return x;
};

const gSequenceExpressionHandler = (x) => {
    x.expressions = x.expressions.map(findGlobalHandler);
    return x;
};

const gAssignmentExpressionHandler = (x) => {
    let val = retVal(x.right);
    if (x.left.type === 'MemberExpression')
        findValue(x.left.object).elements[x.left.property.value] = val;
    else globals[x.left.name] = val;
    x.right = val;
    return x;
};

const gUpdateExpressionHandler = (x) => {
    let op = x.operator === '++' ? '+' : '-';
    globals[x.argument.name] = buildBinaryExp(op, globals[x.argument.name],
        {'type': 'Literal', 'value': 1, 'raw': '1'});
    return x;
};

const gExpressionHandler = (x) => {
    x.expression = findGlobalHandler(x.expression);
    return x;
};

const findGlobalHandler = (x) =>
    globalHandlers[x.type](x);

const findHandler = (x) =>
    Handlers[x.type](x);

let globalHandlers = {
    'FunctionDeclaration': functionDeclarationHandler,
    'VariableDeclaration': gVariableDeclarationHandler,
    'ExpressionStatement': gExpressionHandler,
    'SequenceExpression': gSequenceExpressionHandler,
    'AssignmentExpression': gAssignmentExpressionHandler,
    'UpdateExpression': gUpdateExpressionHandler
};

let Handlers = {
    'VariableDeclaration': variableDeclarationHandler,
    'BlockStatement': blockStatementHandler,
    'VariableDeclarator': variableDeclaratorHandler,
    'ExpressionStatement': expressionStatementHandler,
    'SequenceExpression': sequenceExpressionHandler,
    'AssignmentExpression': assignmentExpressionHandler,
    'UpdateExpression': updateExpressionHandler,
    'WhileStatement': loopHandler,
    'ForStatement': loopHandler,
    'IfStatement': ifHandler,
    'ReturnStatement': returnStatementHandler
};

const toSstring = (esp) =>
    escodegen.generate({'type': 'Program', 'body': [esp]});

const getCodeToEval = (code) => {
    let ret = [];
    const findColorHandler = (x) => {
        if (coloringHandlers[x.type] !== undefined) coloringHandlers[x.type](x);
    };
    let coloringHandlers = {
        'FunctionDeclaration': (x) => {findColorHandler(x.body);},
        'BlockStatement': (x) => {x.body.map(findColorHandler);},
        'IfStatement': (x) => {
            ret.push([x.loc.start.line - 1, eval(toSstring(x.test)) ? 1 : 0]);
            findColorHandler(x.consequent);
            if (x.alternate !== null) findColorHandler(x.alternate);
        },
        'WhileStatement': (x) => {findHandler(x.body);},
        'ForStatement': (x) => {findHandler(x.body);}
    };
    code.map(findColorHandler);
    return ret;
};

const initArgs = (argus) => {
    globals = {};
    args = {};
    locals = {};
    if (argus === '')
        return;
    let code = esprima.parse(argus).body[0].expression;
    if (code.type === 'SequenceExpression')
        code.expressions.map(x => args[x.left.name] = x.right);
    else
        args[code.left.name] = code.right;
};

let toPaintCodeArr;

const parseCode = (codeToParse, argus) => {
    initArgs(argus);
    toPaint = false;
    let ret = esprima.parseScript(codeToParse).body;
    let ret2 = flat(ret.map(x => globalHandlers[x.type](x)));
    let generatedCode = escodegen.generate({'type': 'Program', 'body': ret2});
    toPaint = true;
    let ret3 = flat(ret.map(x => globalHandlers[x.type](x)));
    let tmp = esprima.parse(escodegen.generate({'type': 'Program', 'body': ret3}), {loc: true});
    toPaintCodeArr = getCodeToEval(tmp.body);
    return generatedCode;
};

export {parseCode, toPaintCodeArr};
