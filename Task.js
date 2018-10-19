const {categories} = require('./Globals');
const requester = require('./ApiRequester');
const Promise = require('bluebird');

/**
 * Represents a single field on a task.
 * There are two child classes depending on the location of the data in trello
 *
 * @see BasicTaskField
 * @see CustomTaskField
 */
class TaskField {
    /**
     * Loads up the google elements of the task field
     *
     * @param googleHandler {string|function} If this is a string then, it is used as the key for the data payload.
     *                  if it is a function, then that function should take in the full data payload
     *                  and return the value to set the field to. The current field value is also passed as an optional
     *                  second paramater
     * @param [initialValue] {*} The initial value to set the field to. Default of null
     */
    constructor(googleHandler, initialValue) {
        this.parseGoogle = this._loadArgument(googleHandler);
        this.value = initialValue || null;
    }

    /**
     * Handles converting the handler argument into the correct function type
     *
     * @param argument The handler argument
     * @return {function} A function that takes in the data and returns the value for this field
     * @private
     */
    _loadArgument(argument) {
        if (typeof argument === "string") {
            return data => data[argument];
        } else if (typeof argument === "function") {
            return argument;
        } else {
            throw new TypeError(`Field (${argument}) is not a String or Function`);
        }
    }

    /**
     * Loads the value for this field from the given data payload.
     * This calls the google handler as specified in the constructor
     *
     * @param data The raw google task payload
     */
    loadFromGoogle(data) {
        this.value = this.parseGoogle(data, this.value)
    }

    /**
     * Loads the value for this field from the trello payload.
     * This payload varies depending on the subclasses for this class
     *
     * Blank, should be overridden.
     */
    loadFromTrello() {

    }

    /**
     * @return {*} The value contained in this field
     */
    getValue() {
        return this.value
    }

    /**
     * @param data The value to set this field to.
     */
    setValue(data) {
        this.value = data;
    }
}

/**
 * Represents a task field where the data is located in the main card payload.
 *
 * @see TaskField
 */
class BasicTaskField extends TaskField {
    /**
     * Loads in the trello field stuff and delegates the google fields to the super constructor
     * @param googleHandler {string|function} The google handler
     * @param trelloHandler {string|function} If a string, then should be the key of the data in the payload.
     *                      Else should be a function that takes in the payload and optionally the current field value
     *                      and returns the new field value
     * @param [initialValue] {*} The initial value to set the field to. Defaults to null
     */
    constructor(googleHandler, trelloHandler, initialValue) {
        super(googleHandler, initialValue);
        this.parseTrello = this._loadArgument(trelloHandler);
    }

    /**
     * Loads the value for this field from the main card payload
     * @param data The card payload
     */
    loadFromTrello(data) {
        this.value = this.parseTrello(data)
    }
}

/**
 * Represents a task field where the data is located in a custom field
 *
 * @see TaskField
 */
class CustomTaskField extends TaskField {
    /**
     * Loads in the trello field stuff and delegates the google fields to the super constructor
     *
     * @param googleHandler {string|function} The google handler
     * @param fieldId {string} The id of the custom field
     * @param trelloHandler {string|function} If a string, should be the type of the custom field data.
     *                      If a function, should take in the field payload and optionally the fields current value
     *                      and return the new value
     * @param [initialValue] {*} The initial value to set the field to. Defaults to null.
     */
    constructor(googleHandler, fieldId, trelloHandler, initialValue) {
        super(googleHandler, initialValue);
        this.fieldId = fieldId;
        this.type = typeof trelloHandler;
        this.parseTrello = this._parseTrelloHandler(trelloHandler);
    }

    /**
     * Converts the trello handler into an appropriate function
     *
     * @param trelloHandler
     * @return {function} The parsing function
     * @private
     */
    _parseTrelloHandler(trelloHandler) {
        if (typeof trelloHandler === "string") {
            switch (trelloHandler) {
                case 'number':
                    return field => parseInt(field.number);
                case 'boolean':
                    return field => field.checked === 'true';
                default:
                    throw new TypeError(`Type of trelloHandler (${trelloHandler}) was not known `)
            }
        } else if (typeof trelloHandler === 'function') {
            return trelloHandler;
        } else {
            throw new TypeError(`Field trelloHandler (${trelloHandler}) is not a String or Function`);
        }
    }

    /**
     * Called if the field was not set on the card. Handles the default value for the field
     * Useful for checkboxes where a 'false' value simply means the field doesn't show up
     */
    handleNotPresent() {
        if (this.type === 'boolean') {
            this.setValue(false)
        }
    }

    /**
     * Checks if this matches a given custom field
     *
     * @param field {json} The full custom field payload to check against
     * @return {boolean} True if the given custom field matches this
     */
    doesFieldMatch(field) {
        return field.idCustomField === this.fieldId
    }

