/*jslint long, white*/
const unaryArrayMethod = function (method) {
    return function (action, list) {
        if (list === undefined) {
            return function (nextList) {
                return nextList[method](action);
            };
        }
        return list[method](action);
    };
};

const every = unaryArrayMethod("every");
const filter = unaryArrayMethod("filter");
const find = unaryArrayMethod("find");
const flatMap = unaryArrayMethod("flatMap");
const map = unaryArrayMethod("map");

const range = function (from, to) {
    if (from >= to) {
        return [];
    }
    return range(from, to - 1).concat(to - 1);
};

const reduce = function (action, initial, list) {
    if (list === undefined) {
        return function (nextList) {
            return nextList.reduce(action, initial);
        };
    }
    return list.reduce(action, initial);
};

const pipe = function (...functions) {
    return function (value) {
        return functions.reduce(function (result, nextFunction) {
            return nextFunction(result);
        }, value);
    };
};

export default Object.freeze({
    every,
    filter,
    find,
    flatMap,
    map,
    pipe,
    range,
    reduce
});
