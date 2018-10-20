/**
 * Useful to have a 'enum' for the categories
 * @type {{CODING: number, DESIGN: number, DOCS_TRAINING: number, QA: number, OUTRESEARCH: number}}
 */
const categories = {
    CODING: 1,
    DESIGN: 2,
    DOCS_TRAINING: 3,
    QA: 4,
    OUTRESEARCH: 5
};

const writeTypes = {
    ONLY_UPDATED: 1,
    ONLY_UNCHANGED: 2,
    ALL: 3
};

module.exports = {
    categories: categories,
    writeTypes: writeTypes
};