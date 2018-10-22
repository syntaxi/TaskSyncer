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
        this.loadBasicTrello(data);

        //TODO: Get the custom field data at the same time as the card data
        return requester.getCustomFields(this.trelloId).then(body => {
            this.loadCustomTrello(body.customFieldItems);
        });
    }

    /**
     * Handles and loads this card from the given basic card data
     *
     * @param data The basic card data to load
     */
    loadBasicTrello(data) {
        Object.values(this.fields)
            .filter(value => value instanceof BasicTaskField)
            .forEach(field => field.loadFromTrello(data));
    }

    /**
     * Handles and loads this card from the given custom field data.
     *
     * @param data {[json]} A list of the custom fields to update
     */
    loadCustomTrello(data) {
        /* Load in the main data from each field */
        data.forEach(this.handleField, this);

        /* Update false entries for the checkboxes */
        Object.values(this.fields)
            .filter(field => field instanceof CustomTaskField)
            .forEach(field => field.handleNotPresent());
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
            /* Using the write type, work out what fields to write */
            let customFields = this._filterTrelloFields(CustomTaskField, writeType, fieldName);
            let mainFields = this._filterTrelloFields(BasicTaskField, writeType, fieldName);

            if (customFields.length > 0 || mainFields.length > 0) {
                console.log(`Writing "${this.name}" (${this.trelloId}) to trello: ${customFields.length} fields`);


                /* Write the main data */
                if (mainFields.length > 0) {
                    const data = {};
                    mainFields.forEach(
                        field => field.writeToTrello(data)
                    );
                    promises.push(requester.writeMainTrello(this.trelloId, data));
                }

                /* Write the fields selected */
                customFields.forEach(
                    field => promises.push(
                        requester.setCustomField(this.trelloId, field.fieldId, field.writeToTrello())));
            }
        } else {
            console.error("Cannot write. Have no trello id")
        }
        return Promise.all(promises);
    }

    /**
     * Filters the fields that should be written to trello.
     *
     * @param instanceType The type of field to filter
     * @param writeType The filtering method to use
     * @param fieldName The name of the specific field to write, if relevant
     * @return {[CustomTaskField]} True if they should be written, false otherwise
     * @private
     */
    _filterTrelloFields(instanceType, writeType, fieldName) {
        switch (writeType) {
            /* Only write fields that weren't written to */
            case writeTypes.ONLY_UNUPDATED:
                return Object.values(this.fields)
                    .filter(field => field instanceof instanceType)
                    .filter(field => !field.wasUpdated);
            /* Only change fields that were written to */
            case writeTypes.ONLY_UPDATED:
                return Object.values(this.fields)
                    .filter(field => field instanceof instanceType)
                    .filter(field => field.wasUpdated);

            /* Only change fields who's value hasn't altered */
            case writeTypes.ONLY_UNCHANGED:
                return Object.values(this.fields)
                    .filter(field => field instanceof instanceType)
                    .filter(field => !field.wasChanged);
            /* Only change fields who's value has altered */
            case writeTypes.ONLY_CHANGED:
                return Object.values(this.fields)
                    .filter(field => field instanceof instanceType)
                    .filter(field => field.wasChanged);

            /* Write all fields */
            case writeTypes.ALL:
                return Object.values(this.fields)
                    .filter(field => field instanceof instanceType);
            /* Write one specific field type */
            case writeTypes.SPECIFIC:
                return this.fields[fieldName] instanceof instanceType
                    ? [this.fields[fieldName]]
                    : [];
            default:
                throw TypeError("Unknown write type for trello: " + writeType);
        }
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

            case writeTypes.ONLY_CHANGED:
                shouldWrite = Object.values(this.fields).find(value => value.wasChanged);
                break;

            case writeTypes.ONLY_UNCHANGED:/* Oh Noes */
                shouldWrite = !Object.values(this.fields).find(value => value.wasChanged);
                break;
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