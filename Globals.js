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

/**
 *  The different ways in which fields written to trello can be filtered.
 * @type {{ONLY_UPDATED: number, ONLY_UNCHANGED: number, ALL: number, SPECIFIC:number}}
 */
const writeTypes = {
    ONLY_UPDATED: 1,
    ONLY_CHANGED: 2,
    ONLY_UNUPDATED: 3,
    ONLY_UNCHANGED: 4,
    ALL: 5,
    SPECIFIC: 6
};

const fields = {
    GOOGLE_ID: "googleId",
    TRELLO_ID: "trelloId",
    NAME: "name",
    DESCRIPTION: "desc",
    STATUS: "status",
    MENTORS: "mentors",
    EXTERNAL_URL: "extUrl",
    MAX_INSTANCES: "maxInst",
    TAGS: "tags",
    IS_BEGINNER: "isBeg",
    DAYS: "days",
    CATEGORIES: "categories",
    LAST_MODIFIED: "last_mod",
    CLAIMED_COUNT: "claimed",
    AVAILABLE_COUNT: "available",
    COMPLETED_COUNT: "completed"
};

module.exports = {
    categories: categories,
    writeTypes: writeTypes,
    fields: fields
};