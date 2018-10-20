const {categories, writeTypes} = require('./Globals');
const requester = require('./ApiRequester');
const Promise = require('bluebird');
const {TaskField, BasicTaskField, CustomTaskField} = require("./TaskFields");

/**
 * Represents a single task.
 * @namespace
 * @property {boolean} isDoc True if the task has the "Documentation & Training" category
 */
class Task {
    constructor() {
        /* Trello custom field id's */
        this.customFields = {
            isBeginner: "5bb13d35adbb5244eb5b749d",
            days: "5bb13de3b6a0c658dce16fd5",
            tags: "5bb13e3b05e0cc6f01a9b76f",
            instances: "5bb13e67765a792d213d290b",
            googleId: "5bc2c3822a3cad2dc77409f5",

            isCode: "5bb13d86d728442f22e898e0",
            isDesign: "5bb13d8fc802625a6c30ee61",
            isDocs: "5bb13da34edf5926c83f294a",
            isQa: "5bb13da9f285397f1a80dddc",
            isOutResearch: "5bb13dbc351a9c4e5c93cd1f"
        };


        /**
         * All the fields for a task
         * @type {{TaskField}}
         */
        this.fields = {
            /**
             * @type {number}
             * @name Task#googleId
             * @name Task#fields#googleId
             */
            googleId: new CustomTaskField('id', this.customFields.googleId, 'number'),
            /**
             * @type {string}
             * @name Task#trelloId
             */
            trelloId: new BasicTaskField(
                (data, value) => value || data['private_metadata'],
                'id',
                null,
                data => data.private_metadata = this.trelloId),

            /**
             * @type {string}
             * @name Task#name
             */
            name: new BasicTaskField('name', 'name', ""),
            /**
             * @type {string}
             * @name Task#description
             */
            description: new BasicTaskField('description', 'desc', ""),
            status: new TaskField('status', 1),//TODO: Add this to trello cards
            mentors: new TaskField('mentors', []),//TODO: Add this to trello cards
            externalUrl: new TaskField('external_url', ""), //TODO: Add this to trello cards
            /**
             * @type {number}
             * @name Task#maxInstances
             */
            maxInstances: new CustomTaskField(
                'max_instances',
                this.customFields.instances,
                'number',
                1),
            /**
             * @type {[string]}
             * @name Task#days
             */
            tags: new CustomTaskField(
                'tags',
                this.customFields.tags,
                field => field.text.split(/\s*,\s*/i),
                []),
            /**
             * @type {boolean}
             * @name Task#isBeginner
             */
            isBeginner: new CustomTaskField(
                'is_beginner',
                this.customFields.isBeginner,
                'boolean',
                false),
            /**
             * @type {number}
             * @name Task#days
             */
            days: new CustomTaskField(
                'time_to_complete_in_days',
                this.customFields.days,
                'number',
                3),

            /**
             * @type {boolean}
             * @name Task#isCode
             */
            isCode: new CustomTaskField(
                data => categories.CODING in data,
                this.customFields.isCode,
                'boolean',
                false,
                data => {
                    data.categories = data.categories || [];
                    if (this.isCode)
                        data.categories.push(categories.CODING);
                }),
            /**
             * @type {boolean}
             * @name Task#isDesign
             */
            isDesign: new CustomTaskField(
                data => categories.DESIGN in data,
                this.customFields.isDesign,
                'boolean',
                false,
                data => {
                    data.categories = data.categories || [];
                    if (this.isDesign)
                        data.categories.push(categories.DESIGN);
                }),
            /**
             * @type {boolean}
             * @name Task#isDocs
             */
            isDocs: new CustomTaskField(
                data => categories.DOCS_TRAINING in data,
                this.customFields.isDocs,
                'boolean',
                false,
                data => {
                    data.categories = data.categories || [];
                    if (this.isDocs)
                        data.categories.push(categories.DOCS_TRAINING);
                }),
            /**
             * @type {boolean}
             * @name Task#isQa
             */
            isQa: new CustomTaskField(
                data => categories.QA in data,
                this.customFields.isQa,
                'boolean',
                false,
                data => {
                    data.categories = data.categories || [];
                    if (this.isQa)
                        data.categories.push(categories.QA);
                }),
            /**
             * @type {boolean}
             * @name Task#isOutResearch
             */
            isOutResearch: new CustomTaskField(
                data => categories.OUTRESEARCH in data,
                this.customFields.isOutResearch,
                'boolean',
                false,
                data => {
                    data.categories = data.categories || [];
                    if (this.isOutResearch)
                        data.categories.push(categories.OUTRESEARCH);
                }),


            lastModified: new TaskField('last_modified', 0),
            claimedCount: new TaskField('claimed_count', 0),
            availableCount: new TaskField('available_count', 1),
            completedCount: new TaskField('completed_count', 0)

        };

        for (let field in this.fields) {
            Object.defineProperty(this, field, {
                get: this.fields[field].getValue.bind(this.fields[field]),
                set: this.fields[field].setValue.bind(this.fields[field])
            });
        }
    }

