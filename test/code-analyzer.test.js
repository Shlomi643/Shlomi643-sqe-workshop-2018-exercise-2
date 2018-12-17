import assert from 'assert';
import {parseCode} from '../src/js/code-analyzer';

const tester = (title, code, args, actual) =>
    it(title, () => assert.equal(JSON.stringify(parseCode(code, args)), actual));

describe('The javascript parser', () => {
    tester('is parsing an empty function correctly', '', '', '""');
    tester('GLOBAL: is parsing a simple variable declaration correctly', 'let a = 1; a--;', '', '"let a = 1;\\na--;"');
    tester('GLOBAL: is parsing a multiple variable declaration correctly', 'let a = 1, b = 2;', '', '"let a = 1, b = 2;"');
    tester('GLOBAL: is parsing a multiple variable declaration and expression correctly', 'let a = 1, b = 2;a = 1, a = 2, b = 124;b++;', '', '"let a = 1, b = 2;\\na = 1, a = 2, b = 124;\\nb++;"');
    tester('GLOBAL: is parsing a function correctly', 'function f (p) {return p;}', 'p = 1', '"function f(p) {\\n    return p;\\n}"');
    tester('GLOBAL: is parsing a function correctly', 'function foo(x, y, z){ let a = x + 1; let b = a + y; let c = 0; if (b < z) { c = c + 5; return x + y + z + c; } else if (b < z * 2) { c = c + x + 5; return x + y + z + c; } else { c = c + z + 5; return x + y + z + c; } }', 'x = 10, y = 100, z= 122', '"function foo(x, y, z) {\\n    if (x + 1 + y < z) {\\n        return x + y + z + (0 + 5);\\n    } else {\\n        if (x + 1 + y < z * 2) {\\n            return x + y + z + (0 + x + 5);\\n        } else {\\n            return x + y + z + (0 + z + 5);\\n        }\\n    }\\n}"');
    tester('GLOBAL: is parsing a function correctly', 'let x = 21; function func (p){ p =x; let r =12, t = 34; r = 1, t = 4; if(r == t && true){ p = r; return r - t; }else return 1; }', 'p = 1', '"let x = 21;\\nfunction func(p) {\\n    p = x;\\n    if (1 == 4 && true) {\\n        p = 1;\\n        return 1 - 4;\\n    } else {\\n        return 1;\\n    }\\n}"');
    tester('GLOBAL: is parsing a function correctly', 'let a = [1, 2]; a[0] = 100; function f(p) { let f = a[1]; p--; if(p == 1){ return a[0]; }else return f; }', 'p = 1', '"let a = [\\n    100,\\n    2\\n];\\na[0] = 100;\\nfunction f(p) {\\n    p--;\\n    if (p == 1) {\\n        return 100;\\n    } else {\\n        return 2;\\n    }\\n}"');
    tester('GLOBAL: is parsing a function correctly', 'let a = [1, 2]; a[0] = \'str\'; function f(p) { let f = a[1]; p--; if(p == 1){ return a[0]; }else return f; }', 'p = 12;', '"let a = [\\n    \'str\',\\n    2\\n];\\na[0] = \'str\';\\nfunction f(p) {\\n    p--;\\n    if (p == 1) {\\n        return \'str\';\\n    } else {\\n        return 2;\\n    }\\n}"');

});
