const {categories, writeTypes} = require('./Globals');
/**
 * The main requester to use for api calls
 * @type {ApiRequester}
 */
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
         * @type {{googleId: TaskField}}
         */
        this.fields = {
            /**
             * @type {number}
             * @name Task#googleId
             * @name Task#fields#googleId
             */
            googleId: new CustomTaskField('id', this.customFields.googleId, 'number', 0),
            /**
             * @type {string}
             * @name Task#trelloId
             */
            trelloId: new BasicTaskField(
                (data, value) => value || data['private_metadata'],
                'id',
                "",
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
            mentors: new TaskField('mentors', ['iamajellysnake@gmail.com']),//TODO: Add this to trello cards
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
                data => data.tags.join(", "),
                this.customFields.tags,
                'string',
                "",
                data => data.tags = this.tags.split(/\s*,\s*/i),),
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
                data => data.categories.includes(categories.CODING),
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
                data => data.categories.includes(categories.DESIGN),
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
                data => data.categories.includes(categories.DOCS_TRAINING),
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
                data => data.categories.includes(categories.QA),
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
                data => data.categories.includes(categories.OUTRESEARCH),
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
     * @param writeType {number} The write type to use to filter fields
     * @param [fieldName] {string} The names of the specific field to use (If a appropriate write type is given)
     * @return {Promise} A promise that is resolved when all the fields have been written to
     */
    writeToTrello(writeType, fieldName) {
        const promises = [];
        if (this.trelloId) {
            let fields;
            /* Using the write type, work out what fields to write */
            switch (writeType) {
                /* Only write fields that weren't written to */
                case writeTypes.ONLY_UNUPDATED:
                    fields = Object.values(this.fields)
                        .filter(field => field instanceof CustomTaskField)
                        .filter(field => !field.wasUpdated);
                    break;
                /* Only change fields that were written to */
                case writeTypes.ONLY_UPDATED:
                    fields = Object.values(this.fields)
                        .filter(field => field instanceof CustomTaskField)
                        .filter(field => field.wasUpdated);
                    break;

                /* Only change fields who's value hasn't altered */
                case writeTypes.ONLY_UNCHANGED:
                    fields = Object.values(this.fields)
                        .filter(field => field instanceof CustomTaskField)
                        .filter(field => !field.wasChanged);
                    break;
                /* Only change fields who's value has altered */
                case writeTypes.ONLY_CHANGED:
                    fields = Object.values(this.fields)
                        .filter(field => field instanceof CustomTaskField)
                        .filter(field => field.wasChanged);
                    break;

                /* Write all fields */
                case writeTypes.ALL:
                    fields = Object.values(this.fields)
                        .filter(field => field instanceof CustomTaskField);
                    break;
                /* Write one specific field type */
                case writeTypes.SPECIFIC:
                    fields = [this.fields[fieldName]];
                    break;
                default:
                    throw TypeError("Unknown write type for trello: " + writeType);
            }
            if (fields.length > 0) {
                console.log(`Writing "${this.name}" (${this.trelloId}) to trello: ${fields.length} fields`);

                /* Write the fields selected */
                fields.forEach(
                    field => promises.push(
                        requester.setCustomField(this.trelloId, field.fieldId, field.writeToTrello())));
            }
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
    writeToGoogle(writeType) {
        let shouldWrite = true;
        let data = {};
        switch (writeType) {
            /* Write no matter what */
            case writeType.SPECIFIC:
            case writeTypes.ALL:
                shouldWrite = true;
                break;

            /* Write, if any fields were updated */
            case writeTypes.ONLY_UPDATED:
                shouldWrite = Object.values(this.fields).find(value => value.wasUpdated);
                break;

            /* Write, if no fields were updated */
            case writeTypes.ONLY_UNUPDATED:
                shouldWrite = !Object.values(this.fields).find(value => value.wasUpdated);
                break;

            case writeTypes./* Oh Noes */
                default:
                throw TypeError("Unknown writetype: " + writeType)
        }
        if (shouldWrite) {
            for (let field in this.fields) {
                this.fields[field].writeToGoogle(data);
            }

            if (!this.googleId) {
                console.warn(`Making new google task for ${this.name} (${this.trelloId})`);
                return new Promise(resolve => {
                    requester.createGoogleTask(data).then(body => {
                        /* Store the google ID */
                        this.fields.googleId.loadFromGoogle(body);
                        /* Write the google task id to trello*/
                        this.writeToTrello(writeTypes.SPECIFIC, 'googleId')
                            .then(resolve);
                    });
                });
            } else {
                console.log(`Writing ${this.name} to Google.`);
                return requester.updateGoogle(this.googleId, data);
            }
        }

    }

    /**
     * Resets the 'updated' status on all fields
     */
    resetStatus() {
        for (let field in this.fields) {
            this.fields[field].wasUpdated = false;
            this.fields[field].wasChanged = false;
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