    /**
     * Loads data from a google data payload.
     *
     * @param data {json} The google api result for this task.
     */
    loadFromGoogle(data) {
        for (let field in this.fields) {
            this.fields[field].loadFromGoogle(data)
        }
    }

    /**
     * Loads the task from trello card data.
     * Makes further api calls to obtain the custom field data
     *
     * @param data {json} The Trello card data to load in
     * @return {Promise} A new promise that is only finished when all the data has been loaded
     */
    loadFromTrello(data) {
        /* Load all the basic fields */
        Object.values(this.fields)
            .filter(value => value instanceof BasicTaskField)
            .forEach(field => field.loadFromTrello(data));

        //TODO: Get the custom field data at the same time as the card data
        return requester.getCustomFields(this.trelloId).then(body => {
            /* Copy across so we know what fields are NOT set */
            body.customFieldItems.forEach(this.handleField, this);

            /* Update false entries for the checkboxes */
            Object.values(this.fields)
                .filter(field => field instanceof CustomTaskField)
                .forEach(field => field.handleNotPresent());
        });
    }

    /**
     * Updates this task with the data from the given custom field.
     *
     * @param field {json} The custom field to load the data from
     */
    handleField(field) {
        Object.values(this.fields)
        /* Only process fields linked with a Custom Field */
            .filter(taskField => taskField instanceof CustomTaskField)
            /* Only process field that match this field's id */
            .filter(value => value.doesFieldMatch(field))
            /* Load the data for each remaining field */
            .forEach(taskField => taskField.loadFromTrello(field));
    }

    /**
     * Updates the card on trello with the data in this task
     *
     * _This will overwrite the current card information_
     *
     * @return {Promise} A promise that is resolved when all the fields have been written to
     */
    async writeToTrello(writeType) {
        console.log(`Writing "${this.name}" (${this.trelloId}) to trello`);
        const promises = [];
        if (this.trelloId) {
            let fields;
            /* Using the write type, work out what fields to write */
            switch (writeType) {
                case writeTypes.ONLY_UNCHANGED:
                    fields = Object.values(this.fields)
                        .filter(field => field instanceof CustomTaskField)
                        .filter(field => !field.wasUpdated);
                    break;
                case writeTypes.ONLY_UPDATED:
                    fields = Object.values(this.fields)
                        .filter(field => field instanceof CustomTaskField)
                        .filter(field => field.wasUpdated);
                    break;
                case writeTypes.ALL:
                    fields = Object.values(this.fields);
                    break;
                default:
                    throw TypeError("Unknown write type for trello: " + writeType);
            }

            /* Write the fields selected */
            fields.forEach(
                field => promises.push(
                    requester.setCustomField(this.trelloId, field.fieldId, field.writeToTrello())));
        } else {
            console.error("Cannot write. Have no trello id")
        }
        return Promise.all(promises);
    }

    /**
     * Updates the task on GCI to the data in the current task
     *
     * _This will overwrite the current task information_
     */
    writeToGoogle() {
        let data = {};
        for (let field in this.fields) {
            this.fields[field].writeToGoogle(data)
        }

        if (!this.googleId) {
            console.warn(`Making new google task for ${this.name} (${this.trelloId})`);
            requester.googlePost(data).then(body => {
                this.fields.googleId.loadFromGoogle(data);
                this.googleId = body.id;
                /* We write to trello to write the google task id */
                this.writeToTrello();
            });
        } else {
            requester.updateGoogle(this.googleId, data);
        }
    }

    /**
     * Resets the 'updated' status on all fields
     */
    resetStatus() {
        for (let field in this.fields) {
            this.fields[field].wasUpdated = false;
        }
    }

    toString() {
        let result = [];
        for (let fieldName in this.fields) {
            result.push(`${fieldName} -> ${this.fields[fieldName].getValue()}`);
        }
        return result.join("\n");
    }
}


module.exports = Task;