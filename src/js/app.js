import $ from 'jquery';
import {parseCode, toPaintCodeArr} from './code-analyzer';

let conts = (arr2) => {
    let out = false;
    for (let i = 0; i < toPaintCodeArr.length; i++) {
        if(toPaintCodeArr[i][0] === arr2[0] && toPaintCodeArr[i][1] === arr2[1])
            out = true;
    }
    return out;
};

const paint = (l) => {
    let res = '';
    let arr = l.split('\n');
    for (let i = 0; i < arr.length; i++) {
        let prop = conts([i, 0]) ? 'red'
            : conts([i, 1]) ? 'green' : 'black';
        res += '<div style="color: ' + prop + '">' + arr[i] + '</div>';
    }
    document.body.innerHTML = res;
    // return res;
};

$(document).ready(function () {
    $('#codeSubmissionButton').click(() => {
        let codeToParse = $('#codePlaceholder').val();
        let args = $('#assignments').val();
        let parsedCode = parseCode(codeToParse, args);
        paint(parsedCode);
        // $('#parsedCode').val(JSON.stringify(parsedCode, null, 0));
        // $('#parsedCode').val(parsedCode);
    });
});