    /**
     * Loads the field data from the custom field payload
     *
     * @param field The full payload for the custom field.
     */
    loadFromTrello(field) {
        this.value = this.parseTrello(field.value, this.value)
    }

    /**
     * Converts this field to a string.
     * Simply gives the string version of the value
     *
     * @return {string} The string version of this fields data
     */
    toString() {
        return (this.value || "null").toString()
    }
}

/**
 * Represents a single task.
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
            googleId: new CustomTaskField('id', this.customFields.googleId, 'number'),
            trelloId: new BasicTaskField((data, value) => value || data['private_metadata'], 'id'),

            name: new BasicTaskField('name', 'name'),
            description: new BasicTaskField('description', 'desc'),
            status: new TaskField('status'),//TODO: Add this to trello cards
            mentors: new TaskField('mentors'),//TODO: Add this to trello cards
            externalUrl: new TaskField('external_url'), //TODO: Add this to trello cards
            maxInstances: new CustomTaskField(
                'max_instances',
                this.customFields.instances,
                'number',
                1),
            tags: new CustomTaskField('tags',
                this.customFields.tags,
                field => field.text.split(/\s*,\s*/i),
                []),
            isBeginner: new CustomTaskField(
                'is_beginner',
                this.customFields.isBeginner,
                'boolean',
                false),
            days: new CustomTaskField(
                'time_to_complete_in_days',
                this.customFields.days,
                'number',
                3),


            isCode: new CustomTaskField(
                data => categories.CODING in data,
                this.customFields.isCode,
                'boolean',
                false),
            isDesign: new CustomTaskField(
                data => categories.DESIGN in data,
                this.customFields.isDesign,
                'boolean',
                false),
            isDocs: new CustomTaskField(
                data => categories.DOCS_TRAINING in data,
                this.customFields.isDocs,
                'boolean',
                false),
            isQa: new CustomTaskField(
                data => categories.QA in data,
                this.customFields.isQa,
                'boolean',
                false),
            isOutResearch: new CustomTaskField(
                data => categories.OUTRESEARCH in data,
                this.customFields.isOutResearch,
                'boolean',
                false),


            lastModified: new TaskField('last_modified'),
            claimedCount: new TaskField('claimed_count'),
            availableCount: new TaskField('available_count'),
            completedCount: new TaskField('completed_count')

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
     * @return {Promise} Returns a new promise that is only finished when all the data has been loaded
     */
    loadFromTrello(data) {
        /**
         * Loads the data from a trello payload.
         * This is the result from querying the card.
         *
         * Makes further calls to the api in order to get the data for each of the custom fields
         *
         * Returns a promise that only activates when all fields have been requested
         */

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
            .filter(taskField => taskField.doesFieldMatch(field))
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
    async writeToTrello() {
        console.log(`Writing "${this.name}" (${this.trelloId}) to trello`);
        const promises = [];
        if (this.trelloId) {
            //TODO: This is really ugly
            /* Set custom fields */
            await promises.push(requester.setCustomField(this.trelloId, this.customFields.isBeginner, 'checked', this.isBeginner));

            await promises.push(requester.setCustomField(this.trelloId, this.customFields.isQa, 'checked', categories.QA in this.categories));
            await promises.push(requester.setCustomField(this.trelloId, this.customFields.isOutResearch, 'checked', categories.OUTRESEARCH in this.categories));
            await promises.push(requester.setCustomField(this.trelloId, this.customFields.isDocs, 'checked', categories.DOCS_TRAINING in this.categories));
            await promises.push(requester.setCustomField(this.trelloId, this.customFields.isDesign, 'checked', categories.DESIGN in this.categories));
            await promises.push(requester.setCustomField(this.trelloId, this.customFields.isCode, 'checked', categories.CODING in this.categories));

            await promises.push(requester.setCustomField(this.trelloId, this.customFields.googleId, 'number', this.googleId));
            await promises.push(requester.setCustomField(this.trelloId, this.customFields.instances, 'number', this.maxInstances));

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
        const data = {
            id: this.googleId,
            name: this.name,
            description: this.description,
            status: this.status,
            max_instances: this.maxInstances,
            is_beginner: this.isBeginner,
            time_to_complete_in_days: this.days,
            external_url: this.externalUrl,

            last_modified: this.lastModified,
            claimed_count: this.claimedCount,
            available_count: this.availableCount,
            completed_count: this.completedCount,

            private_metadata: this.trelloId,

            mentors: this.mentors,
            tags: this.tags,
            categories: []
        };
        for (let category in this.categories) {
            if (this.categories[category]) {
                data.categories.push(category)
            }
        }

        if (!this.googleId) {
            console.warn(`Making new google task for ${this.name} (${this.trelloId})`);
            requester.googlePost(data).then(body => {
                this.googleId = body.id;
                /* We write to trello to write the google task id */
                this.writeToTrello();
            });
        } else {
            requester.updateGoogle(this.googleId, data);
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