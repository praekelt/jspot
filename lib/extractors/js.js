var _ = require('underscore');
var vm = require('vm');
var falafel = require('falafel');
var gettext = require('../gettext');

var templateLiteralRE = /^`(.*)`$/;
var simpleQuoteRE = /'/g;


function transform(src, opts, fn) {
    if (typeof opts == 'function')  {
        fn = opts;
        opts = {};
    }

    opts.parserOptions = _.extend({}, opts.parserOptions);

    return falafel(src, opts.parserOptions, fn);
}


function extract(opts) {
    var src = yoink_members(opts.source, opts);
    src = yoink_tpl_string(src, opts);

    return gather(src, opts).map(function(node) {
        return run(node, opts);
    });
}


function yoink_members(src, opts) {
    opts = _.extend({}, opts);

    return transform(src, opts, function(node) {
        if (is_member(node, opts)) {
            node.parent.update(node.source());
        }
    }).toString();
}


function yoink_tpl_string(src, opts) {
    opts = _.extend({}, opts);

    return transform(src, opts, function(node) {
        if (node.type === 'TemplateLiteral') {
            var source = node.source();
            if (source) {
                source = source.replace(templateLiteralRE, function(_, content) {
                    return "'" + content.replace(simpleQuoteRE, "\\'") + "'";
                });
                node.update(source);
            }
        }
    }).toString();
}


function gather(src, opts) {
    var matches = [];

    opts.parserOptions = _.extend({}, {
        locations: true
    }, opts.parserOptions);

    transform(src, opts, function(node) {
        if (match(node, opts)) {
            matches.push(parse(node, opts));
        }
    });

    return matches;
}


function run(node, opts) {
    var context = {};
    context[opts.keyword] = gettext;

    var result;
    try {
        result = vm.runInNewContext(node.src, context);
    }
    catch (e) {
        throw new Error([
            "on line " + node.line,
            "of file '" + opts.filename + "'",
            e.message].join(' '));
    }

    result.line = node.line;
    result.filename = opts.filename;
    return result;
}


function match(node, opts) {
    if (node.type !== 'CallExpression') {
        return false;
    }

    if (node.callee.type === 'Identifier') {
        return node.callee.name === opts.keyword;
    }

    if (node.callee.type !== 'MemberExpression') {
        return false;
    }

    if (node.callee.object.type === 'Identifier') {
        return node.callee.object.name === opts.keyword;
    }

    if (is_indirect_call(node) || is_apply(node)) {
        return node.callee.object.object.name === opts.keyword;
    }

    return false;
}


function parse(node, opts) {
    var result = {line: node.loc.start.line};

    if (is_apply(node)) parse_apply(node, opts);
    else parse_call(node, opts);

    result.src = node.source();
    return result;
}


function parse_apply(node, opts) {
    fn_wrap(node.arguments[0]);

    node.arguments[1]
        .elements
        .forEach(fn_wrap);
}


function parse_call(node, opts) {
    node.arguments
        .forEach(fn_wrap);
}


function fn_wrap(node) {
    node.update('function() { return ' + node.source() + '; }');
}


function is_member(node, opts) {
    return node.type === 'Identifier'
        && node.name === opts.keyword
        && node.parent
        && node.parent.property === node
        && node.parent.type == 'MemberExpression';
}


function is_indirect_call(node) {
    return node.type === 'CallExpression'
        && node.callee.type === 'MemberExpression'
        && node.callee.property.type === 'Identifier'
        && node.callee.property.name === 'call';
}


function is_apply(node) {
    return node.type === 'CallExpression'
        && node.callee.type === 'MemberExpression'
        && node.callee.property.type === 'Identifier'
        && node.callee.property.name === 'apply';
}


module.exports = extract;
